/**
 * ZK-Enabled Order Builder for 1inch Limit Order Protocol
 * 
 * Integrates commitment calculation, salt packing, and extension encoding
 * to create complete ZK orders with hidden parameter constraints.
 * 
 * Workflow:
 * 1. Take normal order parameters + secret parameters
 * 2. Calculate Poseidon commitment from secrets
 * 3. Generate ZK proof data
 * 4. Build extension with ZK predicate call
 * 5. Pack commitment + extension hash into order salt
 * 6. Create complete order using existing buildOrder patterns
 */

import { ethers } from "ethers";
import { Interface } from "ethers";
import path from "path";
import {
  calculateCommitment,
  generateNonce,
  type CommitmentData,
  type SecretParameters
} from "./commitmentUtils";
import {
  packSalt,
  createSaltFromExtension,
  unpackSalt,
  truncateCommitment,
  type PackedSaltData
} from "./saltPacking";
import {
  buildZKExtension,
  createCompleteZKExtension,
  type ZKExtensionData
} from "./zkExtensionBuilder";
import {
  generateFormattedProof,
  generateProof
} from "./proofGenerator";
import {
  type ZKProofInputs,
  type PublicSignals
} from "../types/zkTypes";
import {
  buildOrder,
  buildMakerTraits,
  type OrderStruct
} from "../../test/helpers/orderUtils";

// Default circuit paths
const DEFAULT_WASM_PATH = path.join(__dirname, "../../circuits/hidden_params_js/hidden_params.wasm");
const DEFAULT_ZKEY_PATH = path.join(__dirname, "../../circuits/hidden_params_0001.zkey");

/**
 * ZK order parameters (extends normal order parameters)
 */
export interface ZKOrderParams {
  // Standard 1inch order parameters
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: bigint;
  takingAmount: bigint;
  
  // Optional standard parameters
  makerTraits?: {
    allowPartialFill?: boolean;
    allowMultipleFills?: boolean;
    allowedSender?: string;
    expiry?: number;
    nonce?: bigint;
    series?: bigint;
  };
  
  // ZK-specific parameters
  secretParams: SecretParameters;
  
  // ZK contract addresses
  zkPredicateAddress: string;
  routerInterface: Interface;
  
  // Optional ZK configuration
  zkConfig?: {
    customNonce?: bigint;
    additionalPredicates?: string[];
    wasmPath?: string;
    zkeyPath?: string;
    gasLimit?: number;
  };
}

/**
 * ZK-enabled order (extends OrderStruct with ZK metadata)
 */
export interface ZKEnabledOrder extends OrderStruct {
  // ZK metadata (not part of on-chain order, but useful for tracking)
  zkMetadata: {
    commitment: bigint;
    nonce: bigint;
    secretParams: SecretParameters;
    extensionData: ZKExtensionData;
    saltData: PackedSaltData;
    proofInputs: ZKProofInputs;
  };
}

/**
 * ZK order validation result
 */
export interface ZKOrderValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  gasEstimate?: number;
}

/**
 * ZK order building result
 */
export interface ZKOrderBuildResult {
  order: ZKEnabledOrder;
  proofData: string;
  validationResult: ZKOrderValidationResult;
  debugInfo: {
    commitmentHex: string;
    saltHex: string;
    extensionLength: number;
    totalGasEstimate: number;
  };
}

/**
 * Validates ZK order parameters before building
 * @param params ZK order parameters to validate
 * @returns Validation result
 */
