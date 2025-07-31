export type OrderStatus = 'active' | 'filled' | 'cancelled';

export interface OrderMetadata {
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  published: string; // ISO timestamp
  status: OrderStatus;
  originalSalt: string;
  displayPrice?: string; // Human readable price (e.g., "3500 USDC per WETH")
  network: string; // Network name (localhost, hardhat, etc.)
}

export interface PublishedOrder {
  id: string;
  orderData: any; // 1inch order structure - using any for flexibility
  signature: string;
  commitment: string;
  metadata: OrderMetadata;
}

export interface OrderStorageData {
  orders: PublishedOrder[];
  lastUpdated: string;
  version: string;
}

export interface OrderFilter {
  status?: OrderStatus;
  maker?: string;
  makerAsset?: string;
  takerAsset?: string;
  network?: string;
}

export interface OrderSearchResult {
  orders: PublishedOrder[];
  totalCount: number;
  filters: OrderFilter;
}

// Helper types for order creation
export interface CreateOrderRequest {
  orderData: any;
  signature: string;
  commitment: string;
  metadata: Omit<OrderMetadata, 'published' | 'status'>;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  status: OrderStatus;
  updatedBy?: string;
  reason?: string;
}

// Storage operation results
export interface StorageOperationResult {
  success: boolean;
  orderId?: string;
  error?: string;
  timestamp: string;
} 