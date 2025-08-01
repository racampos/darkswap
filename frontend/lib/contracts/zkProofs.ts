/**
 * ZK Proof types and utilities for the frontend
 */

export interface ZKProofStatus {
  status: 'idle' | 'generating' | 'success' | 'error'
  proof?: string
  error?: string
  timestamp?: number
}

export interface AuthorizeRequestParams {
  orderHash: string
  fillAmount: bigint
  takerAddress: `0x${string}`
}

export interface AuthorizeResponse {
  success: boolean
  orderWithExtension?: any
  signature?: string
  error?: string
}

/**
 * Generate a ZK authorization request for order filling
 * This is handled by the backend API service
 */
export async function requestFillAuthorization(
  params: AuthorizeRequestParams,
  apiBaseUrl: string = 'http://localhost:3000'
): Promise<AuthorizeResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/authorize-fill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderHash: params.orderHash,
        fillAmount: params.fillAmount.toString(),
        takerAddress: params.takerAddress,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Authorization failed: ${response.status}`)
    }

    const data = await response.json()
    return {
      success: true,
      orderWithExtension: data.orderWithExtension,
      signature: data.signature,
    }
  } catch (error) {
    console.error('Authorization request failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Monitor ZK proof generation status
 */
export class ZKProofMonitor {
  private listeners: ((status: ZKProofStatus) => void)[] = []
  private currentStatus: ZKProofStatus = { status: 'idle' }

  subscribe(listener: (status: ZKProofStatus) => void) {
    this.listeners.push(listener)
    // Immediately call with current status
    listener(this.currentStatus)
    
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notify(status: ZKProofStatus) {
    this.currentStatus = status
    this.listeners.forEach(listener => listener(status))
  }

  async generateProof(params: AuthorizeRequestParams, apiBaseUrl?: string): Promise<AuthorizeResponse> {
    this.notify({ status: 'generating', timestamp: Date.now() })

    try {
      const result = await requestFillAuthorization(params, apiBaseUrl)
      
      if (result.success) {
        this.notify({ 
          status: 'success', 
          proof: result.signature,
          timestamp: Date.now() 
        })
      } else {
        this.notify({ 
          status: 'error', 
          error: result.error,
          timestamp: Date.now() 
        })
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.notify({ 
        status: 'error', 
        error: errorMessage,
        timestamp: Date.now() 
      })
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  reset() {
    this.notify({ status: 'idle' })
  }

  getCurrentStatus(): ZKProofStatus {
    return this.currentStatus
  }
}

/**
 * Estimate ZK proof generation time (mock implementation)
 */
export function estimateProofTime(fillAmount: bigint): number {
  // Mock estimation based on fill amount
  // In reality, this would depend on the complexity of the constraints
  const baseTime = 2000 // 2 seconds base
  const amountFactor = Number(fillAmount.toString()) / 1000000000000000000 // Factor based on amount (1e18)
  return Math.max(baseTime, baseTime + amountFactor * 100)
}

/**
 * Validate ZK proof parameters
 */
export function validateZKProofParams(params: AuthorizeRequestParams): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!params.orderHash || params.orderHash.length !== 66) {
    errors.push("Invalid order hash format")
  }

  if (params.fillAmount <= BigInt(0)) {
    errors.push("Fill amount must be positive")
  }

  if (!params.takerAddress || params.takerAddress.length !== 42) {
    errors.push("Invalid taker address format")
  }

  return {
    isValid: errors.length === 0,
    errors
  }
} 