import { ethers } from "hardhat";
import MakerService from "../src/api/makerService";
import { buildCommitmentOrder, signCommitmentOrder } from "../src/utils/commitmentOrders";

const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

/**
 * Demo: Complete REST Service Workflow
 * 
 * Shows the full end-to-end ZK commitment order system:
 * 1. Maker creates commitment orders
 * 2. Maker starts REST service and registers secrets
 * 3. Taker discovers orders and requests authorization
 * 4. Service generates ZK proofs for valid fills
 */
async function demonstrateRestWorkflow() {
  console.log("DARKSWAP REST SERVICE DEMO");
  console.log("=".repeat(50));

  // Setup accounts
  const [, maker, taker] = await ethers.getSigners();
  console.log(`\nAccounts:`);
  console.log(`   Maker: ${maker.address}`);
  console.log(`   Taker: ${taker.address}`);

  // === STEP 1: MAKER CREATES COMMITMENT ORDERS ===
  console.log(`\nSTEP 1: Maker creates commitment orders`);
  console.log("─".repeat(40));

  const orderParams = {
    maker: maker.address,
    makerAsset: WETH_ADDRESS,
    takerAsset: USDC_ADDRESS,
    makingAmount: ethers.parseEther("1"),        // 1 WETH
    takingAmount: BigInt("3500000000"),          // 3500 USDC
    secretParams: {
      secretPrice: BigInt("3000000000"),         // Secret minimum: 3000 USDC total
      secretAmount: BigInt("3000000000"),        // Secret minimum: 3000 USDC total (same constraint)
      nonce: BigInt("123456789")
    }
  };

  const commitmentOrder = await buildCommitmentOrder(orderParams);
  console.log(`   Created order: 1 WETH → 3500 USDC`);
  console.log(`   Hidden constraint: minimum 3000 USDC total`);
  console.log(`   Commitment: ${commitmentOrder.commitment}`);

  // Sign the order
  const signature = await signCommitmentOrder(
    commitmentOrder.order,
    BigInt(1),
    AGGREGATION_ROUTER_V6,
    maker
  );
  console.log(`   Order signed`);

  // === STEP 2: MAKER STARTS REST SERVICE ===
  console.log(`\nSTEP 2: Maker starts authorization service`);
  console.log("─".repeat(40));

  const makerService = new MakerService(AGGREGATION_ROUTER_V6);
  
  // Initialize service (deploy ZK contracts)
  await makerService.initialize();

  // Setup test balances and approvals for actual execution
  await setupTestBalances(maker, taker);
  
  // Register order parameters and secrets for the commitment
  const orderParameters = {
    maker: maker.address,
    makerAsset: WETH_ADDRESS,
    takerAsset: USDC_ADDRESS,
    makingAmount: orderParams.makingAmount,
    takingAmount: orderParams.takingAmount,
    commitment: commitmentOrder.commitment,
    originalSalt: commitmentOrder.order.salt.toString() // Add originalSalt like demoFullExecution.ts
  };

  makerService.registerOrder(commitmentOrder.commitment, orderParameters, {
    secretPrice: orderParams.secretParams.secretPrice,
    secretAmount: orderParams.secretParams.secretAmount,
    nonce: orderParams.secretParams.nonce,
    maker: maker.address
  });

  console.log(`   Service initialized`);
  console.log(`   Secrets registered for commitment`);

  // Simulate starting the service (without actually binding to port)
  console.log(`   Service would run on: http://localhost:3000`);
  console.log(`   Endpoints available:`);
  console.log(`      POST /authorize-fill`);
  console.log(`      GET /order-status/:commitment`);
  console.log(`      GET /debug/secrets`);

  // Parse signature for 1inch format
  const { r, s, v } = ethers.Signature.from(signature);
  const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);

  // Calculate real order hash using EIP-712 (like demoFullExecution.ts)
  const { buildOrderData } = await import("../test/helpers/orderUtils");
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const orderData = buildOrderData(chainId, AGGREGATION_ROUTER_V6, commitmentOrder.order);
  const realOrderHash = ethers.TypedDataEncoder.hash(orderData.domain, orderData.types, orderData.value);
  
  console.log(`   Real order hash calculated: ${realOrderHash}`);

  // === STEP 3: ORDER PUBLICATION (SIMULATED) ===
  console.log(`\nSTEP 3: Order published to 1inch network`);
  console.log("─".repeat(40));
  console.log(`   Order appears as standard 1inch order`);
  console.log(`   Takers see: 1 WETH → 3500 USDC`);
  console.log(`   Secret constraint (3000 USDC min) is hidden`);
  console.log(`   Order ready for discovery`);

  // === STEP 4: TAKER AUTHORIZATION REQUESTS ===
  console.log(`\nSTEP 4: Taker authorization scenarios`);
  console.log("─".repeat(40));

  // Scenario 1: Valid fill (above secret minimum)
  console.log(`\nScenario 1: Valid fill (3200 USDC > 3000 min)`);
  await simulateAuthorizationRequest(makerService, {
    orderHash: realOrderHash, // Use real order hash instead of fake
    orderParams: orderParameters,
    signature: { r, vs },
    fillAmount: BigInt("3200000000"), // 3200 USDC - above 3000 minimum
    taker: taker.address
  });

  // Scenario 2: Valid fill (exact minimum)
  console.log(`\nScenario 2: Valid fill (3000 USDC = 3000 min)`);
  await simulateAuthorizationRequest(makerService, {
    orderHash: realOrderHash, // Use real order hash instead of fake
    orderParams: orderParameters,
    signature: { r, vs },
    fillAmount: BigInt("3000000000"), // 3000 USDC - exactly at minimum
    taker: taker.address
  });

  // Scenario 3: Invalid fill (below secret minimum)
  console.log(`\nScenario 3: Invalid fill (2500 USDC < 3000 min)`);
  await simulateAuthorizationRequest(makerService, {
    orderHash: realOrderHash, // Use real order hash instead of fake
    orderParams: orderParameters,
    signature: { r, vs },
    fillAmount: BigInt("2500000000"), // 2500 USDC - below 3000 minimum
    taker: taker.address
  });
}

