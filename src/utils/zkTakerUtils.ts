import { ethers } from "hardhat";
import { buildTakerTraits } from "../../test/helpers/orderUtils";
import type { ZKOrderLifecycle } from "./zkOrderSigning";
import type { ZKEnabledOrder } from "./zkOrderBuilder";

/**
 * Taker-specific configuration for ZK order interactions
 */
export interface ZKTakerConfig {
  takerAddress: string;
  slippageTolerance?: number; // basis points, default 50 (0.5%)
  maxGasPrice?: bigint;
  deadline?: number; // unix timestamp
  enablePreflightChecks?: boolean; // default true
  enableBalanceChecks?: boolean; // default true
}

/**
 * Comprehensive validation result for taker perspective
 */
export interface ZKTakerValidationResult {
  canFill: boolean;
  severity: 'success' | 'warning' | 'error';
  issues: {
    type: 'error' | 'warning' | 'info';
    category: 'order' | 'balance' | 'gas' | 'network' | 'zk';
    message: string;
    suggestion?: string;
  }[];
  estimatedGas?: bigint;
  requiredBalance?: {
    asset: string;
    amount: bigint;
    current?: bigint;
  };
}

/**
 * Fill arguments prepared for execution
 */
export interface ZKFillArguments {
  order: ZKEnabledOrder;
  signature: {
    r: string;
    vs: string;
  };
  fillAmount: bigint;
  takerTraits: bigint;
  takerArgs: string;
  gasLimit: bigint;
  config: {
    target: string;
    interaction: string;
  };
}

/**
 * Gas comparison between ZK and standard fills
 */
export interface GasComparison {
  zkFillGas: bigint;
  standardFillGas: bigint;
  overhead: bigint;
  overheadPercentage: number;
  recommendation: 'efficient' | 'acceptable' | 'expensive';
}

/**
 * Comprehensive taker-side validation for ZK orders
 * This is the main validation function takers should use before attempting fills
 * 
 * @param lifecycle Complete ZK order lifecycle
 * @param config Taker configuration
 * @param provider Ethereum provider for balance/state checks
 * @returns Detailed validation result with actionable insights
 */