export function validateZKOrderParams(params: ZKOrderParams): ZKOrderValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate standard order parameters
  if (!ethers.isAddress(params.maker)) {
    errors.push(`Invalid maker address: ${params.maker}`);
  }
  
  if (!ethers.isAddress(params.makerAsset)) {
    errors.push(`Invalid makerAsset address: ${params.makerAsset}`);
  }
  
  if (!ethers.isAddress(params.takerAsset)) {
    errors.push(`Invalid takerAsset address: ${params.takerAsset}`);
  }
  
  if (params.makingAmount <= 0n) {
    errors.push(`Invalid makingAmount: ${params.makingAmount}`);
  }
  
  if (params.takingAmount <= 0n) {
    errors.push(`Invalid takingAmount: ${params.takingAmount}`);
  }
  
  // Validate ZK-specific parameters
  if (!ethers.isAddress(params.zkPredicateAddress)) {
    errors.push(`Invalid zkPredicateAddress: ${params.zkPredicateAddress}`);
  }
  
  if (!params.routerInterface) {
    errors.push("Router interface is required for ZK orders");
  }
  
  // Validate secret parameters
  if (params.secretParams.secretPrice <= 0n) {
    errors.push(`Invalid secretPrice: ${params.secretParams.secretPrice}`);
  }
  
  if (params.secretParams.secretAmount <= 0n) {
    errors.push(`Invalid secretAmount: ${params.secretParams.secretAmount}`);
  }
  
  // Business logic validation
  if (params.makingAmount > 0n && params.secretParams.secretPrice > params.takingAmount * BigInt(1e18) / params.makingAmount) {
    warnings.push("Secret price higher than implied order price - order may never fill");
  }
  
  if (params.secretParams.secretAmount > params.makingAmount) {
    warnings.push("Secret amount higher than making amount - order may never fill");
  }
  
  // Estimate gas
  let gasEstimate = 350000; // Base ZK order gas
  if (params.zkConfig?.additionalPredicates?.length) {
    gasEstimate += params.zkConfig.additionalPredicates.length * 50000;
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    gasEstimate
  };
}

/**
 * Builds a ZK-enabled order with hidden parameter constraints
 * @param params ZK order parameters
 * @returns Complete ZK order build result
 * @throws Error if parameters are invalid or proof generation fails
 */
