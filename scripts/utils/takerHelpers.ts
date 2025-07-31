import { ethers } from "hardhat";
import { OrderStorage } from "../../src/storage/orderStorage";
import { DarkSwapAPIClient } from "../../src/utils/httpClient";
import { PublishedOrder } from "../../src/types/orderTypes";
import { buildTakerTraits } from "../../test/helpers/orderUtils";

/**
 * Taker token setup configuration
 */
export interface TakerTokenConfig {
  usdcAmount: string; // In USDC units (e.g. "10000")
  approvalTarget: string; // Router address
}

/**
 * Order selection criteria
 */
export interface OrderSelectionCriteria {
  maxPrice?: number; // Maximum acceptable price per WETH
  minMakingAmount?: bigint; // Minimum WETH amount
  maxMakingAmount?: bigint; // Maximum WETH amount
  preferredMaker?: string; // Specific maker address
  network?: string; // Network filter
}

/**
 * Fill execution result
 */
export interface FillExecutionResult {
  success: boolean;
  transactionHash?: string;
  gasUsed?: bigint;
  error?: string;
  timestamp: string;
  orderHash: string;
  fillAmount: bigint;
  actualPrice: number;
}

/**
 * Setup taker tokens (USDC for buying WETH)
 */
export async function setupTakerTokens(
  taker: any,
  config: TakerTokenConfig
): Promise<void> {
  const { ethers: hre, network } = await import("hardhat");
  
  // Token addresses
  const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  
  // Whale account with large USDC balance
  const usdcWhale = "0x28C6c06298d514Db089934071355E5743bf21d60";
  
  console.log(`   Setting up USDC for taker: ${await taker.getAddress()}`);
  
  // Impersonate whale account
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [usdcWhale]
  });

  // Provide ETH for gas
  await network.provider.send("hardhat_setBalance", [usdcWhale, "0xDE0B6B3A7640000"]);

  const usdcWhaleSigner = await hre.getSigner(usdcWhale);

  // Get USDC contract
  const usdcContract = await hre.getContractAt("MockERC20", USDC_ADDRESS);

  // Transfer USDC to taker
  const usdcAmount = hre.parseUnits(config.usdcAmount, 6);
  
  await usdcContract.connect(usdcWhaleSigner).transfer(await taker.getAddress(), usdcAmount);

  // Approve router to spend USDC
  await usdcContract.connect(taker).approve(config.approvalTarget, ethers.MaxUint256);

  console.log(`   ✅ USDC: ${config.usdcAmount} USDC transferred and approved`);
}

/**
 * Discover orders from storage
 */
export async function discoverOrders(
  storageFile: string = 'storage/published_orders.json',
  criteria?: OrderSelectionCriteria
): Promise<PublishedOrder[]> {
  try {
    const orderStorage = new OrderStorage(storageFile);
    
    // Get all active orders
    const activeOrders = await orderStorage.getActiveOrders(criteria?.network);
    
    if (!criteria) {
      return activeOrders;
    }
    
    // Apply filtering criteria
    return activeOrders.filter(order => {
      const makingAmount = BigInt(order.metadata.makingAmount);
      const takingAmount = BigInt(order.metadata.takingAmount);
      
      // Calculate price per WETH
      const pricePerWeth = Number(ethers.formatUnits(takingAmount, 6)) / Number(ethers.formatEther(makingAmount));
      
      // Apply filters
      if (criteria.maxPrice && pricePerWeth > criteria.maxPrice) {
        return false;
      }
      
      if (criteria.minMakingAmount && makingAmount < criteria.minMakingAmount) {
        return false;
      }
      
      if (criteria.maxMakingAmount && makingAmount > criteria.maxMakingAmount) {
        return false;
      }
      
      if (criteria.preferredMaker && order.metadata.maker.toLowerCase() !== criteria.preferredMaker.toLowerCase()) {
        return false;
      }
      
      return true;
    });
  } catch (error) {
    console.error(`   ❌ Failed to discover orders:`, error);
    throw error;
  }
}

/**
 * Select the best order based on criteria
 */
export function selectBestOrder(
  orders: PublishedOrder[],
  strategy: 'cheapest' | 'largest' | 'first' = 'cheapest'
): PublishedOrder | null {
  if (orders.length === 0) {
    return null;
  }
  
  switch (strategy) {
    case 'cheapest':
      return orders.reduce((best, current) => {
        const bestPrice = Number(ethers.formatUnits(BigInt(best.metadata.takingAmount), 6)) / 
                         Number(ethers.formatEther(BigInt(best.metadata.makingAmount)));
        const currentPrice = Number(ethers.formatUnits(BigInt(current.metadata.takingAmount), 6)) / 
                           Number(ethers.formatEther(BigInt(current.metadata.makingAmount)));
        return currentPrice < bestPrice ? current : best;
      });
      
    case 'largest':
      return orders.reduce((best, current) => {
        const bestAmount = BigInt(best.metadata.makingAmount);
        const currentAmount = BigInt(current.metadata.makingAmount);
        return currentAmount > bestAmount ? current : best;
      });
      
    case 'first':
    default:
      return orders[0];
  }
}

