import { expect } from "chai";
import { ethers } from "hardhat";
import { OrderStorage } from "../../src/storage/orderStorage";
import { 
  PublishedOrder, 
  CreateOrderRequest, 
  OrderMetadata, 
  OrderFilter 
} from "../../src/types/orderTypes";

// Test-specific storage helpers

export function createMockOrderRequest(index: number, network: string = "localhost"): CreateOrderRequest {
  const mockOrder = {
    maker: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Hardhat test account
    makerAsset: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    takerAsset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    makingAmount: ethers.parseEther("1").toString(),
    takingAmount: (3500000000 + index * 100000000).toString(), // Varying prices
    salt: (BigInt("12345678901234567890") + BigInt(index)).toString(),
    makerTraits: "0",
    extension: "0x"
  };

  const mockSignature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c";
  const commitment = (BigInt("98765432109876543210") + BigInt(index)).toString();

  const metadata: Omit<OrderMetadata, 'published' | 'status'> = {
    maker: mockOrder.maker,
    makerAsset: mockOrder.makerAsset,
    takerAsset: mockOrder.takerAsset,
    makingAmount: mockOrder.makingAmount,
    takingAmount: mockOrder.takingAmount,
    originalSalt: mockOrder.salt,
    displayPrice: `${((Number(mockOrder.takingAmount) / 1e6) / (Number(mockOrder.makingAmount) / 1e18)).toFixed(2)} USDC per WETH`,
    network
  };

  return {
    orderData: mockOrder,
    signature: mockSignature,
    commitment,
    metadata
  };
}

export async function createTestOrders(count: number, storage: OrderStorage): Promise<string[]> {
  const orderIds: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const orderRequest = createMockOrderRequest(i);
    const result = await storage.publishOrder(orderRequest);
    if (result.success && result.orderId) {
      orderIds.push(result.orderId);
    }
  }
  
  return orderIds;
}

export async function cleanupTestStorage(storage: OrderStorage): Promise<void> {
  const result = await storage.getOrders();
  
  for (const order of result.orders) {
    await storage.updateOrderStatus({
      orderId: order.id,
      status: 'cancelled',
      reason: 'Test cleanup'
    });
  }
}

export function createValidOrderData() {
  return {
    maker: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    makerAsset: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    takerAsset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    makingAmount: ethers.parseEther("1"),
    takingAmount: BigInt("3500000000"),
    salt: BigInt("12345678901234567890"),
    makerTraits: "0",
    extension: "0x"
  };
}

export function createInvalidOrderData() {
  return {
    maker: "invalid-address",
    makerAsset: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    takerAsset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    makingAmount: "0", // Invalid amount
    takingAmount: "3500000000",
    salt: "12345678901234567890",
    makerTraits: "0",
    extension: "0x"
  };
}

export const TEST_SIGNATURES = {
  valid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c",
  tooShort: "0x123",
  invalidHex: "0x123xyz",
  wrongLength: "0x1234567890abcdef"
};

export function expectOrdersEqual(actual: PublishedOrder, expected: Partial<PublishedOrder>): void {
  if (expected.id) expect(actual.id).to.equal(expected.id);
  if (expected.commitment) expect(actual.commitment).to.equal(expected.commitment);
  if (expected.signature) expect(actual.signature).to.equal(expected.signature);
  if (expected.metadata) {
    expect(actual.metadata.maker).to.equal(expected.metadata.maker);
    expect(actual.metadata.status).to.equal(expected.metadata.status);
    expect(actual.metadata.network).to.equal(expected.metadata.network);
  }
} 