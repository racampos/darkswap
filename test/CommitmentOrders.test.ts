import { expect } from "chai";
import { ethers, network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  buildCommitmentOrder,
  signCommitmentOrder,
  validateCommitmentOrder,
  getCommitmentFromOrder,
  CommitmentOrderParams
} from "../src/utils/commitmentOrders";

// Load 1inch ABI
const AggregationRouterV6ABI = require("../abi/AggregationRouterV6.json");

const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

describe("Commitment Orders - Simple REST Architecture", function () {
  let snapshotId: string;
  let maker: HardhatEthersSigner;
  let taker: HardhatEthersSigner;
  let aggregationRouter: any;

  this.timeout(30000);

  before(async function () {
    console.log("Setting up Commitment Order tests...");
    
    snapshotId = await ethers.provider.send("evm_snapshot", []);
    [, maker, taker] = await ethers.getSigners();

    // Setup aggregation router
    aggregationRouter = new ethers.Contract(AGGREGATION_ROUTER_V6, AggregationRouterV6ABI, ethers.provider);
    
    console.log("Commitment Order test environment ready");
  });

  after(async function () {
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  describe("Order Creation", function () {
    it("should create a simple commitment order", async function () {
      console.log("\nTesting simple commitment order creation...");

      const orderParams: CommitmentOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"), // 3500 USDC
        secretParams: {
          secretPrice: BigInt("3000000000"), // Secret minimum: 3000 USDC
          secretAmount: ethers.parseEther("1"),
          nonce: BigInt("123456789")
        }
      };

      const result = await buildCommitmentOrder(orderParams);

      // Verify order structure
      expect(result.order.maker).to.equal(maker.address);
      expect(result.order.makerAsset).to.equal(WETH_ADDRESS);
      expect(result.order.takerAsset).to.equal(USDC_ADDRESS);
      expect(result.order.makingAmount).to.equal(ethers.parseEther("1"));
      expect(result.order.takingAmount).to.equal(BigInt("3500000000"));
      expect(result.order.extension).to.equal("0x");

      // Verify commitment
      expect(result.commitment).to.be.a("string");
      expect(BigInt(result.commitment)).to.be.greaterThan(0n);

      // Verify salt matches commitment
      expect(result.order.salt).to.equal(BigInt(result.commitment));

      console.log(`   Created order with commitment: ${result.commitment}`);
      console.log(`   Order salt: ${result.order.salt}`);
      console.log("   Order creation successful!");
    });

    it("should create different commitments for different secret parameters", async function () {
      console.log("\nTesting commitment uniqueness...");

      const baseParams: CommitmentOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3000000000"),
          secretAmount: ethers.parseEther("1"),
          nonce: BigInt("123456789")
        }
      };

      const order1 = await buildCommitmentOrder(baseParams);

      // Different secret price
      const params2 = {
        ...baseParams,
        secretParams: {
          ...baseParams.secretParams,
          secretPrice: BigInt("3100000000") // Different secret price
        }
      };
      const order2 = await buildCommitmentOrder(params2);

      // Different nonce
      const params3 = {
        ...baseParams,
        secretParams: {
          ...baseParams.secretParams,
          nonce: BigInt("987654321") // Different nonce
        }
      };
      const order3 = await buildCommitmentOrder(params3);

      // All commitments should be different
      expect(order1.commitment).to.not.equal(order2.commitment);
      expect(order1.commitment).to.not.equal(order3.commitment);
      expect(order2.commitment).to.not.equal(order3.commitment);

      console.log(`   Order 1 commitment: ${order1.commitment}`);
      console.log(`   Order 2 commitment: ${order2.commitment}`);
      console.log(`   Order 3 commitment: ${order3.commitment}`);
      console.log("   All commitments are unique!");
    });
  });

  describe("Order Signing", function () {
    it("should sign a commitment order", async function () {
      console.log("\nTesting commitment order signing...");

      const orderParams: CommitmentOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3000000000"),
          secretAmount: ethers.parseEther("1"),
          nonce: BigInt("123456789")
        }
      };

      const result = await buildCommitmentOrder(orderParams);
      const signature = await signCommitmentOrder(
        result.order,
        BigInt(1), // mainnet chain ID
        await aggregationRouter.getAddress(),
        maker
      );

      // Verify signature format
      expect(signature).to.be.a("string");
      expect(signature).to.match(/^0x[a-fA-F0-9]{130}$/); // 65 bytes = 130 hex chars

      console.log(`   Signature: ${signature.slice(0, 20)}...${signature.slice(-20)}`);
      console.log("   Order signing successful!");
    });

    it("should create different signatures for different orders", async function () {
      console.log("\nTesting signature uniqueness...");

      const params1: CommitmentOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3000000000"),
          secretAmount: ethers.parseEther("1"),
          nonce: BigInt("123456789")
        }
      };

      const params2: CommitmentOrderParams = {
        ...params1,
        makingAmount: ethers.parseEther("2") // Different making amount
      };

      const order1 = await buildCommitmentOrder(params1);
      const order2 = await buildCommitmentOrder(params2);

      const signature1 = await signCommitmentOrder(order1.order, BigInt(1), await aggregationRouter.getAddress(), maker);
      const signature2 = await signCommitmentOrder(order2.order, BigInt(1), await aggregationRouter.getAddress(), maker);

      expect(signature1).to.not.equal(signature2);
      console.log("   Different orders produce different signatures!");
    });
  });

  describe("Order Validation", function () {
    it("should validate correct order parameters", async function () {
      console.log("\nTesting order parameter validation...");

      const validParams: CommitmentOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3000000000"),
          secretAmount: ethers.parseEther("1"),
          nonce: BigInt("123456789")
        }
      };

      const validation = validateCommitmentOrder(validParams);

      expect(validation.isValid).to.be.true;
      expect(validation.errors).to.have.length(0);

      console.log("   Valid parameters passed validation!");
    });

    it("should reject invalid addresses", async function () {
      console.log("\nTesting invalid address validation...");

      const invalidParams: CommitmentOrderParams = {
        maker: "0xinvalid",
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3000000000"),
          secretAmount: ethers.parseEther("1"),
          nonce: BigInt("123456789")
        }
      };

      const validation = validateCommitmentOrder(invalidParams);

      expect(validation.isValid).to.be.false;
      expect(validation.errors).to.include("Invalid maker address");

      console.log(`   Validation errors: ${validation.errors.join(", ")}`);
    });

    it("should reject zero or negative amounts", async function () {
      console.log("\nTesting amount validation...");

      const zeroAmountParams: CommitmentOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: 0n,
        takingAmount: 0n,
        secretParams: {
          secretPrice: 0n,
          secretAmount: 0n,
          nonce: BigInt("123456789")
        }
      };

      const validation = validateCommitmentOrder(zeroAmountParams);

      expect(validation.isValid).to.be.false;
      expect(validation.errors).to.include("Making amount must be positive");
      expect(validation.errors).to.include("Taking amount must be positive");
      expect(validation.errors).to.include("Secret price must be positive");
      expect(validation.errors).to.include("Secret amount must be positive");

      console.log(`   Validation errors: ${validation.errors.join(", ")}`);
    });
  });

  describe("Utility Functions", function () {
    it("should extract commitment from order", async function () {
      console.log("\nTesting commitment extraction...");

      const orderParams: CommitmentOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3000000000"),
          secretAmount: ethers.parseEther("1"),
          nonce: BigInt("123456789")
        }
      };

      const result = await buildCommitmentOrder(orderParams);
      const extractedCommitment = getCommitmentFromOrder(result.order);

      expect(extractedCommitment).to.equal(BigInt(result.commitment));
      expect(extractedCommitment).to.equal(result.order.salt);

      console.log(`   Extracted commitment: ${extractedCommitment}`);
      console.log("   Commitment extraction successful!");
    });
  });

  describe("REST Architecture Demo", function () {
    it("should demonstrate clean order workflow for REST service", async function () {
      console.log("\nDemonstrating REST architecture workflow...");

      // Step 1: Maker creates commitment order
      console.log("\nSTEP 1: Maker creates commitment order");
      const orderParams: CommitmentOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3000000000"), // Secret: won't accept < 3000 USDC
          secretAmount: ethers.parseEther("1"),
          nonce: BigInt("123456789")
        }
      };

      const order = await buildCommitmentOrder(orderParams);
      console.log("   Created clean order with commitment embedded in salt");

      // Step 2: Maker signs order
      console.log("\nSTEP 2: Maker signs order");
      const signature = await signCommitmentOrder(
        order.order,
        BigInt(1),
        await aggregationRouter.getAddress(),
        maker
      );
      console.log("   Order signed using standard EIP-712");

      // Step 3: Order is published (simulated)
      console.log("\nSTEP 3: Order published to 1inch network");
      console.log("   Order appears as normal 1inch order to takers");
      console.log("   Commitment is hidden in salt - no visible ZK complexity");

      // Step 4: Taker discovers order (simulated)
      console.log("\nSTEP 4: Taker discovers order");
      console.log("   Taker sees: 1 WETH → 3500 USDC order");
      console.log("   Taker doesn't know about secret 3000 USDC minimum");

      // Step 5: Maker's REST service would handle authorization
      console.log("\nSTEP 5: REST service authorization (conceptual)");
      console.log("   Taker calls: POST /authorize-fill");
      console.log("   Payload: { orderHash, fillAmount: 3200 USDC, taker }");
      console.log("   Service: Generates ZK proof (3200 > 3000 secret)");
      console.log("   Response: { success: true, transaction: 0x... }");

      // Verify the clean order structure
      expect(order.order.extension).to.equal("0x");
      expect(order.commitment).to.be.a("string");
      expect(signature).to.match(/^0x[a-fA-F0-9]{130}$/);

      console.log("\nREST ARCHITECTURE BENEFITS:");
      console.log("   Clean orders - no complex extensions");
      console.log("   Standard 1inch integration");
      console.log("   Maker controls ZK proof generation");
      console.log("   Taker gets ready-to-submit transactions");
      console.log("   Secrets never leak");
      console.log("   Simple client-side implementation");
    });
  });
}); 