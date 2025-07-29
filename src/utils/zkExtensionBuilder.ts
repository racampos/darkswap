/**
 * ZK Extension Builder for 1inch Limit Order Protocol
 * 
 * Creates properly formatted extension calldata for ZK predicate verification.
 * Integrates with existing 1inch predicate utilities and patterns.
 * 
 * Extension flow:
 * 1. Take ZK proof data (ABI-encoded)
 * 2. Create arbitraryStaticCall to HiddenParamPredicateZK.predicate()
 * 3. Optionally combine with other predicates using joinStaticCalls
 * 4. Return extension bytes and hash for salt packing
 */

import { ethers } from "ethers";
import { joinStaticCalls } from "../../test/helpers/utils";
import { computeExtensionHash } from "./saltPacking";

/**
 * ZK extension configuration
 */
export const ZK_EXTENSION_CONFIG = {
  // Function selector for HiddenParamPredicateZK.predicate(bytes)
  PREDICATE_SELECTOR: "0x6fe7b0ba", // predicate(bytes)
  
  // Gas limit for predicate calls (conservative estimate)
  DEFAULT_GAS_LIMIT: 300000,
  
  // Minimum calldata length for ZK proofs (416 bytes + ABI encoding overhead)
  MIN_PROOF_CALLDATA_LENGTH: 450,
} as const;

/**
 * ZK extension data structure
 */
export interface ZKExtensionData {
  extensionBytes: string;      // Complete extension calldata
  extensionHash: bigint;       // Hash for salt packing
  predicateCall: string;       // Individual predicate call data
  gasEstimate: number;         // Estimated gas usage
}

/**
 * Combined extension configuration
 */
export interface CombinedExtensionConfig {
  zkExtensions: ZKExtensionData[];    // ZK predicate calls
  additionalPredicates: string[];     // Other predicate calls (hex strings)
  useOrLogic: boolean;                // true for OR, false for AND logic
}

/**
 * ZK extension validation result
 */
export interface ZKExtensionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Creates arbitraryStaticCall calldata using ethers interface encoding
 * @param routerInterface The 1inch router contract interface
 * @param targetAddress Address of the contract to call
 * @param calldata Calldata for the target contract
 * @returns Encoded arbitraryStaticCall data
 */
export function createArbitraryStaticCall(
  routerInterface: ethers.Interface,
  targetAddress: string,
  calldata: string
): string {
  return routerInterface.encodeFunctionData("arbitraryStaticCall", [
    targetAddress,
    calldata
  ]);
}

/**
 * Validates ZK proof data before building extension
 * @param zkProofData ABI-encoded ZK proof data
 * @returns Validation result
 */
