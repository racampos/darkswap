/**
 * Frontend commitment calculation utilities
 */

// Import the same poseidon-lite library used by the backend
const { poseidon3 } = require("poseidon-lite");

/**
 * Calculate Poseidon commitment from secret parameters
 * This MUST match the ZK circuit's commitment calculation exactly
 * Uses the same poseidon3([secretPrice, secretAmount, nonce]) as the backend
 */
export function calculateCommitment(
  secretPrice: bigint,
  secretAmount: bigint,
  nonce: bigint
): string {
  try {
    // Use the EXACT same Poseidon3 calculation as the backend
    // This matches: poseidon3([secretPrice, secretAmount, nonce]) in src/utils/commitmentUtils.ts
    const commitment = poseidon3([secretPrice, secretAmount, nonce]);
    
    // Return as string to match the backend interface
    return commitment.toString();
  } catch (error) {
    console.error('Error calculating Poseidon commitment:', error);
    throw new Error(`Failed to calculate commitment: ${error}`);
  }
}

/**
 * Simple hash function for commitment calculation fallback
 */
function simpleHash(input: string): string {
  let hash = BigInt(0)
  for (let i = 0; i < input.length; i++) {
    const charCode = BigInt(input.charCodeAt(i))
    hash = ((hash << BigInt(5)) - hash + charCode) & BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  }
  return hash.toString()
}

/**
 * Validate secret parameters
 */
export function validateSecretParameters(
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