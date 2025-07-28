import { randomBytes } from "crypto";
const { poseidon3 } = require("poseidon-lite");

/**
 * Core commitment system for ZK-enabled orders
 * 
 * This module provides utilities for creating cryptographic commitments that hide
 * maker's secret price and amount thresholds while allowing zero-knowledge proofs
 * to verify that taker's offers satisfy these hidden constraints.
 */

/**
 * Secret parameters that makers want to hide
 */
export interface SecretParameters {
  secretPrice: bigint;    // Maker's minimum acceptable price per unit
  secretAmount: bigint;   // Maker's minimum acceptable amount
  nonce: bigint;         // Random value for commitment uniqueness
}

/**
 * Commitment data structure
 */
export interface CommitmentData {
  commitment: bigint;     // The computed commitment value
  secretParams: SecretParameters;  // Original secret parameters (for proof generation)
}

/**
 * Validation result for commitment operations
 */
export interface CommitmentValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Configuration constants for commitment system
 */
export const COMMITMENT_CONSTANTS = {
  // Maximum safe values to prevent overflow in circuits
  MAX_PRICE: BigInt(2 ** 64 - 1),        // Max 64-bit price
  MAX_AMOUNT: BigInt(2 ** 64 - 1),       // Max 64-bit amount  
  MAX_NONCE: BigInt(2 ** 64 - 1),        // Max 64-bit nonce
  
  // Minimum values for meaningful trades
  MIN_PRICE: BigInt(1),                  // Minimum 1 wei price
  MIN_AMOUNT: BigInt(1),                 // Minimum 1 wei amount
  MIN_NONCE: BigInt(0),                  // Allow zero nonce
  
  // Nonce generation
  NONCE_BYTES: 8,                        // 64-bit nonce = 8 bytes
} as const;

/**
 * Generates a cryptographically secure random nonce
 * @returns Random 64-bit nonce for commitment uniqueness
 */
export function generateNonce(): bigint {
  const bytes = randomBytes(COMMITMENT_CONSTANTS.NONCE_BYTES);
  // Convert bytes to bigint, ensuring it fits in 64-bit range
  let nonce = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    nonce = (nonce << BigInt(8)) + BigInt(bytes[i]);
  }
  // Ensure we don't exceed MAX_NONCE
  return nonce % (COMMITMENT_CONSTANTS.MAX_NONCE + BigInt(1));
}

/**
 * Validates secret parameters for commitment calculation
 * @param params Secret parameters to validate
 * @returns Validation result with errors if any
 */
