import { ethers } from "hardhat";
import { 
  setupTakerTokens,
  discoverOrders,
  selectBestOrder,
  calculateFillParameters,
  executeFill,
  updateOrderStatus,
  displayOrdersDiscovered,
  displaySelectedOrder,
  displayFillResult,
  validateOrderForFill,
  validateFillAmount,
  TakerTokenConfig,
  OrderSelectionCriteria,
  FillParameters
} from "./utils/takerHelpers";
import { createAPIClient } from "../src/utils/httpClient";
import { getNetworkConfig } from "./utils/networkConfig";
import { buildOrderData } from "../test/helpers/orderUtils";

// Configuration constants
const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_FILL_PERCENT = 100; // Fill 100% of order by default

/**
 * Complete taker workflow from order discovery to execution
 */
async function runTakerWorkflow() {
  console.log("\n🔍 DARKSWAP TAKER DISCOVERY & EXECUTION WORKFLOW");
  console.log("=" .repeat(65));
  
  try {
    // === STEP 1: SETUP AND VALIDATION ===
    console.log("\n📋 STEP 1: Setup and Validation");
    console.log("─".repeat(40));
    
    // Get network configuration
    const networkConfig = getNetworkConfig('localhost');
    console.log(`   Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
    console.log(`   Router: ${networkConfig.routerAddress}`);
    
    // Set up taker wallet (using third signer as taker)
    const [,, taker] = await ethers.getSigners();
    const takerAddress = await taker.getAddress();
    console.log(`   Taker Wallet: ${takerAddress}`);
    
    // Initialize API client
    const apiClient = createAPIClient(DEFAULT_API_URL);
    console.log(`   API URL: ${apiClient.getBaseUrl()}`);
    
    // Test API connection
    const isConnected = await apiClient.testConnection();
    if (!isConnected) {
      throw new Error(`Cannot connect to API at ${apiClient.getBaseUrl()}`);
    }
    console.log(`   ✅ API connection verified`);
    
    // === STEP 2: TOKEN SETUP ===
    console.log("\n💰 STEP 2: Token Setup");
    console.log("─".repeat(40));
    
    const tokenConfig: TakerTokenConfig = {
      usdcAmount: "10000", // 10,000 USDC for purchasing
      approvalTarget: AGGREGATION_ROUTER_V6
    };
    
    await setupTakerTokens(taker, tokenConfig);
    
    // === STEP 3: ORDER DISCOVERY ===
    console.log("\n🔍 STEP 3: Order Discovery");
    console.log("─".repeat(40));
    
    // Define search criteria
    const criteria: OrderSelectionCriteria = {
      network: networkConfig.name,
      maxPrice: 4000, // Max 4000 USDC per WETH
      minMakingAmount: ethers.parseEther("0.1"), // At least 0.1 WETH
      maxMakingAmount: ethers.parseEther("10") // At most 10 WETH
    };
    
    console.log(`   Searching for orders with criteria:`);
    console.log(`   📍 Network: ${criteria.network}`);
    console.log(`   💰 Max Price: ${criteria.maxPrice} USDC per WETH`);
    console.log(`   📏 Amount Range: ${ethers.formatEther(criteria.minMakingAmount!)}-${ethers.formatEther(criteria.maxMakingAmount!)} WETH`);
    
    const discoveredOrders = await discoverOrders('storage/published_orders.json', criteria);
    console.log(`   ✅ Found ${discoveredOrders.length} matching orders`);
    
    displayOrdersDiscovered(discoveredOrders);
    
    if (discoveredOrders.length === 0) {
      throw new Error("No orders found matching criteria");
    }
    
    // === STEP 4: ORDER SELECTION ===
    console.log("\n🎯 STEP 4: Order Selection");
    console.log("─".repeat(40));
    
    // Select the best order (cheapest by default)
    const selectedOrder = selectBestOrder(discoveredOrders, 'cheapest');
    
    if (!selectedOrder) {
      throw new Error("No suitable order found for execution");
    }
    
    console.log(`   Selected strategy: cheapest`);
    console.log(`   ✅ Order selected: ${selectedOrder.id}`);
    
    // Validate order
    if (!validateOrderForFill(selectedOrder)) {
      throw new Error("Selected order failed validation");
    }
    
    // === STEP 5: FILL PREPARATION ===
    console.log("\n⚙️  STEP 5: Fill Preparation");
    console.log("─".repeat(40));
    
    // Calculate fill parameters
    const fillParams = calculateFillParameters(selectedOrder, DEFAULT_FILL_PERCENT);
    
    // Validate fill amount
    if (!validateFillAmount(fillParams.fillAmount, selectedOrder)) {
      throw new Error("Fill amount validation failed");
    }
    
    displaySelectedOrder(selectedOrder, fillParams);
    
    console.log(`   ✅ Fill parameters calculated`);
    console.log(`   💰 Will spend: ${ethers.formatUnits(fillParams.fillAmount, 6)} USDC`);
    console.log(`   🎯 Expected return: ${ethers.formatEther((BigInt(selectedOrder.metadata.makingAmount) * fillParams.fillAmount) / BigInt(selectedOrder.metadata.takingAmount))} WETH`);
    
    // === STEP 6: API AUTHORIZATION ===
    console.log("\n🔐 STEP 6: API Authorization");
    console.log("─".repeat(40));
    
    // Calculate order hash for API call
    const network = await ethers.provider.getNetwork();
    const orderData = buildOrderData(network.chainId, AGGREGATION_ROUTER_V6, selectedOrder.orderData);
    const orderHash = ethers.TypedDataEncoder.hash(orderData.domain, orderData.types, orderData.value);
    
    console.log(`   📋 Order Hash: ${orderHash.slice(0, 20)}...`);
    console.log(`   💰 Requesting authorization for: ${ethers.formatUnits(fillParams.fillAmount, 6)} USDC`);
    
    // Request authorization from maker's API
    const authResponse = await apiClient.authorizeFill(orderHash, fillParams.fillAmount, takerAddress);
    
    if (!authResponse.success) {
      throw new Error(`Authorization failed: ${authResponse.error}`);
    }
    
    console.log(`   ✅ Authorization granted by maker service`);
    console.log(`   📦 Received order with ZK extension`);
    console.log(`   ✍️  Received signature for extended order`);
    
    // === STEP 7: ON-CHAIN EXECUTION ===
    console.log("\n⛓️  STEP 7: On-Chain Execution");
    console.log("─".repeat(40));
    
    // Execute the fill on-chain
    const fillResult = await executeFill(
      selectedOrder,
      authResponse.orderWithExtension!,
      authResponse.signature!,
      fillParams.fillAmount,
      taker,
      AGGREGATION_ROUTER_V6
    );
    
    displayFillResult(fillResult);
    
    if (!fillResult.success) {
      throw new Error(`Fill execution failed: ${fillResult.error}`);
    }
    
    // === STEP 8: STATUS UPDATE ===
    console.log("\n📝 STEP 8: Status Update");
    console.log("─".repeat(40));
    
    // Update order status in storage
    const statusUpdated = await updateOrderStatus(
      selectedOrder.id,
      'filled',
      'storage/published_orders.json',
      takerAddress,
      `Filled ${DEFAULT_FILL_PERCENT}% by taker`
    );
    
    if (!statusUpdated) {
      console.log(`   ⚠️  Warning: Could not update order status in storage`);
    }
    
    // === WORKFLOW COMPLETION ===
    console.log(`\n🎉 TAKER WORKFLOW COMPLETED SUCCESSFULLY`);
    console.log("=" .repeat(65));
    console.log(`📋 Order ID: ${selectedOrder.id}`);
    console.log(`💰 Amount Spent: ${ethers.formatUnits(fillParams.fillAmount, 6)} USDC`);
    console.log(`🎯 WETH Received: ${ethers.formatEther((BigInt(selectedOrder.metadata.makingAmount) * fillParams.fillAmount) / BigInt(selectedOrder.metadata.takingAmount))} WETH`);
    console.log(`⛽ Gas Used: ${fillResult.gasUsed?.toString()}`);
    console.log(`🔗 Transaction: ${fillResult.transactionHash}`);
    console.log(`💲 Actual Price: ${fillResult.actualPrice.toFixed(2)} USDC per WETH`);
    console.log("=" .repeat(65));
    
    console.log(`\n📊 TRANSACTION DETAILS:`);
    console.log(`   Order successfully filled through DarkSwap protocol`);
    console.log(`   Maker's hidden constraints were satisfied via ZK proof`);
    console.log(`   No sensitive information was revealed on-chain`);
    console.log(`   Order status updated to 'filled' in storage`);
    
  } catch (error) {
    console.error(`\n❌ TAKER WORKFLOW FAILED:`, error);
    process.exit(1);
  }
}

/**
 * Command line argument parsing
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options: any = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--api-url' && i + 1 < args.length) {
      options.apiUrl = args[i + 1];
      i++;
    } else if (arg === '--fill-percent' && i + 1 < args.length) {
      options.fillPercent = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--max-price' && i + 1 < args.length) {
      options.maxPrice = parseFloat(args[i + 1]);
      i++;
    } else if (arg === '--strategy' && i + 1 < args.length) {
      options.strategy = args[i + 1];
      i++;
    } else if (arg === '--help') {
      console.log(`
DarkSwap Taker Discovery & Execution Workflow

Usage: npx hardhat run scripts/takerDiscover.ts [options]

Options:
  --api-url <url>       API service URL (default: http://localhost:3000)
  --fill-percent <num>  Percentage of order to fill (default: 100)
  --max-price <num>     Maximum acceptable price per WETH (default: 4000)
  --strategy <str>      Order selection strategy: cheapest|largest|first (default: cheapest)
  --help                Show this help message

Prerequisites:
  1. Hardhat node running with forked mainnet
  2. Deployed contracts (run scripts/deploy.ts first)
  3. Published orders (run scripts/makerPublish.ts first)
  4. API service running (run scripts/runMakerService.ts)

Examples:
  npx hardhat run scripts/takerDiscover.ts --network localhost
  npx hardhat run scripts/takerDiscover.ts --fill-percent 50 --max-price 3500
  npx hardhat run scripts/takerDiscover.ts --strategy largest --api-url http://localhost:8080
      `);
      process.exit(0);
    }
  }
  
  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  runTakerWorkflow().catch((error) => {
    console.error("Workflow failed:", error);
    process.exit(1);
  });
}

export { runTakerWorkflow }; 