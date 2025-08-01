import { type Address } from 'viem'
import { apiClient } from './client'
import { 
  type AuthorizeFillRequest,
  type AuthorizeFillResponse,
  type CreateOrderRequest,
  type PublishedOrder,
  type OrdersQueryParams,
  type ActiveOrdersQueryParams,
  type UpdateOrderStatusRequest 
} from './types'
import { type OrderStatus, type OrderMetadata, type SecretParameters, type OrderData } from '@/types'

export class OrdersAPI {
  // Order Discovery
  static async discoverOrders(filters?: {
    network?: string
    makerAsset?: Address
    takerAsset?: Address
    maker?: Address
    status?: OrderStatus
    limit?: number
  }): Promise<PublishedOrder[]> {
    const params: OrdersQueryParams = {
      ...filters,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }
    
    return apiClient.getOrders(params)
  }

  // Get active orders for a specific trading pair
  static async getActiveTradingPairOrders(
    network: string,
    makerAsset?: Address,
    takerAsset?: Address,
    limit = 20
  ): Promise<PublishedOrder[]> {
    const params: ActiveOrdersQueryParams = {
      network,
      makerAsset,
      takerAsset,
      limit,
    }
    
    return apiClient.getActiveOrders(params)
  }

  // Order Authorization
  static async requestFillAuthorization(
    orderHash: string,
    fillAmount: string,
    takerAddress: Address
  ): Promise<AuthorizeFillResponse> {
    const request: AuthorizeFillRequest = {
      orderHash,
      fillAmount,
      takerAddress,
    }
    
    return apiClient.authorizeFill(request)
  }

  // Order Creation
  static async publishOrder(
    order: OrderData,
    signature: string,
    metadata: OrderMetadata,
    secrets: SecretParameters,
    chainId = 1,
    extension?: string
  ): Promise<PublishedOrder> {
    const request: CreateOrderRequest = {
      chainId,
      order,
      signature,
      extension,
      metadata,
      secrets,
    }
    
    return apiClient.createOrder(request)
  }

  // Order Status Updates
  static async markOrderFilled(orderId: string, txHash: string): Promise<void> {
    const request: UpdateOrderStatusRequest = {
      status: 'filled' as OrderStatus,
      txHash,
    }
    
    await apiClient.updateOrderStatus(orderId, request)
  }

  static async markOrderCancelled(orderId: string, txHash?: string): Promise<void> {
    const request: UpdateOrderStatusRequest = {
      status: 'cancelled' as OrderStatus,
      txHash,
    }
    
    await apiClient.updateOrderStatus(orderId, request)
  }

  // Order Queries
  static async getOrderById(orderId: string): Promise<PublishedOrder> {
    return apiClient.getOrderById(orderId)
  }

  static async getOrdersByMaker(makerAddress: Address, limit = 10): Promise<PublishedOrder[]> {
    const params: OrdersQueryParams = {
      maker: makerAddress,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }
    
    return apiClient.getOrders(params)
  }

  // Search and Filtering
  static async searchOrders(searchParams: {
    network?: string
    makerAsset?: Address
    takerAsset?: Address
    maker?: Address
    status?: OrderStatus
    minAmount?: string
    maxAmount?: string
  }): Promise<PublishedOrder[]> {
    const params: OrdersQueryParams = {
      network: searchParams.network,
      maker: searchParams.maker,
      makerAsset: searchParams.makerAsset,
      takerAsset: searchParams.takerAsset,
      status: searchParams.status,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 50,
    }
    
    const orders = await apiClient.getOrders(params)
    
    // Client-side filtering for amount ranges (if needed)
    if (searchParams.minAmount || searchParams.maxAmount) {
      return orders.filter(order => {
        const makingAmount = BigInt(order.order.makingAmount)
        
        if (searchParams.minAmount && makingAmount < BigInt(searchParams.minAmount)) {
          return false
        }
        
        if (searchParams.maxAmount && makingAmount > BigInt(searchParams.maxAmount)) {
          return false
        }
        
        return true
      })
    }
    
    return orders
  }

  // Utility methods for order analysis
  static calculateOrderRate(order: PublishedOrder): number {
    const makingAmount = Number(order.order.makingAmount)
    const takingAmount = Number(order.order.takingAmount)
    
    return takingAmount / makingAmount
  }

  static formatOrderForDisplay(order: PublishedOrder): {
    id: string
    makerToken: string
    takerToken: string
    makingAmount: string
    takingAmount: string
    rate: number
    status: OrderStatus
    createdAt: Date
  } {
    return {
      id: order.id,
      makerToken: order.metadata.makerToken.symbol,
      takerToken: order.metadata.takerToken.symbol,
      makingAmount: order.order.makingAmount,
      takingAmount: order.order.takingAmount,
      rate: this.calculateOrderRate(order),
      status: order.status,
      createdAt: new Date(order.createdAt),
    }
  }
}

// Export the static class for convenience
export const ordersAPI = OrdersAPI 