export async function buildZKOrder(params: ZKOrderParams): Promise<ZKOrderBuildResult> {
  // Validate parameters
  const validation = validateZKOrderParams(params);
  if (!validation.isValid) {
    throw new Error(`Invalid ZK order parameters: ${validation.errors.join(', ')}`);
  }
  
  // Log warnings if any
  if (validation.warnings.length > 0) {
    console.warn(`ZK Order Builder warnings: ${validation.warnings.join(', ')}`);
  }
  
  // Step 1: Generate nonce and calculate commitment using our JavaScript Poseidon
  // This matches our circuit implementation and avoids contract method mismatch
  const nonce = params.zkConfig?.customNonce || generateNonce();
  const commitment = calculateCommitment(
    params.secretParams.secretPrice,
    params.secretParams.secretAmount,
    nonce
  );
  
  // Step 3: Prepare ZK proof inputs (we'll generate the actual proof)
  const proofInputs: ZKProofInputs = {
    secretPrice: params.secretParams.secretPrice.toString(),
    secretAmount: params.secretParams.secretAmount.toString(),
    commit: commitment.toString(),
    nonce: nonce.toString(),
    // For order building, we use the order's implied price/amount as "offered" values
    offeredPrice: (params.takingAmount * BigInt(1e18) / params.makingAmount).toString(),
    offeredAmount: params.makingAmount.toString()
  };
  
  // Step 4: Generate ZK proof
  const { proof, publicSignals } = await generateProof(
    proofInputs,
    {
      wasmPath: params.zkConfig?.wasmPath || DEFAULT_WASM_PATH,
      zkeyPath: params.zkConfig?.zkeyPath || DEFAULT_ZKEY_PATH
    }
  );
  
  // Step 5: Encode using our utility (TODO: Use contract method for perfect compatibility)
  const { encodedData: proofData } = await import('./zkProofEncoder').then(module => 
    module.encodeZKProofData(proof, publicSignals)
  );
  
  // Step 4: Build extension using SIMPLIFIED approach that matches working debug test
  const predicateInterface = new ethers.Interface(["function predicate(bytes calldata data) external view returns (uint256)"]);
  const predicateCalldata = predicateInterface.encodeFunctionData("predicate", [proofData]);
  const arbitraryCall = params.routerInterface.encodeFunctionData("arbitraryStaticCall", [
    params.zkPredicateAddress,
    predicateCalldata
  ]);
  
  // Wrap arbitraryStaticCall in gt() like working debug test
  const predicate = params.routerInterface.encodeFunctionData("gt", [
    0, // Check if result > 0 (i.e., equals 1)
    arbitraryCall
  ]);
  

  
  // Step 5: Build makerTraits
  const makerTraits = buildMakerTraits({
    allowPartialFill: params.makerTraits?.allowPartialFill ?? true,
    allowMultipleFills: params.makerTraits?.allowMultipleFills ?? true,
    allowedSender: params.makerTraits?.allowedSender,
    expiry: params.makerTraits?.expiry,
    nonce: params.makerTraits?.nonce ? Number(params.makerTraits.nonce) : undefined,
    series: params.makerTraits?.series ? Number(params.makerTraits.series) : undefined
  });
  
  // Step 6: Build order with extension using SINGLE buildOrder call (like debug test)
  const order = buildOrder({
    maker: params.maker,
    makerAsset: params.makerAsset,
    takerAsset: params.takerAsset,
    makingAmount: params.makingAmount,
    takingAmount: params.takingAmount,
    makerTraits: makerTraits
  }, {
    predicate: predicate
  });
  
  // Step 7: Pack commitment into salt using same approach as debug test
  const extensionHash = ethers.keccak256(predicate);
  const extensionHashBigInt = BigInt(extensionHash);
  const commitHashTruncated = commitment & ((1n << 96n) - 1n); // Truncate to 96 bits
  const commitHashShifted = commitHashTruncated << 160n;
  const extensionHashLower = extensionHashBigInt & ((1n << 160n) - 1n);
  order.salt = commitHashShifted | extensionHashLower;
  
  // Create salt data for metadata (using the same structure for compatibility)
  const saltData = {
    salt: order.salt,
    commitment: commitHashTruncated,
    extensionHash: extensionHashLower  // Use the same truncated value as in salt
  };
  
  const finalOrder = order;
  
  // Create the ZK-enabled order with metadata
  const zkOrder: ZKEnabledOrder = {
    ...finalOrder,
    zkMetadata: {
      commitment: commitment,
      nonce: nonce,
      secretParams: params.secretParams,
      extensionData: {
        extensionBytes: predicate,
        extensionHash: extensionHashLower, // Use same truncated value as in salt
        predicateCall: arbitraryCall,
        gasEstimate: 80000 // Simplified gas estimate
      },
      saltData: saltData,
      proofInputs: proofInputs
    }
  };
  
  // Create debug info
  const debugInfo = {
    commitmentHex: `0x${commitment.toString(16)}`,
    saltHex: `0x${saltData.salt.toString(16)}`,
    extensionLength: (predicate.length - 2) / 2,
    totalGasEstimate: 80000 // Simplified gas estimate
  };
  
  return {
    order: zkOrder,
    proofData,
    validationResult: validation,
    debugInfo
  };
}

/**
 * Validates a complete ZK order for consistency
 * @param zkOrder ZK-enabled order to validate
 * @returns Validation result
 */
