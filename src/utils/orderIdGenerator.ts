/**
 * Order ID generation utilities for DarkSwap
 */

/**
 * Generates a unique order ID with timestamp and random components
 * Format: order_<timestamp>_<random>
 */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36); // Base36 timestamp
  const random = Math.random().toString(36).substring(2, 8); // 6-char random string
  return `order_${timestamp}_${random}`;
}

/**
 * Generates a commitment-based order ID for consistent identification
 * Format: order_<commitment_prefix>_<random>
 */
export function generateCommitmentOrderId(commitment: string): string {
  const commitmentPrefix = commitment.slice(-8); // Last 8 chars of commitment
  const random = Math.random().toString(36).substring(2, 6); // 4-char random string
  return `order_${commitmentPrefix}_${random}`;
}

/**
 * Validates order ID format
 */
export function validateOrderId(orderId: string): boolean {
  const pattern = /^order_[a-z0-9]+_[a-z0-9]+$/;
  return pattern.test(orderId);
}

/**
 * Extracts timestamp from order ID (if generated with generateOrderId)
 */
export function extractTimestampFromOrderId(orderId: string): Date | null {
  try {
    const parts = orderId.split('_');
    if (parts.length >= 2) {
      const timestamp = parseInt(parts[1], 36);
      return new Date(timestamp);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a batch of unique order IDs
 */
export function generateBatchOrderIds(count: number): string[] {
  const ids = new Set<string>();
  
  while (ids.size < count) {
    ids.add(generateOrderId());
  }
  
  return Array.from(ids);
}

/**
 * Order ID metadata interface
 */
export interface OrderIdMetadata {
  id: string;
  generated: Date;
  format: 'timestamp' | 'commitment';
  valid: boolean;
}

/**
 * Analyzes an order ID and returns metadata
 */
export function analyzeOrderId(orderId: string): OrderIdMetadata {
  const valid = validateOrderId(orderId);
  const timestamp = extractTimestampFromOrderId(orderId);
  
  return {
    id: orderId,
    generated: timestamp || new Date(),
    format: timestamp ? 'timestamp' : 'commitment',
    valid
  };
} 