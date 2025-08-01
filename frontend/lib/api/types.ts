import { type Address } from 'viem'
import { type OrderStatus, type OrderData, type SignedOrder, type SecretParameters, type OrderMetadata } from '@/types'

// Base API Response
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Health Check
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: number
  version?: string
}

// Order Authorization
export interface AuthorizeFillRequest {
  orderHash: string
  fillAmount: string
  takerAddress: Address
}

export interface AuthorizeFillResponse {
  success: boolean
  orderWithExtension: OrderData
  signature: string
  message?: string
}

// Order Management
export interface CreateOrderRequest {
  chainId: number
  order: OrderData
  signature: string
  extension?: string
  metadata: OrderMetadata
  secrets: SecretParameters
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus
  txHash?: string
}

export interface PublishedOrder {
  id: string
  chainId: number
  order: OrderData
  signature: string
  extension?: string
  metadata: OrderMetadata
  secrets: SecretParameters
  status: OrderStatus
  createdAt: number
  updatedAt: number
}

// Query Parameters
export interface OrdersQueryParams {
  network?: string
  status?: OrderStatus
  maker?: Address
  makerAsset?: Address
  takerAsset?: Address
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'rate' | 'amount'
  sortOrder?: 'asc' | 'desc'
}

export interface ActiveOrdersQueryParams {
  network: string
  makerAsset?: Address
  takerAsset?: Address
  limit?: number
}

// API Error
export interface APIError {
  error: string
  details?: string
  code?: number
  timestamp?: number
}

// Paginated Response
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Order Statistics
export interface OrderStats {
  totalOrders: number
  activeOrders: number
  filledOrders: number
  cancelledOrders: number
  totalVolume: string
  averageOrderSize: string
}

// Network Status
export interface NetworkStatus {
  chainId: number
  blockNumber: number
  gasPrice: string
  isHealthy: boolean
  lastUpdate: number
} 
 