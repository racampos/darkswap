/**
 * Frontend commitment calculation utilities
 */

/**
 * Calculate Poseidon commitment from secret parameters
 * Note: This is a frontend implementation that communicates with the backend
 * for the actual Poseidon hash calculation
 */
export function calculateCommitment(
  secretPrice: bigint,
  secretAmount: bigint,
  nonce: bigint
): string {
  // For now, we'll use a simple hash function
  // In production, this would call the backend for Poseidon hash calculation
  // or use a WebAssembly implementation of Poseidon
  
  const values = [
    secretPrice.toString(),
    secretAmount.toString(),
    nonce.toString()
  ].join('|')
  
  // Simple hash for demonstration - replace with actual Poseidon
  const hash = simpleHash(values)
  return hash
}

/**
 * Simple hash function for commitment calculation
 * This should be replaced with actual Poseidon hash
 */
function simpleHash(input: string): string {
  let hash = BigInt(0)
  for (let i = 0; i < input.length; i++) {
    const charCode = BigInt(input.charCodeAt(i))
    hash = ((hash << BigInt(5)) - hash + charCode) & ((BigInt(1) << BigInt(256)) - BigInt(1))
  }
  return hash.toString()
}

/**
 * Validate commitment parameters
 */
export function validateCommitmentParams(
  secretPrice: bigint,
  secretAmount: bigint,
  nonce: bigint
): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (secretPrice <= BigInt(0)) {
    errors.push("Secret price must be positive")
  }

  if (secretAmount <= BigInt(0)) {
    errors.push("Secret amount must be positive")
  }

  if (nonce <= BigInt(0)) {
    errors.push("Nonce must be positive")
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Generate a random nonce for commitment
 */
export function generateNonce(): bigint {
  const randomValue = Math.floor(Math.random() * 1000000000) + Date.now()
  return BigInt(randomValue)
}

/**
 * Format commitment for display
 */
export function formatCommitment(commitment: string): string {
  if (commitment.length <= 10) return commitment
  return `${commitment.slice(0, 6)}...${commitment.slice(-4)}`
}

/**
 * Verify commitment against secret parameters
 */
export function verifyCommitment(
  commitment: string,
  secretPrice: bigint,
  secretAmount: bigint,
  nonce: bigint
): boolean {
  const calculatedCommitment = calculateCommitment(secretPrice, secretAmount, nonce)
  return commitment === calculatedCommitment
} 