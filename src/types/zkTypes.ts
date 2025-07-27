/**
 * TypeScript types for ZK proof generation and verification
 * for Hidden Parameter Orders in 1inch Limit Order Protocol
 */

// Input types for proof generation
export interface ZKProofInputs {
  // Private inputs (known only to maker)
  secretPrice: string;      // Maker's minimum acceptable price
  secretAmount: string;     // Maker's minimum acceptable amount
  
  // Public inputs (visible to all)
  commit: string;           // Commitment hash binding secret parameters
  nonce: string;            // Randomness for commitment uniqueness
  offeredPrice: string;     // Taker's proposed price
  offeredAmount: string;    // Taker's proposed amount
}

// Raw proof output from snarkjs
export interface ZKProof {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
  protocol: string;
  curve: string;
}

// Public signals array (circuit outputs)
export type PublicSignals = [
  string, // valid (1 if constraints satisfied)
  string, // commit
  string, // nonce
  string, // offeredPrice
  string  // offeredAmount
];

// Formatted proof data for Solidity contract consumption
export interface ZKProofData {
  commit: string;
  nonce: string;
  offeredPrice: string;
  offeredAmount: string;
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}

// Complete proof package for contract interaction
export interface FormattedProof {
  proof: ZKProofData;
  publicSignals: PublicSignals;
  encodedData: string; // ABI-encoded for contract calls
}

// Input validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Proof generation configuration
export interface ProofConfig {
  wasmPath: string;
  zkeyPath: string;
  enableLogging?: boolean;
}

// Constants for circuit validation
export const CIRCUIT_CONSTANTS = {
  PRIVATE_INPUT_COUNT: 2,
  PUBLIC_INPUT_COUNT: 4,
  OUTPUT_COUNT: 1,
  TOTAL_SIGNALS: 5, // [valid, commit, nonce, offeredPrice, offeredAmount]
  FIELD_SIZE: "21888242871839275222246405745257275088548364400416034343698204186575808495617"
} as const;

// Helper type for bigint conversion
export type BigNumberish = string | number | bigint; 