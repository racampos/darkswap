/**
 * HTTP client utilities for DarkSwap API communication
 */

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface AuthorizeRequest {
  orderHash: string;
  fillAmount: string; // BigInt as string for JSON
  takerAddress: string;
}

export interface AuthorizeResponse {
  success: boolean;
  orderWithExtension?: any;
  signature?: string;
  error?: string;
  timestamp: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  network: string;
  version: string;
}

/**
 * HTTP client for DarkSwap API interactions
 */
export class DarkSwapAPIClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl: string, timeout: number = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
  }

  /**
   * Check API health
   */
  async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await this.makeRequest('GET', '/api/health');
      return response.data || response;
    } catch (error) {
      throw new Error(`Health check failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Request fill authorization from maker service
   */
  async authorizeFill(orderHash: string, fillAmount: bigint, takerAddress: string): Promise<AuthorizeResponse> {
    try {
      const request: AuthorizeRequest = {
        orderHash,
        fillAmount: fillAmount.toString(),
        takerAddress
      };

      const response = await this.makeRequest('POST', '/api/authorize-fill', request);
      
      if (!response.success) {
        throw new Error(response.error || 'Authorization failed');
      }

      return response;
    } catch (error) {
      throw new Error(`Authorization request failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Get active orders from API
   */
  async getActiveOrders(network?: string): Promise<any[]> {
    try {
      const endpoint = network ? `/api/orders/active/${network}` : '/api/orders';
      const response = await this.makeRequest('GET', endpoint);
      return response.data?.orders || response.orders || [];
    } catch (error) {
      throw new Error(`Failed to fetch orders: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Get specific order by ID
   */
  async getOrderById(orderId: string): Promise<any> {
    try {
      const response = await this.makeRequest('GET', `/api/orders/${orderId}`);
      return response.data || response;
    } catch (error) {
      throw new Error(`Failed to fetch order: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Core HTTP request method using Node.js built-in fetch (Node 18+)
   */
  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DarkSwap-Taker/1.0'
      }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    options.signal = controller.signal;

    try {
      console.log(`   📡 ${method} ${url}`);
      if (body) {
        console.log(`   📤 Request:`, JSON.stringify(body, null, 2));
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      const responseText = await response.text();
      console.log(`   📥 Response (${response.status}):`, responseText.slice(0, 200) + (responseText.length > 200 ? '...' : ''));

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Use status text if response is not JSON
        }
        throw new Error(errorMessage);
      }

      try {
        const data = JSON.parse(responseText);
        return data;
      } catch {
        // Return raw text if not JSON
        return { data: responseText };
      }

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    if (error?.error) {
      return error.error;
    }
    
    return 'Unknown error occurred';
  }

  /**
   * Test connection to the API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.checkHealth();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get base URL for reference
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get timeout setting
   */
  getTimeout(): number {
    return this.timeout;
  }
}

/**
 * Create a DarkSwap API client instance
 */
export function createAPIClient(baseUrl: string, timeout?: number): DarkSwapAPIClient {
  return new DarkSwapAPIClient(baseUrl, timeout);
}

/**
 * Default API client instance
 */
export const defaultAPIClient = createAPIClient('http://localhost:3000');

/**
 * Utility function to validate API response
 */
export function validateAPIResponse<T>(response: any): APIResponse<T> {
  if (typeof response !== 'object' || response === null) {
    throw new Error('Invalid API response format');
  }

  return {
    success: response.success === true,
    data: response.data,
    error: response.error,
    timestamp: response.timestamp || new Date().toISOString()
  };
} 