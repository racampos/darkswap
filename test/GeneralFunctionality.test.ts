import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";
import {
  buildOrder,
  signOrder,
  buildMakerTraits,
  OrderStruct,
} from "./helpers/orderUtils";
import { ether } from "./helpers/utils";
import { formatBalance } from "./helpers/testUtils";
import { MockERC20 } from "../typechain-types";

// Import the ABI
import AggregationRouterV6ABI from "../abi/AggregationRouterV6.json";



describe("General Functionality", function () {
  // Contract addresses
  const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  
  // Whale addresses for funding
  const WETH_WHALE = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
  const USDC_WHALE = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503";

  // Contract instances
  let aggregationRouter: Contract;
  let wethContract: MockERC20;
  let usdcContract: MockERC20;
  
  // Test accounts
  let maker: HardhatEthersSigner;
  let taker: HardhatEthersSigner;
  let wethWhale: HardhatEthersSigner;
  let usdcWhale: HardhatEthersSigner;

  // Test parameters
  const MAKING_AMOUNT = ether("10"); // 10 WETH
  const TAKING_AMOUNT = BigInt("35000000000"); // 35000 USDC

  beforeEach(async function () {
    // Get signers
    const signers = await ethers.getSigners();
    maker = signers[0];
    taker = signers[1];

    // Impersonate whale accounts
    await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
    await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
    
    wethWhale = await ethers.getSigner(WETH_WHALE);
    usdcWhale = await ethers.getSigner(USDC_WHALE);

    // Get contract instances
    aggregationRouter = new ethers.Contract(
      AGGREGATION_ROUTER_V6,
      AggregationRouterV6ABI,
      ethers.provider
    );

    // Use MockERC20 interface for WETH and USDC (standard ERC20 tokens)
    wethContract = await ethers.getContractAt("MockERC20", WETH_ADDRESS);
    usdcContract = await ethers.getContractAt("MockERC20", USDC_ADDRESS);

    // Fund maker with WETH
    await wethContract.connect(wethWhale).transfer(
      maker.address,
      ether("15")
    );

    // Fund taker with USDC
    await usdcContract.connect(usdcWhale).transfer(
      taker.address,
      BigInt("50000000000")
    );

    // Approve router to spend tokens
    await wethContract.connect(maker).approve(
      AGGREGATION_ROUTER_V6,
      ethers.MaxUint256
    );
    
    await usdcContract.connect(taker).approve(
      AGGREGATION_ROUTER_V6,
      ethers.MaxUint256
    );

    console.log("Setup complete:");
    console.log(`Maker WETH balance: ${formatBalance(await wethContract.balanceOf(maker.address), 18, 'WETH')}`);
    console.log(`Taker USDC balance: ${formatBalance(await usdcContract.balanceOf(taker.address), 6, 'USDC')}`);
  });

  it("should create, sign and fill a limit order", async function () {
    // Get network info for signing
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    // Build the order
    const order: OrderStruct = buildOrder({
      maker: maker.address,
      makerAsset: WETH_ADDRESS,
      takerAsset: USDC_ADDRESS,
      makingAmount: MAKING_AMOUNT,
      takingAmount: TAKING_AMOUNT,
      // receiver defaults to ZeroAddress (maker receives)
      // makerTraits defaults to basic configuration
    });

    console.log("Order created:", {
      salt: order.salt.toString(),
      maker: order.maker,
      makerAsset: order.makerAsset,
      takerAsset: order.takerAsset,
      makingAmount: formatBalance(order.makingAmount, 18, 'WETH'),
      takingAmount: formatBalance(order.takingAmount, 6, 'USDC'),
    });

    // Sign the order
    const signature = await signOrder(
      order,
      chainId,
      AGGREGATION_ROUTER_V6,
      maker
    );

    console.log("Order signed, signature:", signature);

    // Extract r and vs from signature
    const sig = ethers.Signature.from(signature);
    const r = sig.r;
    const vs = sig.yParityAndS;

    console.log("Signature components:", { r, vs });

    // Record balances before fill
    const makerWethBefore = await wethContract.balanceOf(maker.address);
    const makerUsdcBefore = await usdcContract.balanceOf(maker.address);
    const takerWethBefore = await wethContract.balanceOf(taker.address);
    const takerUsdcBefore = await usdcContract.balanceOf(taker.address);

    console.log("Balances before fill:");
    console.log(`Maker WETH: ${formatBalance(makerWethBefore, 18, 'WETH')}, USDC: ${formatBalance(makerUsdcBefore, 6, 'USDC')}`);
    console.log(`Taker WETH: ${formatBalance(takerWethBefore, 18, 'WETH')}, USDC: ${formatBalance(takerUsdcBefore, 6, 'USDC')}`);

    // Fill the order
    const fillTx = await (aggregationRouter.connect(taker) as any).fillOrder(
      order,
      r,
      vs,
      TAKING_AMOUNT,
      0 // Default taker traits
    );

    const receipt = await fillTx.wait();
    console.log("Order filled, gas used:", receipt.gasUsed);

    // Record balances after fill
    const makerWethAfter = await wethContract.balanceOf(maker.address);
    const makerUsdcAfter = await usdcContract.balanceOf(maker.address);
    const takerWethAfter = await wethContract.balanceOf(taker.address);
    const takerUsdcAfter = await usdcContract.balanceOf(taker.address);

    console.log("Balances after fill:");
    console.log(`Maker WETH: ${formatBalance(makerWethAfter, 18, 'WETH')}, USDC: ${formatBalance(makerUsdcAfter, 6, 'USDC')}`);
    console.log(`Taker WETH: ${formatBalance(takerWethAfter, 18, 'WETH')}, USDC: ${formatBalance(takerUsdcAfter, 6, 'USDC')}`);

    // Verify the trade occurred correctly
    
    // Maker should have lost WETH and gained USDC
    expect(makerWethAfter).to.equal(makerWethBefore - MAKING_AMOUNT);
    expect(makerUsdcAfter).to.equal(makerUsdcBefore + TAKING_AMOUNT);
    
    // Taker should have gained WETH and lost USDC
    expect(takerWethAfter).to.equal(takerWethBefore + MAKING_AMOUNT);
    expect(takerUsdcAfter).to.equal(takerUsdcBefore - TAKING_AMOUNT);

    // Check for OrderFilled event
    const orderFilledEvents = receipt.logs.filter((log: any) => {
      try {
        const parsed = aggregationRouter.interface.parseLog(log);
        return parsed?.name === "OrderFilled";
      } catch {
        return false;
      }
    });

    expect(orderFilledEvents).to.have.length(1);
    console.log("Order filled successfully with proper token transfers");
  });

  it("should handle partial fills", async function () {
    // Get network info for signing
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    // Build the order with a unique salt for this test
    const order: OrderStruct = buildOrder({
      maker: maker.address,
      makerAsset: WETH_ADDRESS,
      takerAsset: USDC_ADDRESS,
      makingAmount: MAKING_AMOUNT,
      takingAmount: TAKING_AMOUNT,
      makerTraits: buildMakerTraits({
        allowPartialFill: true,
        allowMultipleFills: true,
      }),
      salt: BigInt(Date.now() + 1000), // Unique salt for this test
    });

    console.log("Partial fill order created:", {
      salt: order.salt.toString(),
      maker: order.maker,
      makingAmount: formatBalance(order.makingAmount, 18, 'WETH'),
      takingAmount: formatBalance(order.takingAmount, 6, 'USDC'),
    });

    // Sign the order
    const signature = await signOrder(
      order,
      chainId,
      AGGREGATION_ROUTER_V6,
      maker
    );

    // Extract r and vs from signature
    const sig = ethers.Signature.from(signature);
    const r = sig.r;
    const vs = sig.yParityAndS;

    // Fill only 60% of the order
    const partialFillPercentage = 0.6;
    const partialTakingAmount = (TAKING_AMOUNT * BigInt(Math.floor(partialFillPercentage * 1000))) / BigInt(1000);
    const partialMakingAmount = (MAKING_AMOUNT * BigInt(Math.floor(partialFillPercentage * 1000))) / BigInt(1000);

    console.log(`Attempting to fill ${partialFillPercentage * 100}% of the order:`);
    console.log(`- Taking: ${formatBalance(partialTakingAmount, 6, 'USDC')}`);
    console.log(`- Making: ${formatBalance(partialMakingAmount, 18, 'WETH')}`);

    // Record balances before partial fill
    const makerWethBefore = await wethContract.balanceOf(maker.address);
    const makerUsdcBefore = await usdcContract.balanceOf(maker.address);
    const takerWethBefore = await wethContract.balanceOf(taker.address);
    const takerUsdcBefore = await usdcContract.balanceOf(taker.address);

    console.log("Balances before partial fill:");
    console.log(`Maker WETH: ${formatBalance(makerWethBefore, 18, 'WETH')}, USDC: ${formatBalance(makerUsdcBefore, 6, 'USDC')}`);
    console.log(`Taker WETH: ${formatBalance(takerWethBefore, 18, 'WETH')}, USDC: ${formatBalance(takerUsdcBefore, 6, 'USDC')}`);

    // Fill the order partially - amount parameter is the taking amount (USDC)
    const fillTx = await (aggregationRouter.connect(taker) as any).fillOrder(
      order,
      r,
      vs,
      partialTakingAmount,
      0 // Default taker traits
    );

    const receipt = await fillTx.wait();
    console.log("Partial order filled, gas used:", receipt.gasUsed);

    // Record balances after partial fill
    const makerWethAfter = await wethContract.balanceOf(maker.address);
    const makerUsdcAfter = await usdcContract.balanceOf(maker.address);
    const takerWethAfter = await wethContract.balanceOf(taker.address);
    const takerUsdcAfter = await usdcContract.balanceOf(taker.address);

    console.log("Balances after partial fill:");
    console.log(`Maker WETH: ${formatBalance(makerWethAfter, 18, 'WETH')}, USDC: ${formatBalance(makerUsdcAfter, 6, 'USDC')}`);
    console.log(`Taker WETH: ${formatBalance(takerWethAfter, 18, 'WETH')}, USDC: ${formatBalance(takerUsdcAfter, 6, 'USDC')}`);

    // Verify the partial trade occurred correctly
    expect(makerWethAfter).to.equal(makerWethBefore - partialMakingAmount);
    expect(makerUsdcAfter).to.equal(makerUsdcBefore + partialTakingAmount);
    expect(takerWethAfter).to.equal(takerWethBefore + partialMakingAmount);
    expect(takerUsdcAfter).to.equal(takerUsdcBefore - partialTakingAmount);

    // Check for OrderFilled event
    const orderFilledEvents = receipt.logs.filter((log: any) => {
      try {
        const parsed = aggregationRouter.interface.parseLog(log);
        return parsed?.name === "OrderFilled";
      } catch {
        return false;
      }
    });

    expect(orderFilledEvents).to.have.length(1);
    console.log("Partial fill completed successfully with proper token transfers");
  });

  after(async function () {
    // Stop impersonating accounts
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);
  });
}); 