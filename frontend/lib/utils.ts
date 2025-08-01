import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number to a human readable string with commas
 */
export function formatNumber(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num)
}

/**
 * Format a BigInt value to a human readable string
 */
export function formatBigInt(value: bigint, decimals: number = 18, displayDecimals: number = 4): string {
  const divisor = BigInt(10 ** decimals)
  const quotient = value / divisor
  const remainder = value % divisor
  
  const remainderStr = remainder.toString().padStart(decimals, '0')
  const trimmedRemainder = remainderStr.substring(0, displayDecimals).replace(/0+$/, '')
  
  if (trimmedRemainder) {
    return `${quotient.toString()}.${trimmedRemainder}`
  }
  
  return quotient.toString()
}

/**
 * Truncate an Ethereum address
 */
export function truncateAddress(address: string, startLength: number = 6, endLength: number = 4): string {
  if (!address) return ''
  if (address.length <= startLength + endLength) return address
  
  return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`
}

/**
 * Truncate a hash (transaction hash, order hash, etc.)
 */
export function truncateHash(hash: string, length: number = 8): string {
  if (!hash) return ''
  if (hash.length <= length) return hash
  
  return `${hash.substring(0, length)}...`
}

/**
 * Format time ago from timestamp
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    return false
  }
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = function() {
      timeout = null
      if (!immediate) func(...args)
    }
    
    const callNow = immediate && !timeout
    
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    
    if (callNow) func(...args)
  }
} 