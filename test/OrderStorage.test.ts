import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "fs";
import { OrderStorage } from "../src/storage/orderStorage";
import { validateOrderData, validateSignature } from "../scripts/utils/storageHelpers";
import { 
  createMockOrderRequest,
  createTestOrders,
  cleanupTestStorage,
  createValidOrderData,
  createInvalidOrderData,
  TEST_SIGNATURES
} from "./helpers/storageTestHelpers";

describe("Order Storage System", function () {
  let storage: OrderStorage;
  let testStorageFile: string;

  this.timeout(30000);

  before(async function () {
    console.log("\n🚀 Starting Order Storage System Tests");
    console.log("=" .repeat(60));
  });

  beforeEach(async function () {
    // Create unique storage file for each test
    testStorageFile = `storage/test_order_storage_${Date.now()}_${Math.random().toString(36).substring(2)}.json`;
    storage = new OrderStorage(testStorageFile);
  });

  afterEach(async function () {
    // Clean up test data and remove test file
    await cleanupTestStorage(storage);
    
    // Remove the test storage file
    if (fs.existsSync(testStorageFile)) {
      fs.unlinkSync(testStorageFile);
    }
  });

  describe("Order Publishing", function () {
    before(async function () {
      console.log("\n🧪 Testing Basic Storage Operations");
      console.log("=" .repeat(50));
    });

    it("should successfully publish a new order", async function () {
      console.log("\n1️⃣  Testing order publishing...");
      
      const orderRequest = createMockOrderRequest(1);
      const result = await storage.publishOrder(orderRequest);
      
      console.log(`   Order 1: ${result.success ? '✅ Published' : '❌ Failed'} (ID: ${result.orderId})`);
      
      expect(result.success).to.be.true;
      expect(result.orderId).to.be.a("string");
      expect(result.timestamp).to.be.a("string");
      expect(result.error).to.be.undefined;
    });

    it("should prevent duplicate commitment orders", async function () {
      console.log("\n2️⃣  Testing duplicate commitment prevention...");
      
      const orderRequest = createMockOrderRequest(1);
      
      // Publish first order
      const firstResult = await storage.publishOrder(orderRequest);
      expect(firstResult.success).to.be.true;
      
      // Try to publish duplicate
      const duplicateResult = await storage.publishOrder(orderRequest);
      console.log(`   Duplicate order: ${duplicateResult.success ? '❌ Should have failed' : '✅ Correctly rejected'}`);
      if (!duplicateResult.success) {
        console.log(`   Error: ${duplicateResult.error}`);
      }
      
      expect(duplicateResult.success).to.be.false;
      expect(duplicateResult.error).to.include("already exists");
    });

    it("should generate unique order IDs", async function () {
      const order1 = createMockOrderRequest(1);
      const order2 = createMockOrderRequest(2);
      
      const result1 = await storage.publishOrder(order1);
      const result2 = await storage.publishOrder(order2);
      
      expect(result1.success).to.be.true;
      expect(result2.success).to.be.true;
      expect(result1.orderId).to.not.equal(result2.orderId);
    });

    it("should set correct initial order status", async function () {
      const orderRequest = createMockOrderRequest(1);
      const result = await storage.publishOrder(orderRequest);
      
      expect(result.success).to.be.true;
      
      const publishedOrder = await storage.getOrderById(result.orderId!);
      expect(publishedOrder).to.not.be.null;
      expect(publishedOrder!.metadata.status).to.equal("active");
    });
  });

  describe("Order Retrieval", function () {
    beforeEach(async function () {
      // Create test orders for retrieval tests
      await createTestOrders(3, storage);
    });

    it("should retrieve all orders", async function () {
      console.log("\n3️⃣  Testing order retrieval...");
      
      const result = await storage.getOrders();
      console.log(`   Retrieved ${result.totalCount} orders`);
      
      expect(result.orders).to.have.length(3);
      expect(result.totalCount).to.equal(3);
    });

    it("should retrieve order by ID", async function () {
      console.log("\n4️⃣  Testing get order by ID...");
      
      const allOrders = await storage.getOrders();
      const firstOrderId = allOrders.orders[0].id;
      
      const order = await storage.getOrderById(firstOrderId);
      console.log(`   Order by ID: ${order ? '✅ Found' : '❌ Not found'}`);
      
      expect(order).to.not.be.null;
      expect(order!.id).to.equal(firstOrderId);
    });

    it("should return null for non-existent order ID", async function () {
      const order = await storage.getOrderById("non-existent-id");
      
      expect(order).to.be.null;
    });

    it("should sort orders by published date (newest first)", async function () {
      const result = await storage.getOrders();
      
      for (let i = 1; i < result.orders.length; i++) {
        const currentDate = new Date(result.orders[i].metadata.published);
        const previousDate = new Date(result.orders[i - 1].metadata.published);
        expect(currentDate.getTime()).to.be.at.most(previousDate.getTime());
      }
    });
  });

  describe("Order Filtering", function () {
    before(async function () {
      console.log("\n🔍 Testing Advanced Filtering");
      console.log("=" .repeat(50));
    });

    beforeEach(async function () {
      // Create diverse test orders
      await createTestOrders(5, storage);
      
      // Update some orders to different statuses
      const allOrders = await storage.getOrders();
      await storage.updateOrderStatus({
        orderId: allOrders.orders[0].id,
        status: 'filled'
      });
      await storage.updateOrderStatus({
        orderId: allOrders.orders[1].id,
        status: 'cancelled'
      });
    });

    it("should filter by status", async function () {
      console.log("\n1️⃣  Testing status filtering...");
      
      const activeOrders = await storage.getOrders({ status: 'active' });
      const filledOrders = await storage.getOrders({ status: 'filled' });
      const cancelledOrders = await storage.getOrders({ status: 'cancelled' });
      
      console.log(`   Active orders: ${activeOrders.totalCount}`);
      console.log(`   Filled orders: ${filledOrders.totalCount}`);
      console.log(`   Cancelled orders: ${cancelledOrders.totalCount}`);
      
      expect(activeOrders.totalCount).to.equal(3);
      expect(filledOrders.totalCount).to.equal(1);
      expect(cancelledOrders.totalCount).to.equal(1);
      
      activeOrders.orders.forEach(order => {
        expect(order.metadata.status).to.equal('active');
      });
    });

    it("should filter by network", async function () {
      console.log("\n2️⃣  Testing network filtering...");
      
      const localhostOrders = await storage.getOrders({ network: 'localhost' });
      console.log(`   Localhost orders: ${localhostOrders.totalCount}`);
      
      expect(localhostOrders.totalCount).to.equal(5);
      localhostOrders.orders.forEach(order => {
        expect(order.metadata.network).to.equal('localhost');
      });
    });

    it("should filter by maker address", async function () {
      console.log("\n3️⃣  Testing maker filtering...");
      
      const testMaker = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      const makerOrders = await storage.getOrders({ maker: testMaker });
      console.log(`   Orders by specific maker: ${makerOrders.totalCount}`);
      
      expect(makerOrders.totalCount).to.equal(5);
      makerOrders.orders.forEach(order => {
        expect(order.metadata.maker.toLowerCase()).to.equal(testMaker.toLowerCase());
      });
    });

    it("should filter by asset addresses", async function () {
      console.log("\n4️⃣  Testing asset filtering...");
      
      const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      const wethOrders = await storage.getOrders({ makerAsset: wethAddress });
      console.log(`   WETH orders: ${wethOrders.totalCount}`);
      
      expect(wethOrders.totalCount).to.equal(5);
      wethOrders.orders.forEach(order => {
        expect(order.metadata.makerAsset.toLowerCase()).to.equal(wethAddress.toLowerCase());
      });
    });

    it("should combine multiple filters", async function () {
      console.log("\n5️⃣  Testing combined filtering...");
      
      const combinedResult = await storage.getOrders({
        status: 'active',
        network: 'localhost',
        maker: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
      });
      console.log(`   Combined filter results: ${combinedResult.totalCount}`);
      
      expect(combinedResult.totalCount).to.equal(3);
      combinedResult.orders.forEach(order => {
        expect(order.metadata.status).to.equal('active');
        expect(order.metadata.network).to.equal('localhost');
        expect(order.metadata.maker.toLowerCase()).to.equal('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase());
      });
    });
  });

  describe("Order Status Management", function () {
    let orderId: string;

    beforeEach(async function () {
      const orderRequest = createMockOrderRequest(1);
      const result = await storage.publishOrder(orderRequest);
      orderId = result.orderId!;
    });

    it("should update order status successfully", async function () {
      console.log("\n5️⃣  Testing order status update...");
      
      const updateResult = await storage.updateOrderStatus({
        orderId,
        status: 'filled'
      });
      
      console.log(`   Status update: ${updateResult.success ? '✅ Success' : '❌ Failed'}`);
      
      expect(updateResult.success).to.be.true;
      expect(updateResult.orderId).to.equal(orderId);
      
      const updatedOrder = await storage.getOrderById(orderId);
      console.log(`   Updated status: ${updatedOrder?.metadata.status || 'unknown'}`);
      expect(updatedOrder!.metadata.status).to.equal('filled');
    });

    it("should fail to update non-existent order", async function () {
      const updateResult = await storage.updateOrderStatus({
        orderId: 'non-existent-id',
        status: 'filled'
      });
      
      expect(updateResult.success).to.be.false;
      expect(updateResult.error).to.include("not found");
    });

    it("should track status transitions", async function () {
      // Active -> Filled
      await storage.updateOrderStatus({ orderId, status: 'filled' });
      let order = await storage.getOrderById(orderId);
      expect(order!.metadata.status).to.equal('filled');
      
      // Filled -> Cancelled
      await storage.updateOrderStatus({ orderId, status: 'cancelled' });
      order = await storage.getOrderById(orderId);
      expect(order!.metadata.status).to.equal('cancelled');
    });
  });

  describe("Storage Statistics", function () {
    beforeEach(async function () {
      // Create orders with different statuses
      const orderIds = await createTestOrders(5, storage);
      
      await storage.updateOrderStatus({ orderId: orderIds[0], status: 'filled' });
      await storage.updateOrderStatus({ orderId: orderIds[1], status: 'filled' });
      await storage.updateOrderStatus({ orderId: orderIds[2], status: 'cancelled' });
    });

    it("should return accurate storage statistics", async function () {
      console.log("\n6️⃣  Testing storage statistics...");
      
      const stats = await storage.getStorageStats();
      
      console.log("📊 Storage Statistics:");
      console.log(`  Total Orders: ${stats.totalOrders}`);
      console.log(`  Active Orders: ${stats.activeOrders}`);
      console.log(`  Filled Orders: ${stats.filledOrders}`);
      console.log(`  Cancelled Orders: ${stats.cancelledOrders}`);
      
      expect(stats.totalOrders).to.equal(5);
      expect(stats.activeOrders).to.equal(2);
      expect(stats.filledOrders).to.equal(2);
      expect(stats.cancelledOrders).to.equal(1);
    });
  });

  describe("Concurrent Access Safety", function () {
    before(async function () {
      console.log("\n⚡ Testing Concurrent Access Safety");
      console.log("=" .repeat(50));
    });

    it("should handle concurrent order publishing", async function () {
      console.log("\n1️⃣  Testing concurrent order publishing...");
      
      const concurrentOrders = Array.from({ length: 5 }, (_, i) => 
        createMockOrderRequest(i + 10)
      );
      
      const startTime = Date.now();
      const results = await Promise.all(
        concurrentOrders.map(order => storage.publishOrder(order))
      );
      const endTime = Date.now();
      
      const successCount = results.filter(result => result.success).length;
      console.log(`   Published ${successCount}/${concurrentOrders.length} orders concurrently`);
      console.log(`   Time taken: ${endTime - startTime}ms`);
      
      expect(successCount).to.equal(5);
      expect(endTime - startTime).to.be.below(5000); // Should complete within 5 seconds
      
      const finalCount = await storage.getOrders();
      console.log(`   Total orders in storage: ${finalCount.totalCount}`);
      expect(finalCount.totalCount).to.equal(5);
    });
  });

  describe("Data Validation", function () {
    before(async function () {
      console.log("\n✅ Testing Validation Functions");
      console.log("=" .repeat(50));
    });

    it("should validate correct order data", function () {
      console.log("\n1️⃣  Testing order data validation...");
      
      const validOrder = createValidOrderData();
      const result = validateOrderData(validOrder);
      
      console.log(`   Valid order validation: ${result.valid ? '✅ Passed' : '❌ Failed'}`);
      
      expect(result.valid).to.be.true;
      expect(result.errors).to.have.length(0);
    });

    it("should reject invalid order data", function () {
      const invalidOrder = createInvalidOrderData();
      const result = validateOrderData(invalidOrder);
      
      console.log(`   Invalid order validation: ${!result.valid ? '✅ Correctly rejected' : '❌ Should have failed'}`);
      if (!result.valid) {
        console.log(`   Validation errors: ${result.errors.join(', ')}`);
      }
      
      expect(result.valid).to.be.false;
      expect(result.errors.length).to.be.greaterThan(0);
      expect(result.errors).to.include("Invalid maker address");
      expect(result.errors).to.include("Invalid makingAmount");
    });

    it("should validate correct signatures", function () {
      console.log("\n2️⃣  Testing signature validation...");
      
      console.log(`   Valid signature: ${validateSignature(TEST_SIGNATURES.valid) ? '✅ Valid' : '❌ Invalid'}`);
      expect(validateSignature(TEST_SIGNATURES.valid)).to.be.true;
    });

    it("should reject invalid signatures", function () {
      console.log(`   Invalid signature: ${!validateSignature(TEST_SIGNATURES.tooShort) ? '✅ Correctly rejected' : '❌ Should have been invalid'}`);
      
      expect(validateSignature(TEST_SIGNATURES.tooShort)).to.be.false;
      expect(validateSignature(TEST_SIGNATURES.wrongLength)).to.be.false;
      expect(validateSignature(TEST_SIGNATURES.invalidHex)).to.be.false;
    });
  });

  describe("Storage Utilities", function () {
    beforeEach(async function () {
      await createTestOrders(3, storage);
    });

    it("should provide correct storage file path", function () {
      const filePath = storage.getStorageFilePath();
      expect(filePath).to.include("test_order_storage");
    });

    it("should retrieve active orders only", async function () {
      // Update one order to filled status
      const allOrders = await storage.getOrders();
      await storage.updateOrderStatus({
        orderId: allOrders.orders[0].id,
        status: 'filled'
      });
      
      const activeOrders = await storage.getActiveOrders('localhost');
      expect(activeOrders).to.have.length(2);
      activeOrders.forEach(order => {
        expect(order.metadata.status).to.equal('active');
        expect(order.metadata.network).to.equal('localhost');
      });
    });
  });

  after(async function () {
    console.log("\n🎉 All tests completed successfully!");
    console.log("✅ Order storage system is working correctly");
  });
}); 