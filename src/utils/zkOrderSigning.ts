import { ethers } from "ethers";
import { signOrder } from "../../test/helpers/orderUtils";
import { validateZKOrder } from "./zkOrderBuilder";
import type { ZKEnabledOrder } from "./zkOrderBuilder";

/**
 * ZK Order signature components
 */
export interface ZKOrderSignature {
  r: string;
  vs: string;
  signature: string; // Original signature string
}

/**
 * ZK Order lifecycle state
 */
export interface ZKOrderLifecycle {
  order: ZKEnabledOrder;
  signature?: ZKOrderSignature;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    gasEstimate: number;
  };
  status: 'created' | 'signed' | 'validated' | 'ready_to_fill' | 'invalid';
}

/**
 * Configuration for ZK order operations
 */
export interface ZKOrderSigningConfig {
  chainId?: bigint;
  verifyingContract?: string;
  validateAfterSigning?: boolean;
  includeGasEstimate?: boolean;
}

/**
 * Sign a ZK-enabled order using EIP-712 standard
 * @param zkOrder The ZK-enabled order to sign
 * @param signer The wallet/signer to use for signing
 * @param config Optional configuration for signing
 * @returns Promise<ZKOrderSignature> Signature components
 */
export async function signZKOrder(
  zkOrder: ZKEnabledOrder,
  signer: any,
  config: ZKOrderSigningConfig = {}
): Promise<ZKOrderSignature> {
  
  // Validate order before signing if requested
  if (config.validateAfterSigning !== false) {
    const validation = validateZKOrder(zkOrder);
    if (!validation.isValid) {
      throw new Error(`Cannot sign invalid ZK order: ${validation.errors.join(', ')}`);
    }
  }
  
  // Determine chain ID and verifying contract
  const chainId = config.chainId || BigInt((await signer.provider?.getNetwork())?.chainId || 1);
  const verifyingContract = config.verifyingContract || "0x111111125421cA6dc452d289314280a0f8842A65"; // Default 1inch router
  
  try {
    // Use existing signOrder utility for EIP-712 signing
    const signature = await signOrder(zkOrder, chainId, verifyingContract, signer);
    
    // Extract signature components
    const sig = ethers.Signature.from(signature);
    
    return {
      r: sig.r,
      vs: sig.yParityAndS,
      signature: signature
    };
    
  } catch (error: any) {
    throw new Error(`Failed to sign ZK order: ${error.message}`);
  }
}

/**
 * Create a complete ZK order lifecycle object
 * @param zkOrder The ZK-enabled order
 * @param signature Optional signature if already signed
 * @returns ZKOrderLifecycle Complete lifecycle object
 */
export function createZKOrderLifecycle(
  zkOrder: ZKEnabledOrder,
  signature?: ZKOrderSignature
): ZKOrderLifecycle {
  
  // Validate the order
  const validationResult = validateZKOrder(zkOrder);
  
  // Ensure gasEstimate is always a number
  const validation = {
    isValid: validationResult.isValid,
    errors: validationResult.errors,
    warnings: validationResult.warnings,
    gasEstimate: validationResult.gasEstimate || 0
  };
  
  // Determine status based on validation and signature
  let status: ZKOrderLifecycle['status'];
  if (!validation.isValid) {
    status = 'invalid';
  } else if (signature) {
    status = validation.errors.length === 0 ? 'ready_to_fill' : 'validated';
  } else {
    status = 'created';
  }
  
  return {
    order: zkOrder,
    signature,
    validation,
    status
  };
}

/**
 * Complete ZK order lifecycle: create → sign → validate → prepare for fill
 * @param zkOrder The ZK-enabled order to process
 * @param signer The wallet/signer to use
 * @param config Optional configuration
 * @returns Promise<ZKOrderLifecycle> Complete lifecycle object
 */
