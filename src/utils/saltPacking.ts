/**
 * Salt Packing System for ZK-Enabled Orders
 * 
 * Efficiently packs commitment and extension data into 1inch order salt:
 * - Upper 96 bits: Commitment (truncated from Poseidon hash)
 * - Lower 160 bits: Extension hash (keccak256 result)
 * - Total: 256 bits (standard order salt size)
 * 
 * This allows ZK orders to embed both commitment and extension information
 * in the standard order salt field without requiring protocol changes.
 */

import { ethers } from "ethers";

/**
 * Salt structure configuration
 */
export const SALT_CONFIG = {
  // Total salt size (256 bits / 32 bytes)
  TOTAL_BITS: 256,
  TOTAL_BYTES: 32,
  
  // Commitment section (upper bits)
  COMMITMENT_BITS: 96,
  COMMITMENT_BYTES: 12,
  
  // Extension hash section (lower bits) 
  EXTENSION_BITS: 160,
  EXTENSION_BYTES: 20,
  
  // Bit shifts for packing/unpacking
  EXTENSION_SHIFT: BigInt(0),          // Extension at position 0
  COMMITMENT_SHIFT: BigInt(160),       // Commitment at position 160
  
  // Bit masks for extraction
  EXTENSION_MASK: (BigInt(1) << BigInt(160)) - BigInt(1),     // 160 bits of 1s
  COMMITMENT_MASK: (BigInt(1) << BigInt(96)) - BigInt(1),     // 96 bits of 1s
} as const;

/**
 * Packed salt data structure
 */
export interface PackedSaltData {
  salt: bigint;              // The packed 256-bit salt
  commitment: bigint;        // Original commitment value (96-bit truncated)
  extensionHash: bigint;     // Original extension hash (160-bit)
}

/**
 * Salt unpacking result
 */
export interface UnpackedSaltData {
  commitment: bigint;        // Extracted commitment (96-bit)
  extensionHash: bigint;     // Extracted extension hash (160-bit)
}

/**
 * Validation result for salt operations
 */
export interface SaltValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Truncates a large commitment (Poseidon hash) to fit in 96 bits
 * @param commitment Full commitment value (typically Poseidon hash)
 * @returns Truncated commitment that fits in 96 bits
 */
export function truncateCommitment(commitment: bigint): bigint {
  // Take the lower 96 bits of the commitment
  return commitment & SALT_CONFIG.COMMITMENT_MASK;
}

/**
 * Validates that extension hash fits in 160 bits
 * @param extensionHash Extension hash to validate
 * @returns Validation result
 */
