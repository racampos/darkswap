import { ethers } from "hardhat";
import { buildCommitmentOrder, signCommitmentOrder } from "../src/utils/commitmentOrders";
import { 
  setupMakerTokens, 
  registerSecretsWithAPI, 
  testAPIHealth,
  publishOrderToStorage,
  verifyPublishedOrder,
  displayOrderSummary,
  displaySecretsSummary,
  PublishOrderRequest
} from "./utils/makerHelpers";
import { getNetworkConfig } from "./utils/networkConfig";
import { buildOrderData } from "../test/helpers/orderUtils";

// Configuration constants
const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const DEFAULT_API_URL = "http://localhost:3000";

/**
 * Complete maker workflow from order creation to publishing
 */
async function runMakerWorkflow() {
  console.log("\n🏗️  DARKSWAP MAKER PUBLISHING WORKFLOW");
  console.log("=" .repeat(60));
  
  try {
    // === STEP 1: SETUP AND VALIDATION ===
    console.log("\n📋 STEP 1: Setup and Validation");
    console.log("─".repeat(40));
    
    // Get network configuration
    const networkConfig = getNetworkConfig('localhost');
    console.log(`   Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
    console.log(`   Router: ${networkConfig.routerAddress}`);
    
    // Set up maker wallet
    const [, maker] = await ethers.getSigners(); // Use second signer as maker
    const makerAddress = await maker.getAddress();
    console.log(`   Maker Wallet: ${makerAddress}`);
    
    // Test API health
    const apiHealthy = await testAPIHealth(DEFAULT_API_URL);
    if (!apiHealthy) {
      console.log(`   ⚠️  Warning: API health check failed, continuing anyway...`);
    }
    
    // === STEP 2: TOKEN SETUP ===
    console.log("\n💰 STEP 2: Token Setup");
    console.log("─".repeat(40));
    
    await setupMakerTokens(maker, {
      wethAmount: "10",
      usdcAmount: "50000",
      approvalTarget: AGGREGATION_ROUTER_V6
    });
    
    // === STEP 3: ORDER CREATION ===
    console.log("\n📝 STEP 3: Order Creation");
    console.log("─".repeat(40));
    
    // Define order parameters with randomized nonce for uniqueness
    const randomNonce = BigInt(Math.floor(Math.random() * 1000000000) + Date.now());
    const orderParams = {
      maker: makerAddress,
      makerAsset: WETH_ADDRESS,
      takerAsset: USDC_ADDRESS,
      makingAmount: ethers.parseEther("2"),        // 2 WETH
      takingAmount: BigInt("7200000000"),          // 7200 USDC (3600 USDC per WETH)
      secretParams: {
        secretPrice: BigInt("6000000000"),         // Secret minimum: 6000 USDC total
        secretAmount: BigInt("6000000000"),        // Secret minimum: 6000 USDC total
        nonce: randomNonce                         // Random nonce for unique commitments
      }
    };
    
    console.log(`   Creating commitment order...`);
    console.log(`   Making: ${ethers.formatEther(orderParams.makingAmount)} WETH`);
    console.log(`   Taking: ${ethers.formatUnits(orderParams.takingAmount, 6)} USDC`);
    
    // Calculate rate properly by converting strings to numbers
    const takingAmountNum = Number(ethers.formatUnits(orderParams.takingAmount, 6));
    const makingAmountNum = Number(ethers.formatEther(orderParams.makingAmount));
    const rate = takingAmountNum / makingAmountNum;
    console.log(`   Rate: ${rate.toFixed(2)} USDC per WETH`);
    console.log(`   Nonce: ${randomNonce.toString()} (randomized for uniqueness)`);
    
    const commitmentOrder = await buildCommitmentOrder(orderParams);
    console.log(`   ✅ Commitment Order Created`);
    console.log(`   📋 Commitment: ${commitmentOrder.commitment.slice(0, 20)}...`);
    
    // === STEP 4: ORDER SIGNING ===
    console.log("\n✍️  STEP 4: Order Signing");
    console.log("─".repeat(40));
    
    const signature = await signCommitmentOrder(
      commitmentOrder.order,
      BigInt(networkConfig.chainId),
      AGGREGATION_ROUTER_V6,
      maker
    );
    console.log(`   ✅ Order Signed`);
    
    // Calculate order hash for registration
    const network = await ethers.provider.getNetwork();
    const orderData = buildOrderData(network.chainId, AGGREGATION_ROUTER_V6, commitmentOrder.order);
    const orderHash = ethers.TypedDataEncoder.hash(orderData.domain, orderData.types, orderData.value);
    console.log(`   📋 Order Hash: ${orderHash.slice(0, 20)}...`);
    
    // === STEP 5: SECRET REGISTRATION ===
    console.log("\n🔐 STEP 5: Secret Registration");
    console.log("─".repeat(40));
    
    const orderParameters = {
      maker: makerAddress,
      makerAsset: WETH_ADDRESS,
      takerAsset: USDC_ADDRESS,
      makingAmount: orderParams.makingAmount,
      takingAmount: orderParams.takingAmount,
      commitment: commitmentOrder.commitment,
      originalSalt: commitmentOrder.order.salt.toString()
    };
    
    const secrets = {
      secretPrice: orderParams.secretParams.secretPrice,
      secretAmount: orderParams.secretParams.secretAmount,
      nonce: orderParams.secretParams.nonce,
      maker: makerAddress
    };
    
    const registrationSuccess = await registerSecretsWithAPI(
      DEFAULT_API_URL,
      orderHash,
      commitmentOrder.commitment,
      orderParameters,
      secrets
    );
    
    if (registrationSuccess) {
      console.log(`   ✅ Secrets registered with API service`);
    } else {
      console.log(`   ⚠️  Secret registration failed, but continuing...`);
    }
    
    // === STEP 6: ORDER PUBLISHING ===
    console.log("\n📢 STEP 6: Order Publishing");
    console.log("─".repeat(40));
    
    const publishRequest: PublishOrderRequest = {
      orderData: commitmentOrder.order,
      signature: signature,
      orderHash: orderHash,
      commitment: commitmentOrder.commitment,
      secrets: secrets,
      metadata: {
        network: networkConfig.name,
        maker: makerAddress,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: orderParams.makingAmount,
        takingAmount: orderParams.takingAmount
      }
    };
    
    console.log(`   Publishing order to storage...`);
    const publishedOrderId = await publishOrderToStorage(publishRequest);
    
    // === STEP 7: VERIFICATION ===
    console.log("\n✅ STEP 7: Verification");
    console.log("─".repeat(40));
    
    const verificationSuccess = await verifyPublishedOrder(publishedOrderId);
    
    if (!verificationSuccess) {
      throw new Error("Order verification failed");
    }
    
    // === STEP 8: DISPLAY RESULTS ===
    displayOrderSummary(commitmentOrder.order, {
      ...publishRequest.metadata,
      commitment: commitmentOrder.commitment
    });
    
    displaySecretsSummary(secrets);
    
    console.log(`\n🎉 MAKER WORKFLOW COMPLETED SUCCESSFULLY`);
    console.log("=" .repeat(60));
    console.log(`📋 Published Order ID: ${publishedOrderId}`);
    console.log(`📁 Storage Location: storage/published_orders.json`);
    console.log(`🔗 Order Hash: ${orderHash}`);
    console.log(`🔒 Commitment: ${commitmentOrder.commitment.slice(0, 30)}...`);
    console.log("=" .repeat(60));
    
    console.log(`\n📊 NEXT STEPS:`);
    console.log(`   1. Order is now discoverable by takers`);
    console.log(`   2. Takers can find it in published_orders.json`);
    console.log(`   3. API service can authorize fills for valid amounts`);
    console.log(`   4. Hidden constraints protect maker's interests`);
    console.log(`\n💡 Test the published order:`);
    console.log(`   npx hardhat run scripts/takerDiscover.ts --network localhost`);
    
  } catch (error) {
    console.error(`\n❌ MAKER WORKFLOW FAILED:`, error);
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
     } else if (arg === '--help') {
       console.log(`
DarkSwap Maker Publishing Workflow

Usage: npx hardhat run scripts/makerPublish.ts [options]

Options:
  --api-url <url>     API service URL (default: http://localhost:3000)
  --help              Show this help message

Prerequisites:
  1. Hardhat node running with forked mainnet
  2. Deployed contracts (run scripts/deploy.ts first)
  3. API service running (run scripts/runMakerService.ts)

Examples:
  npx hardhat run scripts/makerPublish.ts --network localhost
  npx hardhat run scripts/makerPublish.ts --api-url http://localhost:8080
       `);
       process.exit(0);
     }
   }
   
   return options;
 }
 
 // Main execution
 if (require.main === module) {
   const options = parseArgs();
   runMakerWorkflow().catch((error) => {
     console.error("Workflow failed:", error);
     process.exit(1);
   });
 }
 
 export { runMakerWorkflow };