/**
 * Calculate fill parameters
 */
export interface FillParameters {
  fillAmount: bigint;
  expectedCost: bigint;
  pricePerWeth: number;
  percentageOfOrder: number;
}

export function calculateFillParameters(
  order: PublishedOrder,
  desiredFillPercent: number = 100 // Percentage of order to fill
): FillParameters {
  const makingAmount = BigInt(order.metadata.makingAmount);
  const takingAmount = BigInt(order.metadata.takingAmount);
  
  // Calculate fill amount (percentage of taking amount)
  const fillAmount = (takingAmount * BigInt(Math.floor(desiredFillPercent))) / 100n;
  
  // Calculate expected WETH received (proportional)
  const expectedWethReceived = (makingAmount * fillAmount) / takingAmount;
  
  // Calculate price per WETH
  const pricePerWeth = Number(ethers.formatUnits(takingAmount, 6)) / Number(ethers.formatEther(makingAmount));
  
  return {
    fillAmount,
    expectedCost: fillAmount,
    pricePerWeth,
    percentageOfOrder: desiredFillPercent
  };
}

/**
 * Execute order fill on-chain
 */
export async function executeFill(
  order: PublishedOrder,
  orderWithExtension: any,
  signature: string,
  fillAmount: bigint,
  taker: any,
  routerAddress: string
): Promise<FillExecutionResult> {
  const startTime = new Date().toISOString();
  
  try {
    console.log(`   🔄 Executing fill on-chain...`);
    console.log(`   📝 Order Hash: ${ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(orderWithExtension))).slice(0, 20)}...`);
    console.log(`   💰 Fill Amount: ${ethers.formatUnits(fillAmount, 6)} USDC`);
    
    // Import the full ABI (like working demoFullExecution.ts)
    const AggregationRouterV6ABI = await import("../../abi/AggregationRouterV6.json");
    
    // Get router contract with full ABI (like working version)
    const router = new ethers.Contract(
      routerAddress,
      AggregationRouterV6ABI.default,
      ethers.provider
    );
    
    // Parse signature (like working version)
    const sig = ethers.Signature.from(signature);
    const r = sig.r;
    const vs = sig.yParityAndS; // Use yParityAndS like working tests
    
    // Extract extension and build taker traits (following working pattern exactly)
    const extension = orderWithExtension.extension || '0x';
    const takerTraitsData = buildTakerTraits({
      makingAmount: false,        // Consistent with PredicateExtensions tests
      extension: extension,
      target: await taker.getAddress(), // Important: include target
      interaction: '0x'           // Important: include interaction
    });
    
    console.log(`   🔧 Taker Traits: ${takerTraitsData.traits}`);
    console.log(`   📎 Extension Args: ${takerTraitsData.args.slice(0, 50)}...`);
    
    // Execute the fill (following working pattern exactly)
    const tx = await (router.connect(taker) as any).fillOrderArgs(
      orderWithExtension,
      r,
      vs,
      fillAmount,
      takerTraitsData.traits,
      takerTraitsData.args // Extension packed into args
    );
    
    console.log(`   📤 Transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`   ✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);
    
    // Calculate actual price paid
    const actualPrice = Number(ethers.formatUnits(fillAmount, 6)) / 
                       Number(ethers.formatEther(orderWithExtension.makingAmount));
    
    return {
      success: true,
      transactionHash: receipt.hash,
      gasUsed: receipt.gasUsed,
      timestamp: startTime,
      orderHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(orderWithExtension))),
      fillAmount,
      actualPrice
    };
    
  } catch (error: any) {
    console.error(`   ❌ Fill execution failed:`, error);
    
    // Add error decoding (like working version)
    if (error.data) {
      try {
        const errorInterface = new ethers.Interface([
          "error PredicateIsNotTrue()",
          "error BadSignature()",
          "error InvalidOrder()",
          "error InsufficientBalance()",
          "error TransferFailed()"
        ]);
        const decodedError = errorInterface.parseError(error.data);
        console.log(`   🔍 Decoded error: ${decodedError?.name}`);
      } catch {
        console.log(`   📝 Raw error data: ${error.data}`);
      }
    }
    
    return {
      success: false,
      error: error.message || 'Unknown execution error',
      timestamp: startTime,
      orderHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(orderWithExtension))),
      fillAmount,
      actualPrice: 0
    };
  }
}

/**
 * Update order status in storage
 */