export function validateSecretParameters(params: SecretParameters): CommitmentValidationResult {
  const errors: string[] = [];
  
  // Validate price range
  if (params.secretPrice < COMMITMENT_CONSTANTS.MIN_PRICE) {
    errors.push(`Secret price too low: ${params.secretPrice} < ${COMMITMENT_CONSTANTS.MIN_PRICE}`);
  }
  if (params.secretPrice > COMMITMENT_CONSTANTS.MAX_PRICE) {
    errors.push(`Secret price too high: ${params.secretPrice} > ${COMMITMENT_CONSTANTS.MAX_PRICE}`);
  }
  
  // Validate amount range
  if (params.secretAmount < COMMITMENT_CONSTANTS.MIN_AMOUNT) {
    errors.push(`Secret amount too low: ${params.secretAmount} < ${COMMITMENT_CONSTANTS.MIN_AMOUNT}`);
  }
  if (params.secretAmount > COMMITMENT_CONSTANTS.MAX_AMOUNT) {
    errors.push(`Secret amount too high: ${params.secretAmount} > ${COMMITMENT_CONSTANTS.MAX_AMOUNT}`);
  }
  
  // Validate nonce range  
  if (params.nonce < COMMITMENT_CONSTANTS.MIN_NONCE) {
    errors.push(`Nonce too low: ${params.nonce} < ${COMMITMENT_CONSTANTS.MIN_NONCE}`);
  }
  if (params.nonce > COMMITMENT_CONSTANTS.MAX_NONCE) {
    errors.push(`Nonce too high: ${params.nonce} > ${COMMITMENT_CONSTANTS.MAX_NONCE}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculates commitment using Poseidon hash (Production Version)
 * 
 * Uses Poseidon hash for cryptographically secure commitment binding,
 * matching the implementation in our ZK circuit.
 * 
 * @param secretPrice Maker's minimum acceptable price
 * @param secretAmount Maker's minimum acceptable amount  
 * @param nonce Random value for uniqueness
 * @returns Computed commitment value using Poseidon hash
 * @throws Error if parameters are invalid
 */
export function calculateCommitment(
  secretPrice: bigint, 
  secretAmount: bigint, 
  nonce: bigint
): bigint {
  const params: SecretParameters = { secretPrice, secretAmount, nonce };
  
  // Validate parameters
  const validation = validateSecretParameters(params);
  if (!validation.isValid) {
    throw new Error(`Invalid secret parameters: ${validation.errors.join(', ')}`);
  }
  
  // Poseidon hash commitment (matches ZK circuit implementation)
  const commitment = poseidon3([secretPrice, secretAmount, nonce]);
  
  return commitment;
}

/**
 * Creates complete commitment data with validation
 * @param secretPrice Maker's minimum acceptable price
 * @param secretAmount Maker's minimum acceptable amount
 * @param nonce Optional nonce (generated if not provided)
 * @returns Complete commitment data structure
 */
export function createCommitment(
  secretPrice: bigint,
  secretAmount: bigint, 
  nonce?: bigint
): CommitmentData {
  // Generate nonce if not provided
  const finalNonce = nonce ?? generateNonce();
  
  // Calculate commitment
  const commitment = calculateCommitment(secretPrice, secretAmount, finalNonce);
  
  return {
    commitment,
    secretParams: {
      secretPrice,
      secretAmount,
      nonce: finalNonce
    }
  };
}

/**
 * Validates that a commitment matches the provided secret parameters
 * @param commitment The commitment value to verify
 * @param secretParams Secret parameters that should produce this commitment
 * @returns Validation result
 */
export function validateCommitment(
  commitment: bigint, 
  secretParams: SecretParameters
): CommitmentValidationResult {
  try {
    // First validate the secret parameters themselves
    const paramValidation = validateSecretParameters(secretParams);
    if (!paramValidation.isValid) {
      return paramValidation;
    }
    
    // Calculate expected commitment
    const expectedCommitment = calculateCommitment(
      secretParams.secretPrice,
      secretParams.secretAmount, 
      secretParams.nonce
    );
    
    // Check if commitments match
    if (commitment !== expectedCommitment) {
      return {
        isValid: false,
        errors: [`Commitment mismatch: expected ${expectedCommitment}, got ${commitment}`]
      };
    }
    
    return { isValid: true, errors: [] };
    
  } catch (error) {
    return {
      isValid: false,
      errors: [`Commitment validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Utility to check if a commitment value is within safe ranges
 * @param commitment Commitment value to check
 * @returns True if commitment is within safe bounds
 */
export function isCommitmentSafe(commitment: bigint): boolean {
  // Poseidon hash outputs are elements of the BN254 scalar field
  // The field modulus is approximately 2^254, so any bigint value is safe
  // as JavaScript bigints can represent arbitrarily large integers
  
  // Check for reasonable bounds (non-negative and reasonable size)
  if (commitment < BigInt(0)) {
    return false; // Negative values not allowed
  }
  
  // Poseidon outputs are in the BN254 field, which is much smaller than max bigint
  // Any realistic Poseidon output will be safe
  const BN254_FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
  
  return commitment <= BN254_FIELD_SIZE;
}

/**
 * Formats commitment for display/logging
 * @param commitmentData Commitment data to format
 * @returns Human-readable string representation
 */
export function formatCommitmentData(commitmentData: CommitmentData): string {
  return `Commitment(${commitmentData.commitment.toString()}) = ` +
         `price(${commitmentData.secretParams.secretPrice.toString()}) + ` +
         `amount(${commitmentData.secretParams.secretAmount.toString()}) + ` +
         `nonce(${commitmentData.secretParams.nonce.toString()})`;
} 