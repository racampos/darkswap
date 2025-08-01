import { formatUnits, parseUnits } from 'viem'

/**
 * Token formatting utilities
 */

export interface TokenInfo {
  symbol: string
  decimals: number
  address: `0x${string}`
}

// Common token configurations
export const TOKENS: Record<string, TokenInfo> = {
  WETH: {
    symbol: 'WETH',
    decimals: 18,
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  USDC: {
    symbol: 'USDC',
    decimals: 6,
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  },
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number = 18,
  precision: number = 4
): string {
  const formatted = formatUnits(amount, decimals)
  const num = parseFloat(formatted)
  
  if (num === 0) return '0'
  if (num < 0.0001) return '< 0.0001'
  
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  })
}

/**
 * Parse token amount from string input
 */
export function parseTokenAmount(
  value: string,
  decimals: number = 18
): bigint {
  try {
    return parseUnits(value, decimals)
  } catch (error) {
    throw new Error(`Invalid amount format: ${value}`)
  }
}

/**
 * Format price/exchange rate
 */
export function formatPrice(
  makingAmount: bigint,
  takingAmount: bigint,
  makingDecimals: number = 18,
  takingDecimals: number = 6,
  precision: number = 2
): string {
  const makingFormatted = parseFloat(formatUnits(makingAmount, makingDecimals))
  const takingFormatted = parseFloat(formatUnits(takingAmount, takingDecimals))
  
  if (makingFormatted === 0) return '0'
  
  const price = takingFormatted / makingFormatted
  
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  })
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, precision: number = 2): string {
  return `${value.toFixed(precision)}%`
}

/**
 * Format duration in human readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
  
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return `${days}d ${hours}h`
}

/**
 * Format address for display
 */
export function formatAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4
): string {
  if (!address) return ''
  if (address.length <= startLength + endLength) return address
  
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`
}

/**
 * Format hash for display
 */
export function formatHash(hash: string): string {
  return formatAddress(hash, 8, 6)
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Format currency value
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  precision: number = 2
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value)
}

/**
 * Get token info by address
 */
export function getTokenInfo(address: string): TokenInfo | undefined {
  return Object.values(TOKENS).find(
    token => token.address.toLowerCase() === address.toLowerCase()
  )
}

/**
 * Validate token amount input
 */
export function validateTokenAmount(
  value: string,
  maxDecimals: number = 18
): {
  isValid: boolean
  error?: string
} {
  if (!value || value.trim() === '') {
    return { isValid: false, error: 'Amount is required' }
  }

  const num = parseFloat(value)
  if (isNaN(num) || num <= 0) {
    return { isValid: false, error: 'Amount must be a positive number' }
  }

  const decimalPlaces = (value.split('.')[1] || '').length
  if (decimalPlaces > maxDecimals) {
    return { isValid: false, error: `Too many decimal places (max: ${maxDecimals})` }
  }

  return { isValid: true }
} 