export function validateExtensionHash(extensionHash: bigint): SaltValidationResult {
  const errors: string[] = [];
  
  if (extensionHash < BigInt(0)) {
    errors.push("Extension hash cannot be negative");
  }
  
  if (extensionHash > SALT_CONFIG.EXTENSION_MASK) {
    errors.push(`Extension hash too large: ${extensionHash} > ${SALT_CONFIG.EXTENSION_MASK} (160-bit max)`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates salt structure and bit allocation
 * @param salt Salt value to validate
 * @returns Validation result
 */
export function validateSaltStructure(salt: bigint): SaltValidationResult {
  const errors: string[] = [];
  
  if (salt < BigInt(0)) {
    errors.push("Salt cannot be negative");
  }
  
  // Check if salt fits in 256 bits
  const maxSalt = (BigInt(1) << BigInt(SALT_CONFIG.TOTAL_BITS)) - BigInt(1);
  if (salt > maxSalt) {
    errors.push(`Salt too large: ${salt} > ${maxSalt} (256-bit max)`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Packs commitment and extension hash into a 256-bit salt
 * @param commitment Commitment value (will be truncated to 96 bits)
 * @param extensionHash Extension hash (must fit in 160 bits)
 * @returns Packed salt data
 * @throws Error if inputs are invalid
 */
export function packSalt(commitment: bigint, extensionHash: bigint): PackedSaltData {
  // Validate extension hash
  const extensionValidation = validateExtensionHash(extensionHash);
  if (!extensionValidation.isValid) {
    throw new Error(`Invalid extension hash: ${extensionValidation.errors.join(', ')}`);
  }
  
  // Truncate commitment to fit in 96 bits
  const truncatedCommitment = truncateCommitment(commitment);
  
  // Pack: commitment in upper 96 bits, extension hash in lower 160 bits
  const packedSalt = 
    (truncatedCommitment << SALT_CONFIG.COMMITMENT_SHIFT) | 
    (extensionHash << SALT_CONFIG.EXTENSION_SHIFT);
  
  // Validate the resulting salt
  const saltValidation = validateSaltStructure(packedSalt);
  if (!saltValidation.isValid) {
    throw new Error(`Invalid packed salt: ${saltValidation.errors.join(', ')}`);
  }
  
  return {
    salt: packedSalt,
    commitment: truncatedCommitment,
    extensionHash: extensionHash
  };
}

/**
 * Unpacks a 256-bit salt into commitment and extension hash
 * @param salt Packed salt value
 * @returns Unpacked salt data
 * @throws Error if salt is invalid
 */
export function unpackSalt(salt: bigint): UnpackedSaltData {
  // Validate salt structure
  const saltValidation = validateSaltStructure(salt);
  if (!saltValidation.isValid) {
    throw new Error(`Invalid salt: ${saltValidation.errors.join(', ')}`);
  }
  
  // Extract extension hash (lower 160 bits)
  const extensionHash = salt & SALT_CONFIG.EXTENSION_MASK;
  
  // Extract commitment (upper 96 bits)
  const commitment = (salt >> SALT_CONFIG.COMMITMENT_SHIFT) & SALT_CONFIG.COMMITMENT_MASK;
  
  return {
    commitment,
    extensionHash
  };
}

/**
 * Verifies round-trip consistency for salt packing/unpacking
 * @param commitment Original commitment value
 * @param extensionHash Original extension hash
 * @returns True if round-trip is consistent
 */
export function verifyRoundTrip(commitment: bigint, extensionHash: bigint): boolean {
  try {
    // Pack the salt
    const packed = packSalt(commitment, extensionHash);
    
    // Unpack the salt
    const unpacked = unpackSalt(packed.salt);
    
    // Verify consistency (note: commitment may be truncated)
    const expectedCommitment = truncateCommitment(commitment);
    return (
      unpacked.commitment === expectedCommitment &&
      unpacked.extensionHash === extensionHash
    );
  } catch (error) {
    return false;
  }
}

/**
 * Formats packed salt data for display/logging
 * @param saltData Packed salt data to format
 * @returns Human-readable string representation
 */
export function formatPackedSalt(saltData: PackedSaltData): string {
  return `PackedSalt(0x${saltData.salt.toString(16)}) = ` +
         `commitment(0x${saltData.commitment.toString(16)}) + ` +
         `extensionHash(0x${saltData.extensionHash.toString(16)})`;
}

/**
 * Converts extension hash from hex string to bigint
 * @param extensionHashHex Hex string (with or without 0x prefix)
 * @returns Extension hash as bigint
 */
export function extensionHashFromHex(extensionHashHex: string): bigint {
  // Remove 0x prefix if present
  const cleanHex = extensionHashHex.startsWith('0x') ? extensionHashHex.slice(2) : extensionHashHex;
  
  // Validate hex string length (should be 40 characters for 160 bits / 20 bytes)
  if (cleanHex.length > 40) {
    throw new Error(`Extension hash hex too long: ${cleanHex.length} chars > 40 chars (160-bit max)`);
  }
  
  return BigInt('0x' + cleanHex);
}

/**
 * Computes extension hash from extension bytes
 * @param extensionBytes Extension data as bytes
 * @returns Extension hash as bigint (160-bit)
 */
export function computeExtensionHash(extensionBytes: string): bigint {
  // Use keccak256 and truncate to 160 bits (20 bytes)
  const fullHash = ethers.keccak256(extensionBytes);
  
  // Take the last 20 bytes (160 bits) of the hash
  const truncatedHash = '0x' + fullHash.slice(-40); // Last 40 hex chars = 20 bytes
  
  return BigInt(truncatedHash);
}

/**
 * Helper to create salt from commitment and extension bytes
 * @param commitment Commitment value
 * @param extensionBytes Extension data as bytes (will be hashed)
 * @returns Packed salt data
 */
export function createSaltFromExtension(commitment: bigint, extensionBytes: string): PackedSaltData {
  const extensionHash = computeExtensionHash(extensionBytes);
  return packSalt(commitment, extensionHash);
} 