export function validateZKProofData(zkProofData: string): ZKExtensionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic format validation
  if (!zkProofData.startsWith('0x')) {
    errors.push("ZK proof data must be hex string starting with 0x");
  }
  
  // Length validation
  if (zkProofData.length < ZK_EXTENSION_CONFIG.MIN_PROOF_CALLDATA_LENGTH * 2 + 2) { // *2 for hex, +2 for 0x
    warnings.push(`ZK proof data seems short: ${zkProofData.length} chars. Expected ~${ZK_EXTENSION_CONFIG.MIN_PROOF_CALLDATA_LENGTH * 2 + 2}`);
  }
  
  // Even length validation
  if (zkProofData.length % 2 !== 0) {
    errors.push("ZK proof data must have even length (valid hex)");
  }
  
  // Content validation
  const hexPattern = /^0x[0-9a-fA-F]*$/;
  if (!hexPattern.test(zkProofData)) {
    errors.push("ZK proof data contains invalid hex characters");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Builds a ZK extension for a single predicate call
 * @param routerInterface The 1inch router contract interface
 * @param predicateAddress Address of the HiddenParamPredicateZK contract
 * @param zkProofData ABI-encoded ZK proof data
 * @param gasLimit Optional gas limit for the predicate call
 * @returns ZK extension data
 * @throws Error if inputs are invalid
 */
export function buildZKExtension(
  routerInterface: ethers.Interface,
  predicateAddress: string,
  zkProofData: string,
  gasLimit: number = ZK_EXTENSION_CONFIG.DEFAULT_GAS_LIMIT
): ZKExtensionData {
  // Validate inputs
  const validation = validateZKProofData(zkProofData);
  if (!validation.isValid) {
    throw new Error(`Invalid ZK proof data: ${validation.errors.join(', ')}`);
  }
  
  // Log warnings if any
  if (validation.warnings.length > 0) {
    console.warn(`ZK Extension Builder warnings: ${validation.warnings.join(', ')}`);
  }
  
  // Validate predicate address
  if (!ethers.isAddress(predicateAddress)) {
    throw new Error(`Invalid predicate address: ${predicateAddress}`);
  }
  
  // Build the predicate call using proper ABI encoding (matches working debug test approach)
  // This creates: arbitraryStaticCall(predicateAddress, abi.encodeCall(predicate, zkProofData))
  const predicateInterface = new ethers.Interface(["function predicate(bytes calldata data) external view returns (uint256)"]);
  const predicateCalldata = predicateInterface.encodeFunctionData("predicate", [zkProofData]);
  const arbitraryCall = createArbitraryStaticCall(routerInterface, predicateAddress, predicateCalldata);
  
  // 🔑 CRITICAL FIX: Wrap arbitraryStaticCall in gt() to check if result > 0
  // This follows the working example pattern and ensures 1inch protocol compatibility
  const extensionBytes = routerInterface.encodeFunctionData("gt", [
    0, // Check if result > 0 (our predicate returns 1 for success)
    arbitraryCall
  ]);
  
  // Compute extension hash for salt packing
  const extensionHash = computeExtensionHash(extensionBytes);
  
  // Estimate gas usage (base + predicate call cost)
  const gasEstimate = gasLimit + 30000; // Base execution cost
  
  return {
    extensionBytes,
    extensionHash,
    predicateCall: arbitraryCall, // Store the inner call for reference
    gasEstimate
  };
}

/**
 * Builds a combined extension with multiple predicates (ZK + others)
 * @param config Combined extension configuration
 * @returns Combined extension data
 * @throws Error if configuration is invalid
 */
export function buildCombinedExtension(config: CombinedExtensionConfig): ZKExtensionData {
  const { zkExtensions, additionalPredicates, useOrLogic } = config;
  
  // Validate configuration
  if (zkExtensions.length === 0 && additionalPredicates.length === 0) {
    throw new Error("At least one predicate (ZK or additional) must be provided");
  }
  
  // Collect all predicate calls
  const allPredicateCalls: string[] = [];
  
  // Add ZK predicate calls
  for (const zkExt of zkExtensions) {
    allPredicateCalls.push(zkExt.predicateCall);
  }
  
  // Add additional predicate calls
  allPredicateCalls.push(...additionalPredicates);
  
  // Combine predicates using joinStaticCalls
  let combinedExtension: string;
  
  if (allPredicateCalls.length === 1) {
    // Single predicate - no need for joinStaticCalls
    combinedExtension = allPredicateCalls[0];
  } else {
    // Multiple predicates - use joinStaticCalls with appropriate logic
    if (useOrLogic) {
      // OR logic: any predicate can satisfy the condition
      // Note: 1inch LOP uses AND by default in joinStaticCalls
      // For OR logic, we'd need to implement custom logic or use multiple separate calls
      // For now, we'll use joinStaticCalls (AND) and document this limitation
      console.warn("OR logic with multiple ZK predicates not yet implemented. Using AND logic.");
    }
    
    const joinedResult = joinStaticCalls(allPredicateCalls);
    combinedExtension = joinedResult.data; // Extract the data field from the result
  }
  
  // Compute combined extension hash
  const extensionHash = computeExtensionHash(combinedExtension);
  
  // Estimate total gas usage
  const totalGasEstimate = zkExtensions.reduce((sum, ext) => sum + ext.gasEstimate, 0) + 
                          additionalPredicates.length * 50000; // Estimate for additional predicates
  
  return {
    extensionBytes: combinedExtension,
    extensionHash,
    predicateCall: combinedExtension, // For combined, this is the same as extensionBytes
    gasEstimate: totalGasEstimate
  };
}

/**
 * Creates a ZK extension that combines with existing predicate patterns
 * @param routerInterface The 1inch router contract interface
 * @param predicateAddress Address of the HiddenParamPredicateZK contract
 * @param zkProofData ABI-encoded ZK proof data
 * @param existingPredicates Optional array of existing predicate calls to combine
 * @returns Combined extension data
 */
export function createZKExtensionWithPredicates(
  routerInterface: ethers.Interface,
  predicateAddress: string,
  zkProofData: string,
  existingPredicates: string[] = []
): ZKExtensionData {
  // Build the ZK extension
  const zkExtension = buildZKExtension(routerInterface, predicateAddress, zkProofData);
  
  // If no existing predicates, return the ZK extension directly
  if (existingPredicates.length === 0) {
    return zkExtension;
  }
  
  // Combine with existing predicates
  return buildCombinedExtension({
    zkExtensions: [zkExtension],
    additionalPredicates: existingPredicates,
    useOrLogic: false // Default to AND logic
  });
}

/**
 * Formats ZK extension for use in buildTakerTraits
 * @param extensionData ZK extension data
 * @returns Object with extension and args for buildTakerTraits
 */
export function formatZKExtensionForTakerTraits(extensionData: ZKExtensionData): {
  extension: string;
  gasEstimate: number;
} {
  return {
    extension: extensionData.extensionBytes,
    gasEstimate: extensionData.gasEstimate
  };
}

/**
 * Helper to create a complete ZK order extension package
 * @param routerInterface The 1inch router contract interface
 * @param predicateAddress Address of the HiddenParamPredicateZK contract
 * @param zkProofData ABI-encoded ZK proof data
 * @param additionalConfig Optional additional configuration
 * @returns Complete extension package ready for order building
 */
export function createCompleteZKExtension(
  routerInterface: ethers.Interface,
  predicateAddress: string,
  zkProofData: string,
  additionalConfig?: {
    existingPredicates?: string[];
    gasLimit?: number;
    validateOnly?: boolean;
  }
): {
  extensionData: ZKExtensionData;
  takerTraitsConfig: { extension: string; gasEstimate: number };
  saltPackingHash: bigint;
} {
  const config = additionalConfig || {};
  
  // Validate only if requested
  if (config.validateOnly) {
    const validation = validateZKProofData(zkProofData);
    if (!validation.isValid) {
      throw new Error(`ZK proof validation failed: ${validation.errors.join(', ')}`);
    }
    return {
      extensionData: {} as ZKExtensionData,
      takerTraitsConfig: { extension: "", gasEstimate: 0 },
      saltPackingHash: BigInt(0)
    };
  }
  
  // Build the extension
  const extensionData = createZKExtensionWithPredicates(
    routerInterface,
    predicateAddress,
    zkProofData,
    config.existingPredicates
  );
  
  // Format for taker traits
  const takerTraitsConfig = formatZKExtensionForTakerTraits(extensionData);
  
  return {
    extensionData,
    takerTraitsConfig,
    saltPackingHash: extensionData.extensionHash
  };
}

/**
 * Utility to estimate gas for ZK predicate execution
 * @param zkProofDataLength Length of the ZK proof data in bytes
 * @param additionalPredicateCount Number of additional predicates to combine
 * @returns Estimated gas usage
 */
export function estimateZKExtensionGas(
  zkProofDataLength: number,
  additionalPredicateCount: number = 0
): number {
  // Base ZK verification cost (varies by proof complexity)
  const baseZKCost = ZK_EXTENSION_CONFIG.DEFAULT_GAS_LIMIT;
  
  // Calldata cost (4 gas per zero byte, 16 gas per non-zero byte)
  // Assume average of 12 gas per byte for simplicity
  const calldataCost = zkProofDataLength * 12;
  
  // Additional predicate costs
  const additionalCost = additionalPredicateCount * 50000;
  
  // Extension processing overhead
  const overheadCost = 30000;
  
  return baseZKCost + calldataCost + additionalCost + overheadCost;
}

/**
 * Debug utility to inspect ZK extension structure
 * @param extensionData ZK extension data to inspect
 * @returns Human-readable debug information
 */
export function debugZKExtension(extensionData: ZKExtensionData): {
  summary: string;
  details: {
    extensionLength: number;
    hashHex: string;
    gasEstimate: number;
    calldataBreakdown: {
      selector: string;
      predicateCall: string;
    };
  };
} {
  const extensionLength = (extensionData.extensionBytes.length - 2) / 2; // Remove 0x and convert to bytes
  const hashHex = `0x${extensionData.extensionHash.toString(16)}`;
  
  return {
    summary: `ZK Extension: ${extensionLength} bytes, hash ${hashHex.slice(0, 10)}..., ~${extensionData.gasEstimate} gas`,
    details: {
      extensionLength,
      hashHex,
      gasEstimate: extensionData.gasEstimate,
      calldataBreakdown: {
        selector: extensionData.predicateCall.slice(0, 10),
        predicateCall: `${extensionData.predicateCall.length} chars`
      }
    }
  };
} 