/**
 * ZK Proof Generation Utilities
 * Generates proofs using circuit artifacts (WASM + ZKey)
 */

import * as snarkjs from 'snarkjs';
const { poseidon3 } = require("poseidon-lite");
import { ethers } from "ethers";
import path from "path";
import { 
    ZKProofInputs, 
    ZKProof, 
    PublicSignals, 
    ZKProofData, 
    FormattedProof, 
    ValidationResult, 
    ProofConfig,
    CIRCUIT_CONSTANTS 
  } from "../types/zkTypes";

// Default paths for circuit artifacts
const DEFAULT_WASM_PATH = path.join(__dirname, "../../circuits/hidden_params_js/hidden_params.wasm");
const DEFAULT_ZKEY_PATH = path.join(__dirname, "../../circuits/hidden_params_0001.zkey");

/**
 * Validates ZK proof inputs for constraint satisfaction
 */
export function validateInputs(inputs: ZKProofInputs): ValidationResult {
  try {
    const secretPrice = BigInt(inputs.secretPrice);
    const secretAmount = BigInt(inputs.secretAmount);
    const nonce = BigInt(inputs.nonce);
    const offeredPrice = BigInt(inputs.offeredPrice);
    const offeredAmount = BigInt(inputs.offeredAmount);
    const commit = BigInt(inputs.commit);

    const errors: string[] = [];

    // Validate Poseidon commitment
    const expectedCommit = poseidon3([secretPrice, secretAmount, nonce]);
    if (commit !== expectedCommit) {
      errors.push(`Commitment mismatch: expected ${expectedCommit}, got ${commit}`);
    }

    // Validate price constraint
    if (offeredPrice < secretPrice) {
      errors.push(`Price constraint violated: ${offeredPrice} < ${secretPrice}`);
    }

    // Validate amount constraint
    if (offeredAmount < secretAmount) {
      errors.push(`Amount constraint violated: ${offeredAmount} < ${secretAmount}`);
    }

    return { 
      isValid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Input validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Generates a ZK proof using circuit artifacts
 */
export async function generateProof(
  inputs: ZKProofInputs,
  config: ProofConfig
): Promise<{ proof: ZKProof; publicSignals: PublicSignals }> {
  
  // Validate inputs first
  const validation = validateInputs(inputs);
  if (!validation.isValid) {
    throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
  }
  
  // Prepare circuit inputs (snarkjs expects specific format)
  const circuitInputs = {
    secretPrice: inputs.secretPrice,
    secretAmount: inputs.secretAmount,
    commit: inputs.commit,
    nonce: inputs.nonce,
    offeredPrice: inputs.offeredPrice,
    offeredAmount: inputs.offeredAmount
  };
  
  if (config.enableLogging) {
    console.log('Generating ZK proof with inputs:', {
      commit: inputs.commit,
      nonce: inputs.nonce,
      offeredPrice: inputs.offeredPrice,
      offeredAmount: inputs.offeredAmount
      // Note: secretPrice and secretAmount are private, not logged
    });
  }
  
  try {
    // Generate proof using snarkjs
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      config.wasmPath,
      config.zkeyPath
    );
    
    if (config.enableLogging) {
      console.log('ZK proof generated successfully');
      console.log('Public signals:', publicSignals);
    }
    
    // Validate proof has correct structure
    if (!proof.pi_a || !proof.pi_b || !proof.pi_c) {
      throw new Error('Generated proof has invalid structure');
    }
    
    // Validate public signals count
    if (publicSignals.length !== CIRCUIT_CONSTANTS.TOTAL_SIGNALS) {
      throw new Error(
        `Expected ${CIRCUIT_CONSTANTS.TOTAL_SIGNALS} public signals, got ${publicSignals.length}`
      );
    }
    
    return { proof, publicSignals: publicSignals as PublicSignals };
    
  } catch (error: any) {
    const errorMsg = `Failed to generate ZK proof: ${error.message}`;
    if (config.enableLogging) {
      console.error('Error', errorMsg);
    }
    throw new Error(errorMsg);
  }
}

/**
 * Formats proof for Solidity contract consumption
 */
export function formatProofForContract(
  proof: ZKProof,
  publicSignals: PublicSignals,
  inputs: ZKProofInputs
): ZKProofData {
  return {
    commit: inputs.commit,
    nonce: inputs.nonce,
    offeredPrice: inputs.offeredPrice,
    offeredAmount: inputs.offeredAmount,
    a: proof.pi_a,
    b: proof.pi_b,
    c: proof.pi_c
  };
}

/**
 * ABI-encodes proof data for contract calls
 */
export function encodeProofData(proofData: ZKProofData): string {
  // Define the ZKProofData struct ABI
  const abiTypes = [
    'uint256', // commit
    'uint256', // nonce
    'uint256', // offeredPrice
    'uint256', // offeredAmount
    'uint256[2]', // a
    'uint256[2][2]', // b
    'uint256[2]' // c
  ];
  
  const values = [
    proofData.commit,
    proofData.nonce,
    proofData.offeredPrice,
    proofData.offeredAmount,
    proofData.a,
    proofData.b,
    proofData.c
  ];
  
  return ethers.AbiCoder.defaultAbiCoder().encode(abiTypes, values);
}

/**
 * Complete proof generation and formatting pipeline
 */
export async function generateFormattedProof(
  inputs: ZKProofInputs,
  config: ProofConfig
): Promise<FormattedProof> {
  
  // Generate raw proof
  const { proof, publicSignals } = await generateProof(inputs, config);
  
  // Format for contract
  const formattedProof = formatProofForContract(proof, publicSignals, inputs);
  
  // Encode for contract calls
  const encodedData = encodeProofData(formattedProof);
  
  return {
    proof: formattedProof,
    publicSignals,
    encodedData
  };
} 