export async function updateOrderStatus(
  orderId: string,
  status: 'filled' | 'cancelled',
  storageFile: string = 'storage/published_orders.json',
  updatedBy?: string,
  reason?: string
): Promise<boolean> {
  try {
    const orderStorage = new OrderStorage(storageFile);
    
    const result = await orderStorage.updateOrderStatus({
      orderId,
      status,
      updatedBy,
      reason
    });
    
    if (result.success) {
      console.log(`   ✅ Order status updated to '${status}': ${orderId}`);
      return true;
    } else {
      console.error(`   ❌ Failed to update order status: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error updating order status:`, error);
    return false;
  }
}

/**
 * Display utilities
 */
export function displayOrdersDiscovered(orders: PublishedOrder[]): void {
  console.log(`\n📋 DISCOVERED ORDERS (${orders.length} found)`);
  console.log("=" .repeat(80));
  
  if (orders.length === 0) {
    console.log("   No orders found matching criteria");
    return;
  }
  
  orders.forEach((order, index) => {
    const makingAmount = BigInt(order.metadata.makingAmount);
    const takingAmount = BigInt(order.metadata.takingAmount);
    const pricePerWeth = Number(ethers.formatUnits(takingAmount, 6)) / Number(ethers.formatEther(makingAmount));
    
    console.log(`\n   [${index + 1}] Order ID: ${order.id}`);
    console.log(`       Maker: ${order.metadata.maker}`);
    console.log(`       Offering: ${ethers.formatEther(makingAmount)} WETH`);
    console.log(`       Price: ${pricePerWeth.toFixed(2)} USDC per WETH`);
    console.log(`       Total Cost: ${ethers.formatUnits(takingAmount, 6)} USDC`);
    console.log(`       Network: ${order.metadata.network}`);
    console.log(`       Status: ${order.metadata.status}`);
    console.log(`       Published: ${new Date(order.metadata.published).toLocaleString()}`);
  });
  
  console.log("=" .repeat(80));
}

export function displaySelectedOrder(order: PublishedOrder, params: FillParameters): void {
  console.log(`\n🎯 SELECTED ORDER`);
  console.log("=" .repeat(50));
  console.log(`   Order ID: ${order.id}`);
  console.log(`   Maker: ${order.metadata.maker}`);
  console.log(`   Total Available: ${ethers.formatEther(BigInt(order.metadata.makingAmount))} WETH`);
  console.log(`   Fill Percentage: ${params.percentageOfOrder}%`);
  console.log(`   Fill Amount: ${ethers.formatUnits(params.fillAmount, 6)} USDC`);
  console.log(`   Expected WETH: ${ethers.formatEther((BigInt(order.metadata.makingAmount) * params.fillAmount) / BigInt(order.metadata.takingAmount))} WETH`);
  console.log(`   Price: ${params.pricePerWeth.toFixed(2)} USDC per WETH`);
  console.log("=" .repeat(50));
}

export function displayFillResult(result: FillExecutionResult): void {
  console.log(`\n${result.success ? '🎉' : '❌'} FILL EXECUTION RESULT`);
  console.log("=" .repeat(50));
  console.log(`   Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  
  if (result.success) {
    console.log(`   Transaction Hash: ${result.transactionHash}`);
    console.log(`   Gas Used: ${result.gasUsed?.toString()}`);
    console.log(`   Fill Amount: ${ethers.formatUnits(result.fillAmount, 6)} USDC`);
    console.log(`   Actual Price: ${result.actualPrice.toFixed(2)} USDC per WETH`);
  } else {
    console.log(`   Error: ${result.error}`);
  }
  
  console.log(`   Timestamp: ${new Date(result.timestamp).toLocaleString()}`);
  console.log("=" .repeat(50));
}

/**
 * Validation utilities
 */
export function validateOrderForFill(order: PublishedOrder): boolean {
  if (order.metadata.status !== 'active') {
    console.error(`   ❌ Order is not active: ${order.metadata.status}`);
    return false;
  }
  
  const makingAmount = BigInt(order.metadata.makingAmount);
  const takingAmount = BigInt(order.metadata.takingAmount);
  
  if (makingAmount <= 0n || takingAmount <= 0n) {
    console.error(`   ❌ Invalid order amounts`);
    return false;
  }
  
  if (!ethers.isAddress(order.metadata.maker)) {
    console.error(`   ❌ Invalid maker address`);
    return false;
  }
  
  return true;
}

export function validateFillAmount(fillAmount: bigint, order: PublishedOrder): boolean {
  const maxTakingAmount = BigInt(order.metadata.takingAmount);
  
  if (fillAmount <= 0n) {
    console.error(`   ❌ Fill amount must be positive`);
    return false;
  }
  
  if (fillAmount > maxTakingAmount) {
    console.error(`   ❌ Fill amount exceeds order capacity`);
    return false;
  }
  
  return true;
} 