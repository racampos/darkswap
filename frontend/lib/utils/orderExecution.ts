'use client'

import { type Address } from 'viem'
import { type PublishedOrder, type AuthorizeFillResponse } from '@/lib/api/types'
import { type OrderData } from '@/types'

/**
 * Normalizes order data to ensure all required fields are present
 */
export function normalizeOrderData(order: PublishedOrder): PublishedOrder {
  // Calculate rate if missing or invalid
  let rate = order.metadata?.rate
  if (!rate || typeof rate !== 'number' || isNaN(rate) || rate <= 0) {
    try {
      const makingAmountWei = Number(order.order.makingAmount)
      const takingAmountWei = Number(order.order.takingAmount)
      
      // Get token decimals (default to 18 for WETH, 6 for USDC-like tokens)
      const makerDecimals = order.metadata.makerToken?.decimals || 18
      const takerDecimals = order.metadata.takerToken?.decimals || 6
      
      if (makingAmountWei > 0 && takingAmountWei > 0) {
        // Convert to human-readable amounts
        const makingAmount = makingAmountWei / Math.pow(10, makerDecimals)
        const takingAmount = takingAmountWei / Math.pow(10, takerDecimals)
        
        // Calculate rate as takerToken per makerToken (e.g., USDC per WETH)
        rate = takingAmount / makingAmount
      } else {
        rate = 1 // Default rate
      }
    } catch (error) {
      console.warn('Failed to calculate rate, using default:', error)
      rate = 1
    }
  }

  return {
    ...order,
    metadata: {
      ...order.metadata,
      rate,
      makerToken: order.metadata.makerToken || { address: '0x', symbol: 'TOKEN', name: 'Token', decimals: 18 },
      takerToken: order.metadata.takerToken || { address: '0x', symbol: 'TOKEN', name: 'Token', decimals: 18 }
    }
  }
}

/**
 * Validates the requested fill amount against order constraints
 */
export interface FillValidation {
  isValid: boolean
  error?: string
  maxAmount?: bigint
  suggestedAmount?: bigint
}

/**
 * Validates the requested fill amount against order constraints
 */
export function validateFillAmount(
  order: PublishedOrder,
  requestedAmount: string
): FillValidation {
  try {
    const amount = BigInt(requestedAmount || '0')
    const maxAmount = BigInt(order.order.takingAmount)
    
    if (amount <= BigInt(0)) {
      return {
        isValid: false,
        error: 'Fill amount must be greater than 0',
        maxAmount
      }
    }
    
    if (amount > maxAmount) {
      // Convert maxAmount to human-readable for error message
      const takerDecimals = order.metadata.takerToken?.decimals || 6
      const maxAmountHuman = Number(maxAmount) / Math.pow(10, takerDecimals)
      const tokenSymbol = order.metadata.takerToken?.symbol || 'TOKEN'
      
      return {
        isValid: false,
        error: `Fill amount exceeds maximum (${maxAmountHuman.toFixed(4)} ${tokenSymbol})`,
        maxAmount,
        suggestedAmount: maxAmount
      }
    }
    
    return {
      isValid: true,
      maxAmount
    }
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid fill amount format',
      maxAmount: BigInt(order.order.takingAmount)
    }
  }
}

/**
 * Calculates the estimated output amount for a given fill amount
 */
export function calculateOutputAmount(
  order: PublishedOrder,
  fillAmount: string
): {
  outputAmount: bigint
  rate: number
  priceImpact: number
} {
  try {
    const fillAmountBN = BigInt(fillAmount || '0')
    const makingAmount = BigInt(order.order.makingAmount)
    const takingAmount = BigInt(order.order.takingAmount)
    
    // Calculate proportional output
    const outputAmount = (fillAmountBN * makingAmount) / takingAmount
    
    // Calculate rate using human-readable amounts (accounting for token decimals)
    const makerDecimals = order.metadata.makerToken?.decimals || 18
    const takerDecimals = order.metadata.takerToken?.decimals || 6
    
    const makingAmountHuman = Number(makingAmount) / Math.pow(10, makerDecimals)
    const takingAmountHuman = Number(takingAmount) / Math.pow(10, takerDecimals)
    
    // Rate = takerTokens per makerToken (e.g., USDC per WETH)
    const rate = takingAmountHuman / makingAmountHuman
    
    // For limit orders, price impact is typically 0
    const priceImpact = 0
    
    return {
      outputAmount,
      rate,
      priceImpact
    }
  } catch (error) {
    return {
      outputAmount: BigInt(0),
      rate: 0,
      priceImpact: 0
    }
  }
}

/**
 * Estimates gas cost for order execution
 */
export function estimateGasCost(
  order: PublishedOrder,
  fillAmount: string
): {
  estimatedGas: bigint
  estimatedCostWei: bigint
  estimatedCostEth: string
} {
  // Base gas estimates for 1inch limit order execution
  const baseGas = BigInt(150000)
  const zkProofGas = BigInt(50000)
  
  const estimatedGas = baseGas + zkProofGas
  
  // Use a reasonable gas price estimate (20 gwei)
  const gasPriceWei = BigInt(20000000000)
  const estimatedCostWei = estimatedGas * gasPriceWei
  const estimatedCostEth = (Number(estimatedCostWei) / 1e18).toFixed(6)
  
  return {
    estimatedGas,
    estimatedCostWei,
    estimatedCostEth
  }
}

/**
 * Formats order execution parameters for display
 */
export function formatExecutionSummary(
  order: PublishedOrder,
  fillAmount: string
) {
  const validation = validateFillAmount(order, fillAmount)
  const output = calculateOutputAmount(order, fillAmount)
  const gasCost = estimateGasCost(order, fillAmount)
  
  return {
    validation,
    output,
    gasCost,
    order: {
      id: order.id,
      maker: order.order.maker,
      makerToken: order.metadata.makerToken,
      takerToken: order.metadata.takerToken,
      rate: order.metadata.rate
    }
  }
}

/**
 * Checks if the current user can fill the order
 */
export function canFillOrder(
  order: PublishedOrder,
  userAddress?: Address
): {
  canFill: boolean
  reason?: string
} {
  if (!userAddress) {
    return {
      canFill: false,
      reason: 'Wallet not connected'
    }
  }
  
  if (order.order.maker.toLowerCase() === userAddress.toLowerCase()) {
    return {
      canFill: false,
      reason: 'Cannot fill your own order'
    }
  }
  
  if (order.status !== 'active') {
    return {
      canFill: false,
      reason: `Order is ${order.status}`
    }
  }
  
  return {
    canFill: true
  }
} 