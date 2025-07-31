import { ethers } from "hardhat";
import { MakerService } from "../src/api/makerService";
import { buildCommitmentOrder, signCommitmentOrder } from "../src/utils/commitmentOrders";
import AggregationRouterV6ABI from "../abi/AggregationRouterV6.json";

const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

/**
 * Demo: Complete Order Execution Flow
 * 
 * Shows the full end-to-end ZK commitment order system including actual order execution:
 * 1. Maker creates commitment order and starts REST service
 * 2. Taker requests authorization for a valid fill
 * 3. Taker receives order with ZK extension and signature
 * 4. Taker executes the order on-chain via 1inch router
 * 5. Balances are updated and trade is completed
 */
async function demonstrateFullExecution() {
  console.log("DARKSWAP FULL EXECUTION DEMO");
  console.log("=".repeat(50));

  // Setup accounts
  const [, maker, taker] = await ethers.getSigners();
  console.log(`\nParticipants:`);
  console.log(`   Maker: ${maker.address}`);
  console.log(`   Taker: ${taker.address}`);

  // === STEP 1: SETUP AND ORDER CREATION ===
  console.log(`\nSTEP 1: Maker setup and order creation`);
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

  // Sign the original commitment order
  const originalSignature = await signCommitmentOrder(
    commitmentOrder.order,
    BigInt(1),
    AGGREGATION_ROUTER_V6,
    maker
  );
  console.log(`   Order signed`);

  // Initialize maker service
  const makerService = new MakerService(AGGREGATION_ROUTER_V6, BigInt(1), false); // No Express needed for demo
  await makerService.initialize();
  console.log(`   Maker service initialized`);

  // Setup balances and register order
  await setupTestBalances(maker, taker);
  
  // Calculate the real order hash using EIP-712 (needed for registration)
  const { buildOrderData } = await import("../test/helpers/orderUtils");
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const orderData = buildOrderData(chainId, AGGREGATION_ROUTER_V6, commitmentOrder.order);
  const realOrderHash = ethers.TypedDataEncoder.hash(orderData.domain, orderData.types, orderData.value);
  
  const orderParameters = {
    maker: maker.address,
    makerAsset: WETH_ADDRESS,
    takerAsset: USDC_ADDRESS,
    makingAmount: orderParams.makingAmount,
    takingAmount: orderParams.takingAmount,
    commitment: commitmentOrder.commitment,
    originalSalt: commitmentOrder.order.salt.toString() // Pass the original structured salt
  };

  makerService.registerOrder(commitmentOrder.commitment, orderParameters, {
    secretPrice: orderParams.secretParams.secretPrice,
    secretAmount: orderParams.secretParams.secretAmount,
    nonce: orderParams.secretParams.nonce,
    maker: maker.address
  }, realOrderHash); // Pass the orderHash for lookup
  console.log(`   Order registered with service`);
  console.log(`   Real order hash: ${realOrderHash}`);

  // === STEP 2: SHOW INITIAL BALANCES ===
  console.log(`\nSTEP 2: Initial balances`);
  console.log("─".repeat(40));
  
  const wethContract = await ethers.getContractAt("MockERC20", WETH_ADDRESS);
  const usdcContract = await ethers.getContractAt("MockERC20", USDC_ADDRESS);
  
  const initialMakerWeth = await wethContract.balanceOf(maker.address);
  const initialMakerUsdc = await usdcContract.balanceOf(maker.address);
  const initialTakerWeth = await wethContract.balanceOf(taker.address);
  const initialTakerUsdc = await usdcContract.balanceOf(taker.address);

  console.log(`   Maker WETH: ${ethers.formatEther(initialMakerWeth)}`);
  console.log(`   Maker USDC: ${ethers.formatUnits(initialMakerUsdc, 6)}`);
  console.log(`   Taker WETH: ${ethers.formatEther(initialTakerWeth)}`);
  console.log(`   Taker USDC: ${ethers.formatUnits(initialTakerUsdc, 6)}`);

  // === STEP 3: TAKER REQUESTS AUTHORIZATION ===
  console.log(`\nSTEP 3: Taker requests authorization`);
  console.log("─".repeat(40));

  const fillAmount = BigInt("3200000000"); // 3200 USDC - above minimum
  console.log(`   Requesting authorization for ${ethers.formatUnits(fillAmount, 6)} USDC fill`);
  console.log(`   Order to be rebuilt: salt=${commitmentOrder.order.salt.toString()}`);

  // Use the new clean authorization method
  console.log(`   Calling makerService.authorizeFillRequest...`);
  const authResponse = await makerService.authorizeFillRequest(realOrderHash, fillAmount);

  if (!authResponse.success) {
    console.log(`   Authorization DENIED: ${authResponse.error}`);
    console.log(`   Demo ended: Authorization failed`);
    return;
  }

  console.log(`   Authorization GRANTED`);
  console.log(`   Received order with ZK extension`);
  console.log(`   Extension length: ${(authResponse.orderWithExtension as any).extension?.length || 0} chars`);

  // === STEP 4: TAKER EXECUTES ORDER ===
  console.log(`\nSTEP 4: Taker executes order on-chain`);
  console.log("─".repeat(40));

  const orderWithExtension = authResponse.orderWithExtension;
  const orderSignature = authResponse.signature;

  console.log(`   Preparing fillOrderArgs call...`);

  // Get router contract using ABI
  const router = new ethers.Contract(
    AGGREGATION_ROUTER_V6,
    AggregationRouterV6ABI,
    ethers.provider
  );

  // Parse signature for fillOrderArgs
  const sig = ethers.Signature.from(orderSignature);
  const r = sig.r;
  const vs = sig.yParityAndS; // Use ethers' built-in yParityAndS like working tests

  // Use extension handling pattern from PredicateExtensions.test.ts
  const { buildTakerTraits } = await import("../test/helpers/orderUtils");
  
  // Extract extension from order and pass via taker traits (following PredicateExtensions.test.ts pattern)
  const extension = (orderWithExtension as any).extension || '0x';
  const takerTraitsData = buildTakerTraits({
    makingAmount: false, // Consistent with PredicateExtensions tests
    extension: extension,
    target: taker.address,
    interaction: '0x'
  });

  console.log(`   Calling router.fillOrderArgs...`);
  console.log(`   Order maker: ${orderWithExtension.maker}`);
  console.log(`   Taker: ${taker.address}`);
  console.log(`   Amount: ${ethers.formatUnits(fillAmount, 6)} USDC`);
  console.log(`   Extension length: ${extension.length} chars (via taker traits)`);

  try {
    // Execute the order (following PredicateExtensions.test.ts pattern exactly)
    const tx = await (router.connect(taker) as any).fillOrderArgs(
      orderWithExtension,
      r,
      vs,
      fillAmount,
      takerTraitsData.traits,
      takerTraitsData.args // Extension packed into args
    );

    console.log(`   Transaction submitted: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`   Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log(`   Gas used: ${receipt?.gasUsed.toLocaleString()}`);

  } catch (error: any) {
    console.log(`   Transaction failed: ${error.message}`);
    
    // Try to decode the error
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
        console.log(`   Decoded error: ${decodedError?.name}`);
      } catch {
        console.log(`   Raw error data: ${error.data}`);
      }
    }
    
    console.log(`   Demo ended: Order execution failed`);
    return;
  }

  // === STEP 5: SHOW FINAL BALANCES ===
  console.log(`\nSTEP 5: Final balances (after execution)`);
  console.log("─".repeat(40));

  const finalMakerWeth = await wethContract.balanceOf(maker.address);
  const finalMakerUsdc = await usdcContract.balanceOf(maker.address);
  const finalTakerWeth = await wethContract.balanceOf(taker.address);
  const finalTakerUsdc = await usdcContract.balanceOf(taker.address);

  console.log(`   Maker WETH: ${ethers.formatEther(finalMakerWeth)} (${ethers.formatEther(finalMakerWeth - initialMakerWeth)} change)`);
  console.log(`   Maker USDC: ${ethers.formatUnits(finalMakerUsdc, 6)} (+${ethers.formatUnits(finalMakerUsdc - initialMakerUsdc, 6)} change)`);
  console.log(`   Taker WETH: ${ethers.formatEther(finalTakerWeth)} (+${ethers.formatEther(finalTakerWeth - initialTakerWeth)} change)`);
  console.log(`   Taker USDC: ${ethers.formatUnits(finalTakerUsdc, 6)} (${ethers.formatUnits(finalTakerUsdc - initialTakerUsdc, 6)} change)`);

  // === STEP 6: EXECUTION SUMMARY ===
  console.log(`\nEXECUTION SUMMARY`);
  console.log("=".repeat(50));
  
  const wethTraded = finalTakerWeth - initialTakerWeth;
  const usdcTraded = finalMakerUsdc - initialMakerUsdc;
  
  if (wethTraded > 0 && usdcTraded > 0) {
    console.log(`TRADE EXECUTED SUCCESSFULLY`);
    console.log(`   WETH traded: ${ethers.formatEther(wethTraded)}`);
    console.log(`   USDC traded: ${ethers.formatUnits(usdcTraded, 6)}`);
    console.log(`   Effective price: ${ethers.formatUnits(usdcTraded, 6)} USDC per WETH`);
    console.log(`   ZK constraint satisfied: ${ethers.formatUnits(usdcTraded, 6)} USDC >= 3000 USDC minimum`);
    console.log(`   Privacy preserved: Secret minimum never revealed on-chain`);
  } else {
    console.log(`TRADE FAILED`);
    console.log(`   No balance changes detected`);
  }

  console.log(`\nTECHNICAL ACHIEVEMENTS:`);
  console.log(`   ZK proof generated and verified on-chain`);
  console.log(`   Order rebuilt with extension server-side`);
  console.log(`   Standard 1inch router integration`);
  console.log(`   Real forked mainnet execution`);
  console.log(`   Hidden constraints enforced cryptographically`);
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

  console.log(`   Balances and approvals set up`);
}

// Run the demo
if (require.main === module) {
  demonstrateFullExecution()
    .then(() => {
      console.log(`\nFull execution demo complete!`);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Demo failed:", error);
      process.exit(1);
    });
}

export { demonstrateFullExecution }; 