export async function validateZKOrderForTaker(
  lifecycle: ZKOrderLifecycle,
  config: ZKTakerConfig,
  provider: ethers.Provider
): Promise<ZKTakerValidationResult> {
  const issues: ZKTakerValidationResult['issues'] = [];
  
  // 1. Basic order validation
  if (lifecycle.status !== 'ready_to_fill') {
    issues.push({
      type: 'error',
      category: 'order',
      message: `Order not ready to fill: status is '${lifecycle.status}'`,
      suggestion: 'Wait for maker to complete order preparation'
    });
  }
  
  if (!lifecycle.signature) {
    issues.push({
      type: 'error',
      category: 'order',
      message: 'Missing order signature',
      suggestion: 'Request signed order from maker'
    });
  }
  
  // 2. ZK-specific validation
  if (!lifecycle.order.extension || lifecycle.order.extension === '0x') {
    issues.push({
      type: 'error',
      category: 'zk',
      message: 'Missing ZK extension data',
      suggestion: 'This appears to be a standard order, not a ZK order'
    });
  }
  
  // Check ZK metadata
  if (lifecycle.order.zkMetadata) {
    if (!lifecycle.order.zkMetadata.commitment) {
      issues.push({
        type: 'warning',
        category: 'zk',
        message: 'Missing commitment in ZK metadata'
      });
    }
    
    if (!lifecycle.order.zkMetadata.extensionData) {
      issues.push({
        type: 'warning',
        category: 'zk',
        message: 'Missing extension data in ZK metadata'
      });
    }
  }
  
  // 3. Economic validation
  const order = lifecycle.order;
  
  // Check for reasonable exchange rate
  if (order.makingAmount > 0 && order.takingAmount > 0) {
    const exchangeRate = (order.takingAmount * BigInt(1e18)) / order.makingAmount;
    
    if (exchangeRate === 0n) {
      issues.push({
        type: 'warning',
        category: 'order',
        message: 'Exchange rate appears to be zero or very small'
      });
    }
  }
  
  // 4. Balance checks (if enabled)
  let requiredBalance: ZKTakerValidationResult['requiredBalance'] | undefined;
  
  if (config.enableBalanceChecks !== false) {
    try {
      const takingAssetContract = new ethers.Contract(
        order.takerAsset,
        ["function balanceOf(address) view returns (uint256)"],
        provider
      );
      
      const currentBalance = await takingAssetContract.balanceOf(config.takerAddress);
      const required = order.takingAmount;
      
      requiredBalance = {
        asset: order.takerAsset,
        amount: required,
        current: currentBalance
      };
      
      if (currentBalance < required) {
        issues.push({
          type: 'error',
          category: 'balance',
          message: `Insufficient balance: have ${currentBalance}, need ${required}`,
          suggestion: 'Acquire more tokens or reduce fill amount'
        });
      } else if (currentBalance < required * 105n / 100n) {
        issues.push({
          type: 'warning',
          category: 'balance',
          message: 'Balance is close to required amount (less than 5% buffer)',
          suggestion: 'Consider acquiring slightly more tokens for safety'
        });
      }
    } catch (error) {
      issues.push({
        type: 'warning',
        category: 'balance',
        message: 'Could not check taker balance',
        suggestion: 'Verify token contract and network connection'
      });
    }
  }
  
  // 5. Deadline validation
  if (config.deadline) {
    const now = Math.floor(Date.now() / 1000);
    if (config.deadline <= now) {
      issues.push({
        type: 'error',
        category: 'order',
        message: 'Order deadline has passed',
        suggestion: 'Use a future deadline or fill immediately'
      });
    } else if (config.deadline - now < 300) { // 5 minutes
      issues.push({
        type: 'warning',
        category: 'order',
        message: 'Order deadline is very soon (less than 5 minutes)',
        suggestion: 'Consider extending deadline or fill quickly'
      });
    }
  }
  
  // 6. Self-dealing check
  if (config.takerAddress.toLowerCase() === order.maker.toLowerCase()) {
    issues.push({
      type: 'warning',
      category: 'order',
      message: 'Taker and maker are the same address (self-dealing)',
      suggestion: 'Verify this is intentional'
    });
  }
  
  // Determine overall result
  const hasErrors = issues.some(issue => issue.type === 'error');
  const hasWarnings = issues.some(issue => issue.type === 'warning');
  
  return {
    canFill: !hasErrors,
    severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
    issues,
    requiredBalance
  };
}

/**
 * Quick pre-flight check for ZK order filling
 * Lightweight version for rapid validation without extensive checks
 * 
 * @param lifecycle ZK order lifecycle
 * @param takerAddress Taker address
 * @param fillAmount Amount to fill
 * @returns Simple boolean result with basic error info
 */
export function canFillZKOrder(
  lifecycle: ZKOrderLifecycle,
  takerAddress: string,
  fillAmount: bigint
): {
  canFill: boolean;
  reason?: string;
  quickFix?: string;
} {
  // Quick status check
  if (lifecycle.status !== 'ready_to_fill') {
    return {
      canFill: false,
      reason: `Order status is '${lifecycle.status}', not 'ready_to_fill'`,
      quickFix: 'Wait for order preparation to complete'
    };
  }
  
  // Quick signature check
  if (!lifecycle.signature) {
    return {
      canFill: false,
      reason: 'Order is not signed',
      quickFix: 'Request signature from maker'
    };
  }
  
  // Quick extension check
  if (!lifecycle.order.extension || lifecycle.order.extension === '0x') {
    return {
      canFill: false,
      reason: 'Missing ZK extension data',
      quickFix: 'Verify this is a ZK order'
    };
  }
  
  // Quick amount check
  if (fillAmount <= 0) {
    return {
      canFill: false,
      reason: 'Fill amount must be greater than zero',
      quickFix: 'Specify a positive fill amount'
    };
  }
  
  if (fillAmount > lifecycle.order.takingAmount) {
    return {
      canFill: false,
      reason: 'Fill amount exceeds order taking amount',
      quickFix: 'Reduce fill amount or use partial fill'
    };
  }
  
  return { canFill: true };
}

/**
 * Accurate gas estimation for ZK fills with comparison to standard fills
 * 
 * @param lifecycle ZK order lifecycle
 * @param taker Taker signer
 * @param fillAmount Amount to fill
 * @param aggregationRouter Router contract
 * @returns Gas comparison and estimation
 */
