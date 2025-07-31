import { ethers } from "hardhat";
import { OrderStorage } from "../../src/storage/orderStorage";
import { 
  PublishedOrder, 
  CreateOrderRequest, 
  OrderMetadata, 
  OrderFilter 
} from "../../src/types/orderTypes";

// Storage instance singleton
let storageInstance: OrderStorage | null = null;

export function getOrderStorage(customPath?: string): OrderStorage {
  if (!storageInstance || customPath) {
    storageInstance = new OrderStorage(customPath);
  }
  return storageInstance;
}

// Helper function to format 1inch order data for storage
export function formatOrderForStorage(
  order: any,
  signature: string,
  commitment: string,
  metadata: Omit<OrderMetadata, 'published' | 'status'>
): CreateOrderRequest {
  return {
    orderData: {
      maker: order.maker,
      makerAsset: order.makerAsset,
      takerAsset: order.takerAsset,
      makingAmount: order.makingAmount.toString(),
      takingAmount: order.takingAmount.toString(),
      salt: order.salt.toString(),
      makerTraits: order.makerTraits.toString(),
      extension: order.extension || '0x'
    },
    signature,
    commitment,
    metadata
  };
}

// Helper to create human-readable price display
export function formatDisplayPrice(
  makingAmount: string,
  takingAmount: string,
  makerAsset: string,
  takerAsset: string
): string {
  try {
    const making = ethers.parseEther(makingAmount);
    const taking = BigInt(takingAmount);
    
    // Simple price calculation (this could be enhanced with token decimals)
    const price = Number(taking) / Number(making);
    
    // Extract token symbols from addresses (simplified)
    const makerSymbol = getTokenSymbol(makerAsset);
    const takerSymbol = getTokenSymbol(takerAsset);
    
    return `${price.toFixed(2)} ${takerSymbol} per ${makerSymbol}`;
  } catch (error) {
    return `${takingAmount} / ${makingAmount}`;
  }
}

// Simplified token symbol extraction (in real implementation, this would query token contracts)
function getTokenSymbol(address: string): string {
  const symbols: Record<string, string> = {
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'WETH',
    '0xA0b86a33E6441F6c1bF9c62c8C7A1E1a46a3e59e': 'USDC', // Example USDC address
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': 'DAI',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT'
  };
  
  return symbols[address] || address.substring(0, 8) + '...';
}

// Validation helpers
export function validateOrderData(orderData: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!orderData.maker || !ethers.isAddress(orderData.maker)) {
    errors.push('Invalid maker address');
  }
  
  if (!orderData.makerAsset || !ethers.isAddress(orderData.makerAsset)) {
    errors.push('Invalid makerAsset address');
  }
  
  if (!orderData.takerAsset || !ethers.isAddress(orderData.takerAsset)) {
    errors.push('Invalid takerAsset address');
  }
  
  if (!orderData.makingAmount || Number(orderData.makingAmount) <= 0) {
    errors.push('Invalid makingAmount');
  }
  
  if (!orderData.takingAmount || Number(orderData.takingAmount) <= 0) {
    errors.push('Invalid takingAmount');
  }
  
  if (!orderData.salt) {
    errors.push('Missing salt');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateSignature(signature: string): boolean {
  try {
    // Basic signature format validation
    if (!signature.startsWith('0x')) return false;
    if (signature.length !== 132) return false; // 0x + 64 chars r + 64 chars s + 2 chars v
    
    const hex = signature.substring(2);
    return /^[0-9A-Fa-f]+$/.test(hex);
  } catch {
    return false;
  }
}

// Display helpers for demo scripts
export function formatOrderSummary(order: PublishedOrder): string {
  const metadata = order.metadata;
  return [
    `📋 Order ID: ${order.id}`,
    `👤 Maker: ${metadata.maker}`,
    `💱 Trade: ${metadata.makingAmount} → ${metadata.takingAmount}`,
    `💰 Price: ${metadata.displayPrice || 'N/A'}`,
    `📅 Published: ${new Date(metadata.published).toLocaleString()}`,
    `🔷 Status: ${metadata.status.toUpperCase()}`,
    `🌐 Network: ${metadata.network}`,
    `🔒 Commitment: ${order.commitment.substring(0, 16)}...`
  ].join('\n  ');
}

export function formatStorageStats(stats: any): string {
  return [
    `📊 Storage Statistics:`,
    `  Total Orders: ${stats.totalOrders}`,
    `  Active Orders: ${stats.activeOrders}`,
    `  Filled Orders: ${stats.filledOrders}`,
    `  Cancelled Orders: ${stats.cancelledOrders}`
  ].join('\n');
}

// Search and filter helpers
export function createNetworkFilter(network: string): OrderFilter {
  return { network, status: 'active' };
}

export function createAssetPairFilter(
  makerAsset: string, 
  takerAsset: string, 
  network?: string
): OrderFilter {
  const filter: OrderFilter = {
    makerAsset,
    takerAsset,
    status: 'active'
  };
  
  if (network) {
    filter.network = network;
  }
  
  return filter;
}

export function createMakerFilter(maker: string, network?: string): OrderFilter {
  const filter: OrderFilter = {
    maker,
    status: 'active'
  };
  
  if (network) {
    filter.network = network;
  }
  
  return filter;
}

// Demo helpers for demo scripts
export async function displayOrdersList(
  storage: OrderStorage, 
  filter?: OrderFilter,
  title: string = "Published Orders"
): Promise<void> {
  console.log(`\n${title}:`);
  console.log('='.repeat(50));
  
  const result = await storage.getOrders(filter);
  
  if (result.orders.length === 0) {
    console.log('  No orders found.');
    return;
  }
  
  result.orders.forEach((order, index) => {
    console.log(`\n${index + 1}. ${formatOrderSummary(order)}`);
  });
  
  console.log(`\n📊 Total: ${result.totalCount} orders`);
} 