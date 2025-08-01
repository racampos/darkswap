import { 
  type APIResponse,
  type AuthorizeFillRequest,
  type AuthorizeFillResponse,
  type CreateOrderRequest,
  type UpdateOrderStatusRequest,
  type PublishedOrder,
  type OrdersQueryParams,
  type ActiveOrdersQueryParams,
  type APIError
} from './types'

export class DarkSwapAPIClient {
  private baseURL: string
  private timeout: number

  constructor(baseURL?: string, timeout = 10000) {
    this.baseURL = baseURL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'
    this.timeout = timeout
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData: APIError = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
          code: response.status,
        }))
        
        throw new Error(errorData.error || `Request failed with status ${response.status}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout')
        }
        throw error
      }
      
      throw new Error('Unknown error occurred')
    }
  }

  // Simple health check using the orders endpoint
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    try {
      await this.makeRequest<PublishedOrder[]>('/api/orders?limit=1')
      return { 
        status: 'healthy', 
        timestamp: Date.now() 
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        timestamp: Date.now() 
      }
    }
  }

  // Order Authorization
  async authorizeFill(request: AuthorizeFillRequest): Promise<AuthorizeFillResponse> {
    const response = await this.makeRequest<AuthorizeFillResponse>('/api/authorize-fill', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return response.data!
  }

  // Order Management
  async createOrder(request: CreateOrderRequest): Promise<PublishedOrder> {
    const response = await this.makeRequest<PublishedOrder>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return response.data!
  }

  async getOrders(params?: OrdersQueryParams): Promise<PublishedOrder[]> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value))
        }
      })
    }

    const endpoint = `/api/orders${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    const response = await this.makeRequest<{
      success: boolean
      orders: any[]
      pagination: any
      filters: any
      timestamp: string
    }>(endpoint)
    
    // Extract the orders array from the nested response and transform to expected format
    const orders = response.data?.orders || []
    return orders.map(order => ({
      id: order.id,
      chainId: 31337, // Default for localhost
      order: order.orderData, // Map orderData to order
      signature: order.signature,
      extension: order.orderData?.extension || '',
      metadata: {
        ...order.metadata,
        makerToken: {
          address: order.orderData?.makerAsset || order.metadata?.makerAsset,
          symbol: order.orderData?.makerAsset === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' ? 'WETH' : 'UNKNOWN',
          name: order.orderData?.makerAsset === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' ? 'Wrapped Ether' : 'Unknown Token',
          decimals: order.orderData?.makerAsset === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' ? 18 : 18,
        },
        takerToken: {
          address: order.orderData?.takerAsset || order.metadata?.takerAsset,
          symbol: order.orderData?.takerAsset === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 'USDC' : 'UNKNOWN',
          name: order.orderData?.takerAsset === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 'USD Coin' : 'Unknown Token',
          decimals: order.orderData?.takerAsset === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 6 : 18,
        },
      },
      secrets: order.secrets,
      status: order.metadata?.status || 'active',
      createdAt: order.metadata?.published ? new Date(order.metadata.published).getTime() : Date.now(),
      updatedAt: order.metadata?.published ? new Date(order.metadata.published).getTime() : Date.now(),
    }))
  }

  async getOrderById(orderId: string): Promise<PublishedOrder> {
    const response = await this.makeRequest<{
      success: boolean
      order: any
      timestamp: string
    }>(`/api/orders/${orderId}`)
    
    const order = response.data?.order
    if (!order) {
      throw new Error('Order not found')
    }
    
    // Transform to expected format
    return {
      id: order.id,
      chainId: 31337, // Default for localhost
      order: order.orderData, // Map orderData to order
      signature: order.signature,
      extension: order.orderData?.extension || '',
      metadata: {
        ...order.metadata,
        makerToken: {
          address: order.orderData?.makerAsset || order.metadata?.makerAsset,
          symbol: order.orderData?.makerAsset === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' ? 'WETH' : 'UNKNOWN',
          name: order.orderData?.makerAsset === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' ? 'Wrapped Ether' : 'Unknown Token',
          decimals: order.orderData?.makerAsset === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' ? 18 : 18,
        },
        takerToken: {
          address: order.orderData?.takerAsset || order.metadata?.takerAsset,
          symbol: order.orderData?.takerAsset === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 'USDC' : 'UNKNOWN',
          name: order.orderData?.takerAsset === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 'USD Coin' : 'Unknown Token',
          decimals: order.orderData?.takerAsset === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 6 : 18,
        },
      },
      secrets: order.secrets,
      status: order.metadata?.status || 'active',
      createdAt: order.metadata?.published ? new Date(order.metadata.published).getTime() : Date.now(),
      updatedAt: order.metadata?.published ? new Date(order.metadata.published).getTime() : Date.now(),
    }
  }

  async getActiveOrders(params: ActiveOrdersQueryParams): Promise<PublishedOrder[]> {
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && key !== 'network') {
        searchParams.append(key, String(value))
      }
    })

    const endpoint = `/api/orders/active/${params.network}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    const response = await this.makeRequest<{
      success: boolean
      orders: any[]
      network: string
      count: number
      timestamp: string
    }>(endpoint)
    
    // Extract the orders array from the nested response and transform to expected format
    const orders = response.data?.orders || []
    return orders.map(order => ({
      id: order.id,
      chainId: 31337, // Default for localhost
      order: order.orderData, // Map orderData to order
      signature: order.signature,
      extension: order.orderData?.extension || '',
      metadata: {
        ...order.metadata,
        makerToken: {
          address: order.orderData?.makerAsset || order.metadata?.makerAsset,
          symbol: order.orderData?.makerAsset === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' ? 'WETH' : 'UNKNOWN',
          name: order.orderData?.makerAsset === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' ? 'Wrapped Ether' : 'Unknown Token',
          decimals: order.orderData?.makerAsset === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' ? 18 : 18,
        },
        takerToken: {
          address: order.orderData?.takerAsset || order.metadata?.takerAsset,
          symbol: order.orderData?.takerAsset === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 'USDC' : 'UNKNOWN',
          name: order.orderData?.takerAsset === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 'USD Coin' : 'Unknown Token',
          decimals: order.orderData?.takerAsset === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 6 : 18,
        },
      },
      secrets: order.secrets,
      status: order.metadata?.status || 'active',
      createdAt: order.metadata?.published ? new Date(order.metadata.published).getTime() : Date.now(),
      updatedAt: order.metadata?.published ? new Date(order.metadata.published).getTime() : Date.now(),
    }))
  }

  async updateOrderStatus(orderId: string, request: UpdateOrderStatusRequest): Promise<void> {
    await this.makeRequest(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    })
  }

  // Utility methods
  setTimeout(timeout: number): void {
    this.timeout = timeout
  }

  getBaseURL(): string {
    return this.baseURL
  }

  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL
  }
}

// Create a default instance
export const apiClient = new DarkSwapAPIClient() 