/**
 * Simulate an authorization request to the maker service
 */
async function simulateAuthorizationRequest(
  service: MakerService, 
  request: any
): Promise<void> {
  console.log(`   Request: ${request.fillAmount} wei fill`);
  
  try {
    // Mock the Express request/response objects
    const mockReq = {
      body: request,
      method: 'POST',
      path: '/authorize-fill'
    };

    let responseData: any = null;
    let statusCode = 200;

    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => {
          statusCode = code;
          responseData = data;
          console.log(`   Response [${code}]: ${data.success ? 'SUCCESS' : 'FAILED'}`);
          
          if (data.success) {
            console.log(`   Authorization granted - New order with ZK extension`);
            if (data.orderWithExtension) {
              console.log(`   Order rebuilt with ZK predicate extension`);
              console.log(`   Extension length: ${(data.orderWithExtension as any).extension?.length || 0} chars`);
              console.log(`   New order signature provided`);
              console.log(`   Ready for taker to execute with fillOrderArgs!`);
            }
          } else {
            console.log(`   Authorization denied: ${data.reason || data.error}`);
          }
        }
      }),
      json: (data: any) => {
        statusCode = 200;
        responseData = data;
        console.log(`   Response [200]: SUCCESS`);
        console.log(`   Authorization granted - New order with ZK extension`);
        if (data.orderWithExtension) {
          console.log(`   Order rebuilt with ZK predicate extension`);
          console.log(`   Extension length: ${(data.orderWithExtension as any).extension?.length || 0} chars`);
          console.log(`   New order signature provided`);
          console.log(`   Ready for taker to execute with fillOrderArgs!`);
        }
      }
    };

    // Access the private method for demo (in real app this would be HTTP calls)
    await (service as any).authorizeFill(mockReq, mockRes);

    // Show additional details if successful
    if (statusCode === 200 && responseData?.success) {
      console.log(`   Architecture: Order rebuilt with ZK predicate extension`);
      console.log(`   Innovation: ZK proof embedded in new order structure`);
      console.log(`   Ready: Taker can execute the new order with fillOrderArgs`);
    }

  } catch (error) {
    console.log(`   Error: ${error}`);
  }
}

/**
 * Setup test balances and approvals for on-chain execution
 */
async function setupTestBalances(maker: any, taker: any) {
  const { ethers, network } = await import("hardhat");
  
  // Impersonate whale accounts for token transfers
  const wethWhale = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
  const usdcWhale = "0x28C6c06298d514Db089934071355E5743bf21d60";

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [wethWhale]
  });
  await network.provider.request({
    method: "hardhat_impersonateAccount", 
    params: [usdcWhale]
  });

  // Provide ETH for gas
  await network.provider.send("hardhat_setBalance", [wethWhale, "0xDE0B6B3A7640000"]);
  await network.provider.send("hardhat_setBalance", [usdcWhale, "0xDE0B6B3A7640000"]);

  const wethWhaleSigner = await ethers.getSigner(wethWhale);
  const usdcWhaleSigner = await ethers.getSigner(usdcWhale);

  // Get token contracts
  const wethContract = await ethers.getContractAt("MockERC20", WETH_ADDRESS);
  const usdcContract = await ethers.getContractAt("MockERC20", USDC_ADDRESS);

  // Transfer tokens to test accounts
  await wethContract.connect(wethWhaleSigner).transfer(maker.address, ethers.parseEther("10"));
  await usdcContract.connect(usdcWhaleSigner).transfer(taker.address, "50000000000"); // 50k USDC

  // Approve router to spend tokens
  await wethContract.connect(maker).approve(AGGREGATION_ROUTER_V6, ethers.MaxUint256);
  await usdcContract.connect(taker).approve(AGGREGATION_ROUTER_V6, ethers.MaxUint256);

  console.log(`   Test balances set up:`);
  console.log(`      Maker WETH: ${ethers.formatEther(await wethContract.balanceOf(maker.address))}`);
  console.log(`      Taker USDC: ${ethers.formatUnits(await usdcContract.balanceOf(taker.address), 6)}`);
  console.log(`   Token approvals granted to 1inch router`);
}

// Run the demo
if (require.main === module) {
  demonstrateRestWorkflow()
    .then(() => {
      console.log(`\nDemo complete!`);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Demo failed:", error);
      process.exit(1);
    });
}

export { demonstrateRestWorkflow, simulateAuthorizationRequest };