import { ethers } from "ethers";
import { buildTakerTraits } from "../../test/helpers/orderUtils";
import { formatBalance } from "../../test/helpers/testUtils";
import type { ZKOrderLifecycle } from "./zkOrderSigning";

/**
 * Configuration for ZK order fills
 */
export interface ZKFillConfig {
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxPriorityFeePerGas?: bigint;
  maxFeePerGas?: bigint;
  target?: string; // Taker address (auto-detected if not provided)
  interaction?: string; // Custom interaction data
  enableLogging?: boolean;
}

/**
 * Result of a ZK order fill
 */
export interface ZKFillResult {
  success: boolean;
  txHash?: string;
  receipt?: any;
  gasUsed?: bigint;
  error?: string;
  balanceChanges?: {
    makerMakingAssetDelta: bigint;
    makerTakingAssetDelta: bigint;
    takerMakingAssetDelta: bigint;
    takerTakingAssetDelta: bigint;
  };
}

/**
 * Fill a ZK order with automatic extension processing
 * @param lifecycle Complete ZK order lifecycle (must be ready_to_fill)
 * @param taker Signer who will fill the order
 * @param fillAmount Amount to fill (in taking asset units)
 * @param aggregationRouter The 1inch AggregationRouterV6 contract
 * @param config Optional configuration for the fill
 * @returns Promise<ZKFillResult> Fill result with transaction details
 */
