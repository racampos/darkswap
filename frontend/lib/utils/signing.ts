import { signTypedData } from '@wagmi/core'
import { type OrderStruct } from '../contracts/commitmentOrders'

/**
 * EIP-712 domain and types for 1inch order signing
 */
export const ORDER_DOMAIN = {
  name: 'AggregationRouter',
  version: '6',
  // chainId and verifyingContract will be set dynamically
} as const

export const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'makerAsset', type: 'address' },
    { name: 'takerAsset', type: 'address' },
    { name: 'makingAmount', type: 'uint256' },
    { name: 'takingAmount', type: 'uint256' },
    { name: 'makerTraits', type: 'uint256' },
  ],
} as const

/**
 * Sign a commitment order using EIP-712
 */
export async function signCommitmentOrder(
  order: OrderStruct,
  chainId: number,
  routerAddress: `0x${string}`,
  config: any // wagmi config
): Promise<string> {
  try {
    console.log('🔐 Starting order signing process...', {
      chainId,
      routerAddress,
      order: {
        salt: order.salt.toString(),
        maker: order.maker,
        receiver: order.receiver,
        makerAsset: order.makerAsset,
        takerAsset: order.takerAsset,
        makingAmount: order.makingAmount.toString(),
        takingAmount: order.takingAmount.toString(),
        makerTraits: order.makerTraits.toString(),
      }
    })

    const domain = {
      ...ORDER_DOMAIN,
      chainId,
      verifyingContract: routerAddress,
    }

    console.log('🔐 Prepared signing domain:', domain)

    const signature = await signTypedData({
      domain,
      types: ORDER_TYPES,
      primaryType: 'Order' as const,
      message: {
        salt: order.salt,
        maker: order.maker,
        receiver: order.receiver,
        makerAsset: order.makerAsset,
        takerAsset: order.takerAsset,
        makingAmount: order.makingAmount,
        takingAmount: order.takingAmount,
        makerTraits: order.makerTraits,
      },
    })

    console.log('✅ Order signed successfully:', {
      signature: signature.slice(0, 10) + '...' + signature.slice(-8),
      length: signature.length
    })

    return signature
  } catch (error) {
    console.error('❌ Failed to sign order:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : 'No stack trace',
      chainId,
      routerAddress,
      orderSalt: order.salt.toString()
    })
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('User rejected')) {
        throw new Error('User rejected the signing request')
      } else if (error.message.includes('network')) {
        throw new Error(`Network error during signing: ${error.message}`)
      } else if (error.message.includes('chain')) {
        throw new Error(`Chain configuration error: ${error.message}`)
      }
    }
    
    throw new Error(`Order signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Calculate the order hash for EIP-712 typed data
 */
export function calculateOrderHash(
  order: OrderStruct,
  chainId: number,
  routerAddress: `0x${string}`
): string {
  // This is a simplified version - in production, you'd use the actual EIP-712 hash calculation
  const domain = {
    ...ORDER_DOMAIN,
    chainId,
    verifyingContract: routerAddress,
  }

  // Convert BigInt values to strings for JSON serialization
  const serializableOrder = {
    salt: order.salt.toString(),
    maker: order.maker,
    receiver: order.receiver,
    makerAsset: order.makerAsset,
    takerAsset: order.takerAsset,
    makingAmount: order.makingAmount.toString(),
    takingAmount: order.takingAmount.toString(),
    makerTraits: order.makerTraits.toString(),
  }

  // For now, return a simple hash representation
  // In production, this should use the proper EIP-712 encoding
  const orderString = JSON.stringify({
    domain,
    types: ORDER_TYPES,
    primaryType: 'Order',
    message: serializableOrder,
  })

  return hashString(orderString)
}

/**
 * Simple string hashing function
 */
function hashString(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`
}

/**
 * Validate signature format
 */
export function validateSignature(signature: string): {
  isValid: boolean
  error?: string
} {
  if (!signature) {
    return { isValid: false, error: 'Signature is required' }
  }

  if (!signature.startsWith('0x')) {
    return { isValid: false, error: 'Signature must start with 0x' }
  }

  if (signature.length !== 132) {
    return { isValid: false, error: 'Signature must be 132 characters long (including 0x)' }
  }

  return { isValid: true }
}

/**
 * Format signature for display
 */
export function formatSignature(signature: string): string {
  if (signature.length <= 10) return signature
  return `${signature.slice(0, 10)}...${signature.slice(-8)}`
} 