export async function estimateFillGas(
  lifecycle: ZKOrderLifecycle,
  taker: any,
  fillAmount: bigint,
  aggregationRouter: any
): Promise<GasComparison> {
  if (lifecycle.status !== 'ready_to_fill' || !lifecycle.signature) {
    throw new Error('Cannot estimate gas: order not ready to fill');
  }
  
  const order = lifecycle.order;
  const signature = lifecycle.signature;
  
  // Estimate ZK fill gas
  const extension = order.extension || '0x';
  const takerTraitsData = buildTakerTraits({
    makingAmount: false,
    extension: extension,
    target: taker.address,
    interaction: '0x'
  });
  
  const zkFillGas = await aggregationRouter.connect(taker).fillOrderArgs.estimateGas(
    order,
    signature.r,
    signature.vs,
    fillAmount,
    takerTraitsData.traits,
    takerTraitsData.args
  );
  
  // Estimate standard fill gas (without extension)
  const standardTakerTraits = buildTakerTraits({
    makingAmount: false,
    target: taker.address,
    interaction: '0x'
  });
  
  let standardFillGas: bigint;
  try {
    // Create a simplified order without extension for comparison
    const standardOrder = {
      ...order,
      extension: '0x'
    };
    
    standardFillGas = await aggregationRouter.connect(taker).fillOrderArgs.estimateGas(
      standardOrder,
      signature.r,
      signature.vs,
      fillAmount,
      standardTakerTraits.traits,
      standardTakerTraits.args
    );
  } catch (error) {
    // If we can't estimate standard fill, use a reasonable baseline
    standardFillGas = 100000n; // Typical 1inch fill gas
  }
  
  const overhead = zkFillGas - standardFillGas;
  const overheadPercentage = Number((overhead * 100n) / standardFillGas);
  
  let recommendation: GasComparison['recommendation'];
  if (overheadPercentage < 20) {
    recommendation = 'efficient';
  } else if (overheadPercentage < 50) {
    recommendation = 'acceptable';
  } else {
    recommendation = 'expensive';
  }
  
  return {
    zkFillGas,
    standardFillGas,
    overhead,
    overheadPercentage,
    recommendation
  };
}

/**
 * Prepare and validate all arguments needed for ZK order fill execution
 * 
 * @param lifecycle ZK order lifecycle
 * @param config Taker configuration
 * @param fillAmount Amount to fill
 * @param gasLimit Optional gas limit override
 * @returns Complete fill arguments ready for execution
 */
export async function prepareFillArguments(
  lifecycle: ZKOrderLifecycle,
  config: ZKTakerConfig,
  fillAmount: bigint,
  gasLimit?: bigint
): Promise<ZKFillArguments> {
  // Validate prerequisites
  if (lifecycle.status !== 'ready_to_fill') {
    throw new Error(`Cannot prepare fill: order status is '${lifecycle.status}'`);
  }
  
  if (!lifecycle.signature) {
    throw new Error('Cannot prepare fill: missing signature');
  }
  
  const order = lifecycle.order;
  const signature = lifecycle.signature;
  
  // Validate fill amount
  if (fillAmount <= 0) {
    throw new Error('Fill amount must be greater than zero');
  }
  
  if (fillAmount > order.takingAmount) {
    throw new Error(`Fill amount ${fillAmount} exceeds order taking amount ${order.takingAmount}`);
  }
  
  // Process extension
  const extension = order.extension || '0x';
  if (extension === '0x') {
    throw new Error('Cannot prepare ZK fill: missing extension data');
  }
  
  // Build taker traits with proper configuration
  const takerTraitsData = buildTakerTraits({
    makingAmount: false, // fillAmount refers to takingAmount
    extension: extension,
    target: config.takerAddress,
    interaction: '0x'
  });
  
  // Determine gas limit
  let finalGasLimit = gasLimit;
  if (!finalGasLimit) {
    // Use a reasonable default for ZK fills
    finalGasLimit = 300000n; // Higher than standard fills due to ZK verification
  }
  
  return {
    order,
    signature: {
      r: signature.r,
      vs: signature.vs
    },
    fillAmount,
    takerTraits: takerTraitsData.traits,
    takerArgs: takerTraitsData.args,
    gasLimit: finalGasLimit,
    config: {
      target: config.takerAddress,
      interaction: '0x'
    }
  };
}