export async function fillZKOrder(
  lifecycle: ZKOrderLifecycle,
  taker: any,
  fillAmount: bigint,
  aggregationRouter: any,
  config: ZKFillConfig = {}
): Promise<ZKFillResult> {
  
  // Validate lifecycle state
  if (lifecycle.status !== 'ready_to_fill') {
    return {
      success: false,
      error: `Cannot fill ZK order: order status is '${lifecycle.status}', expected 'ready_to_fill'`
    };
  }
  
  if (!lifecycle.signature) {
    return {
      success: false,
      error: 'Cannot fill ZK order: missing signature'
    };
  }
  
  const order = lifecycle.order;
  const signature = lifecycle.signature;
  
  // Log initial state if enabled
  if (config.enableLogging !== false) {
    console.log("\n🔄 Filling ZK order...");
    console.log(`   Order: ${formatBalance(order.makingAmount, 18, 'WETH')} → ${formatBalance(order.takingAmount, 6, 'USDC')}`);
    console.log(`   Fill amount: ${formatBalance(fillAmount, 6, 'USDC')}`);
    console.log(`   Extension: ${order.extension?.length || 0} bytes`);
  }
  
  try {
    // Step 1: Process ZK extension for taker traits
    const extension = order.extension || '0x';
    if (extension === '0x') {
      return {
        success: false,
        error: 'Cannot fill ZK order: missing required extension data'
      };
    }
    
    // Step 2: Build taker traits with extension processing
    const takerTraitsData = buildTakerTraits({
      makingAmount: false, // Consistent with existing tests - fillAmount refers to takingAmount
      extension: extension,
      target: config.target || taker.address,
      interaction: config.interaction || '0x'
    });
    
    if (config.enableLogging !== false) {
      console.log(`   Taker traits: ${takerTraitsData.traits.toString()}`);
      console.log(`   Extension args: ${takerTraitsData.args.length} bytes`);
    }
    
    // Step 3: Record balances before fill (for verification)
    const makerAssetContract = new ethers.Contract(order.makerAsset, [
      "function balanceOf(address) view returns (uint256)"
    ], taker.provider);
    
    const takingAssetContract = new ethers.Contract(order.takerAsset, [
      "function balanceOf(address) view returns (uint256)"
    ], taker.provider);
    
    const makerMakingAssetBefore = await makerAssetContract.balanceOf(order.maker);
    const makerTakingAssetBefore = await takingAssetContract.balanceOf(order.maker);
    const takerMakingAssetBefore = await makerAssetContract.balanceOf(taker.address);
    const takerTakingAssetBefore = await takingAssetContract.balanceOf(taker.address);
    
    // Step 4: Execute the fill using fillOrderArgs
    const fillTx = await aggregationRouter.connect(taker).fillOrderArgs(
      order,
      signature.r,
      signature.vs,
      fillAmount,
      takerTraitsData.traits,
      takerTraitsData.args, // Extension packed into args
      {
        gasLimit: config.gasLimit,
        gasPrice: config.gasPrice,
        maxPriorityFeePerGas: config.maxPriorityFeePerGas,
        maxFeePerGas: config.maxFeePerGas
      }
    );
    
    // Step 5: Wait for transaction confirmation
    const receipt = await fillTx.wait();
    
    if (config.enableLogging !== false) {
      console.log(`✅ ZK order filled successfully!`);
      console.log(`   Transaction: ${fillTx.hash}`);
      console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
    }
    
    // Step 6: Record balances after fill and calculate changes
    const makerMakingAssetAfter = await makerAssetContract.balanceOf(order.maker);
    const makerTakingAssetAfter = await takingAssetContract.balanceOf(order.maker);
    const takerMakingAssetAfter = await makerAssetContract.balanceOf(taker.address);
    const takerTakingAssetAfter = await takingAssetContract.balanceOf(taker.address);
    
    const balanceChanges = {
      makerMakingAssetDelta: BigInt(makerMakingAssetAfter) - BigInt(makerMakingAssetBefore),
      makerTakingAssetDelta: BigInt(makerTakingAssetAfter) - BigInt(makerTakingAssetBefore),
      takerMakingAssetDelta: BigInt(takerMakingAssetAfter) - BigInt(takerMakingAssetBefore),
      takerTakingAssetDelta: BigInt(takerTakingAssetAfter) - BigInt(takerTakingAssetBefore)
    };
    
    if (config.enableLogging !== false) {
      console.log("   Balance changes:");
      console.log(`     Maker: ${formatBalance(-balanceChanges.makerMakingAssetDelta, 18, 'WETH')} → +${formatBalance(balanceChanges.makerTakingAssetDelta, 6, 'USDC')}`);
      console.log(`     Taker: +${formatBalance(balanceChanges.takerMakingAssetDelta, 18, 'WETH')} → ${formatBalance(balanceChanges.takerTakingAssetDelta, 6, 'USDC')}`);
    }
    
    return {
      success: true,
      txHash: fillTx.hash,
      receipt,
      gasUsed: receipt.gasUsed,
      balanceChanges
    };
    
  } catch (error: any) {
    let errorMessage = `ZK order fill failed: ${error.message}`;
    
    // Try to decode specific error information
    if (error.data && typeof error.data === 'string') {
      errorMessage += `\n   Error data: ${error.data}`;
      
      // Check for specific error codes
      if (error.data.includes('0xdc11ee6b')) {
        errorMessage += '\n   -> This appears to be a 1inch protocol error';
      }
    }
    
    // Log transaction details if available
    if (error.transaction) {
      errorMessage += `\n   Transaction: ${JSON.stringify({
        to: error.transaction.to,
        data: error.transaction.data?.substring(0, 100) + '...',
        value: error.transaction.value
      }, null, 2)}`;
    }
    
    if (config.enableLogging !== false) {
      console.log(`❌ ${errorMessage}`);
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Estimate gas for filling a ZK order
 * @param lifecycle ZK order lifecycle
 * @param taker Taker signer
 * @param fillAmount Amount to fill
 * @param aggregationRouter Router contract
 * @returns Promise<bigint> Estimated gas limit
 */
export async function estimateZKFillGas(
  lifecycle: ZKOrderLifecycle,
  taker: any,
  fillAmount: bigint,
  aggregationRouter: any
): Promise<bigint> {
  
  if (lifecycle.status !== 'ready_to_fill' || !lifecycle.signature) {
    throw new Error('Cannot estimate gas: order not ready to fill');
  }
  
  const order = lifecycle.order;
  const signature = lifecycle.signature;
  
  // Process extension
  const extension = order.extension || '0x';
  const takerTraitsData = buildTakerTraits({
    makingAmount: false,
    extension: extension,
    target: taker.address,
    interaction: '0x'
  });
  
  try {
    // Estimate gas using the same parameters as actual fill
    const gasEstimate = await aggregationRouter.connect(taker).fillOrderArgs.estimateGas(
      order,
      signature.r,
      signature.vs,
      fillAmount,
      takerTraitsData.traits,
      takerTraitsData.args
    );
    
    // Add 10% buffer for safety
    return gasEstimate * 110n / 100n;
    
  } catch (error: any) {
    throw new Error(`Gas estimation failed: ${error.message}`);
  }
}

/**
 * Quick validation to check if a ZK order can be filled
 * @param lifecycle ZK order lifecycle
 * @param taker Taker address
 * @param fillAmount Amount to fill
 * @returns Validation result with errors if any
 */
export function validateZKOrderForFill(
  lifecycle: ZKOrderLifecycle,
  taker: string,
  fillAmount: bigint
): {
  canFill: boolean;
  errors: string[];
  warnings: string[];
} {
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check lifecycle status
  if (lifecycle.status !== 'ready_to_fill') {
    errors.push(`Order not ready to fill: status is '${lifecycle.status}'`);
  }
  
  // Check signature
  if (!lifecycle.signature) {
    errors.push('Missing order signature');
  }
  
  // Check extension
  if (!lifecycle.order.extension || lifecycle.order.extension === '0x') {
    errors.push('Missing required ZK extension data');
  }
  
  // Check fill amount
  if (fillAmount <= 0) {
    errors.push('Fill amount must be greater than zero');
  }
  
  if (fillAmount > lifecycle.order.takingAmount) {
    warnings.push('Fill amount exceeds order taking amount (partial fill will occur)');
  }
  
  // Check taker is not maker (common mistake)
  if (taker.toLowerCase() === lifecycle.order.maker.toLowerCase()) {
    warnings.push('Taker and maker are the same address');
  }
  
  return {
    canFill: errors.length === 0,
    errors,
    warnings
  };
} 