export async function processZKOrderLifecycle(
  zkOrder: ZKEnabledOrder,
  signer: any,
  config: ZKOrderSigningConfig = {}
): Promise<ZKOrderLifecycle> {
  
  try {
    // Step 1: Initial validation
    let lifecycle = createZKOrderLifecycle(zkOrder);
    
    if (lifecycle.status === 'invalid') {
      return lifecycle;
    }
    
    // Step 2: Sign the order
    const signature = await signZKOrder(zkOrder, signer, config);
    lifecycle.signature = signature;
    lifecycle.status = 'signed';
    
    // Step 3: Re-validate after signing
    if (config.validateAfterSigning !== false) {
      lifecycle = createZKOrderLifecycle(zkOrder, signature);
    }
    
    // Step 4: Prepare for fill (status already set by createZKOrderLifecycle)
    return lifecycle;
    
  } catch (error: any) {
    // Return error state
    return {
      order: zkOrder,
      validation: {
        isValid: false,
        errors: [`Lifecycle processing failed: ${error.message}`],
        warnings: [],
        gasEstimate: 0
      },
      status: 'invalid'
    };
  }
}

/**
 * Validate a ZK order signature
 * @param zkOrder The ZK-enabled order
 * @param signature The signature to validate
 * @param config Configuration including chain ID and verifying contract
 * @returns boolean True if signature is valid
 */
export async function validateZKOrderSignature(
  zkOrder: ZKEnabledOrder,
  signature: ZKOrderSignature,
  config: ZKOrderSigningConfig = {}
): Promise<boolean> {
  
  try {
    // Check signature component format
    const hasValidR = signature.r.match(/^0x[0-9a-fA-F]{64}$/) !== null;
    const hasValidVs = signature.vs.match(/^0x[0-9a-fA-F]{64}$/) !== null;
    
    // Check original signature format and length (should be ~132 chars for EIP-712)
    const hasValidSignature = signature.signature.match(/^0x[0-9a-fA-F]{130,}$/) !== null;
    
    // All components must be valid
    return hasValidR && hasValidVs && hasValidSignature;
    
  } catch (error) {
    return false;
  }
}

/**
 * Prepare ZK order for filling (extract fill parameters)
 * @param lifecycle Complete ZK order lifecycle
 * @returns Fill preparation data
 */
export function prepareZKOrderForFill(lifecycle: ZKOrderLifecycle): {
  isReady: boolean;
  order: ZKEnabledOrder;
  signature?: ZKOrderSignature;
  fillArgs?: {
    r: string;
    vs: string;
    extension: string;
  };
  errors: string[];
} {
  
  // Check if order is ready for fill
  if (lifecycle.status !== 'ready_to_fill') {
    return {
      isReady: false,
      order: lifecycle.order,
      signature: lifecycle.signature,
      errors: ['Order is not ready for fill', ...lifecycle.validation.errors]
    };
  }
  
  // Prepare fill arguments
  const fillArgs = lifecycle.signature ? {
    r: lifecycle.signature.r,
    vs: lifecycle.signature.vs,
    extension: lifecycle.order.extension || '0x'
  } : undefined;
  
  return {
    isReady: true,
    order: lifecycle.order,
    signature: lifecycle.signature,
    fillArgs,
    errors: []
  };
}

/**
 * Utility to estimate gas for ZK order operations
 * @param zkOrder The ZK-enabled order
 * @returns Gas estimates for different operations
 */
export function estimateZKOrderGas(zkOrder: ZKEnabledOrder): {
  orderCreation: number;
  signing: number;
  validation: number;
  total: number;
} {
  
  // Base estimates (these would be calibrated through testing)
  const baseOrderGas = 21000; // Basic transaction
  const zkProofGas = zkOrder.zkMetadata.extensionData.gasEstimate;
  const signingGas = 5000; // EIP-712 signing overhead
  const validationGas = 10000; // Order validation
  
  return {
    orderCreation: zkProofGas,
    signing: signingGas,
    validation: validationGas,
    total: baseOrderGas + zkProofGas + signingGas + validationGas
  };
} 