export function validateZKOrder(zkOrder: ZKEnabledOrder): ZKOrderValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate that salt contains the expected commitment
  try {
    const unpackedSalt = unpackSalt(zkOrder.salt);
    
    // Check commitment consistency (may be truncated in salt)
    const expectedCommitment = truncateCommitment(zkOrder.zkMetadata.commitment);
    
    if (unpackedSalt.commitment !== expectedCommitment) {
      errors.push("Salt commitment doesn't match order metadata commitment");
    }
    
    // Check extension hash consistency
    if (unpackedSalt.extensionHash !== zkOrder.zkMetadata.extensionData.extensionHash) {
      errors.push("Salt extension hash doesn't match extension data hash");
    }
  } catch (error) {
    errors.push(`Salt validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Validate ZK proof inputs consistency
  const expectedOfferedPrice = (zkOrder.takingAmount * BigInt(1e18) / zkOrder.makingAmount).toString();
  const expectedOfferedAmount = zkOrder.makingAmount.toString();
  
  if (zkOrder.zkMetadata.proofInputs.offeredPrice !== expectedOfferedPrice) {
    warnings.push("Proof offered price doesn't match order price ratio");
  }
  
  if (zkOrder.zkMetadata.proofInputs.offeredAmount !== expectedOfferedAmount) {
    warnings.push("Proof offered amount doesn't match order making amount");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    gasEstimate: zkOrder.zkMetadata.extensionData.gasEstimate
  };
}

/**
 * Helper to extract ZK metadata from a ZK order
 * @param zkOrder ZK-enabled order
 * @returns Human-readable ZK metadata summary
 */
export function getZKOrderSummary(zkOrder: ZKEnabledOrder): {
  commitmentSummary: string;
  secretThresholds: string;
  gasEstimate: number;
  extensionLength: number;
} {
  const { commitment, nonce, secretParams, extensionData } = zkOrder.zkMetadata;
  
  return {
    commitmentSummary: `Commitment(0x${commitment.toString(16).slice(0, 16)}...) = price(${secretParams.secretPrice}) + amount(${secretParams.secretAmount}) + nonce(${nonce})`,
    secretThresholds: `Min price: ${secretParams.secretPrice}, Min amount: ${secretParams.secretAmount}`,
    gasEstimate: extensionData.gasEstimate,
    extensionLength: (extensionData.extensionBytes.length - 2) / 2
  };
}

/**
 * Utility to create a simple ZK order with minimal configuration
 * @param basicParams Basic order parameters
 * @param secretParams Secret ZK parameters
 * @param zkAddresses ZK contract addresses
 * @returns ZK order build result
 */
export async function createSimpleZKOrder(
  basicParams: {
    maker: string;
    makerAsset: string;
    takerAsset: string;
    makingAmount: bigint;
    takingAmount: bigint;
  },
  secretParams: SecretParameters,
  zkAddresses: {
    zkPredicateAddress: string;
    routerInterface: Interface;
  }
): Promise<ZKOrderBuildResult> {
  return buildZKOrder({
    ...basicParams,
    secretParams,
    ...zkAddresses,
    makerTraits: {
      allowPartialFill: true,
      allowMultipleFills: true
    }
  });
}

/**
 * Debug utility for ZK orders
 * @param zkOrder ZK-enabled order to debug
 * @returns Detailed debug information
 */
export function debugZKOrder(zkOrder: ZKEnabledOrder): {
  orderSummary: string;
  zkSummary: string;
  saltBreakdown: string;
  extensionBreakdown: string;
  validationStatus: string;
} {
  const summary = getZKOrderSummary(zkOrder);
  const validation = validateZKOrder(zkOrder);
  
  return {
    orderSummary: `ZK Order: ${zkOrder.makingAmount} ${zkOrder.makerAsset.slice(-6)} → ${zkOrder.takingAmount} ${zkOrder.takerAsset.slice(-6)}`,
    zkSummary: summary.commitmentSummary,
    saltBreakdown: `Salt(0x${zkOrder.salt.toString(16).slice(0, 16)}...) = commitment + extension hash`,
    extensionBreakdown: `Extension: ${summary.extensionLength} bytes, ~${summary.gasEstimate} gas`,
    validationStatus: validation.isValid ? "✅ Valid" : `❌ Invalid: ${validation.errors.join(', ')}`
  };
} 