/**
 * Validate fill parameters from taker perspective with optimization suggestions
 * 
 * @param fillAmount Requested fill amount
 * @param order ZK order details
 * @param config Taker configuration
 * @returns Validation result with optimization suggestions
 */
export function validateFillParameters(
  fillAmount: bigint,
  order: ZKEnabledOrder,
  config: ZKTakerConfig
): {
  isValid: boolean;
  optimizations: string[];
  warnings: string[];
  errors: string[];
} {
  const optimizations: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Validate fill amount
  if (fillAmount <= 0) {
    errors.push('Fill amount must be greater than zero');
  }
  
  if (fillAmount > order.takingAmount) {
    errors.push(`Fill amount ${fillAmount} exceeds order taking amount ${order.takingAmount}`);
  }
  
  // Check for partial fills
  if (fillAmount < order.takingAmount) {
    const fillPercentage = (fillAmount * 100n) / order.takingAmount;
    if (fillPercentage < 10n) {
      warnings.push(`Very small fill (${fillPercentage}% of order) - consider larger amount for efficiency`);
    }
    optimizations.push('Consider filling the complete order to maximize efficiency');
  }
  
  // Check slippage tolerance
  if (config.slippageTolerance && config.slippageTolerance > 500) { // 5%
    warnings.push(`High slippage tolerance (${config.slippageTolerance / 100}%) may result in unfavorable fills`);
  }
  
  // Check for round numbers (often more efficient)
  const fillAmountStr = fillAmount.toString();
  const trailingZeros = fillAmountStr.length - fillAmountStr.replace(/0+$/, '').length;
  if (trailingZeros < 2 && fillAmount > 1000n) {
    optimizations.push('Consider using round numbers for gas efficiency');
  }
  
  // Check deadline urgency
  if (config.deadline) {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = config.deadline - now;
    if (timeLeft < 300) { // 5 minutes
      warnings.push('Tight deadline - ensure quick execution');
    }
  }
  
  return {
    isValid: errors.length === 0,
    optimizations,
    warnings,
    errors
  };
}

/**
 * Get user-friendly summary of ZK order for taker decision making
 * 
 * @param lifecycle ZK order lifecycle
 * @param config Taker configuration
 * @returns Human-readable summary with key decision points
 */
export function getZKOrderTakerSummary(
  lifecycle: ZKOrderLifecycle,
  config: ZKTakerConfig
): {
  status: string;
  exchangeRate: string;
  zkFeatures: string[];
  riskFactors: string[];
  recommendation: 'fill' | 'caution' | 'avoid';
  reasoning: string;
} {
  const order = lifecycle.order;
  const zkFeatures: string[] = [];
  const riskFactors: string[] = [];
  
  // Analyze ZK features
  if (order.zkMetadata?.commitment) {
    zkFeatures.push('Hidden price thresholds (commitment-based)');
  }
  
  if (order.extension && order.extension.length > 100) {
    zkFeatures.push('Complex ZK verification logic');
  }
  
  zkFeatures.push('On-chain privacy protection');
  
  // Analyze risk factors
  if (lifecycle.status !== 'ready_to_fill') {
    riskFactors.push('Order not yet ready for filling');
  }
  
  if (!lifecycle.signature) {
    riskFactors.push('Order not signed by maker');
  }
  
  if (config.takerAddress.toLowerCase() === order.maker.toLowerCase()) {
    riskFactors.push('Self-dealing transaction');
  }
  
  // Calculate exchange rate
  const rate = order.makingAmount > 0 
    ? (order.takingAmount * BigInt(1e18)) / order.makingAmount
    : 0n;
  const exchangeRate = `1 making token = ${rate} taking tokens (scaled by 1e18)`;
  
  // Make recommendation
  let recommendation: 'fill' | 'caution' | 'avoid';
  let reasoning: string;
  
  if (riskFactors.length === 0) {
    recommendation = 'fill';
    reasoning = 'Order appears ready and safe to fill';
  } else if (riskFactors.length <= 2 && !riskFactors.includes('Order not signed by maker')) {
    recommendation = 'caution';
    reasoning = 'Minor issues present, but fillable with care';
  } else {
    recommendation = 'avoid';
    reasoning = 'Significant issues present, avoid filling';
  }
  
  return {
    status: lifecycle.status,
    exchangeRate,
    zkFeatures,
    riskFactors,
    recommendation,
    reasoning
  };
} 