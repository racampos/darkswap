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
import { MockERC20, SimplePredicate } from "../typechain-types";

// Import the ABI
import AggregationRouterV6ABI from "../abi/AggregationRouterV6.json";

// Helper function to format balances in human-readable format
function formatBalance(amount: bigint, decimals: number, symbol: string): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  
  if (fractionalPart === 0n) {
    return `${wholePart.toString()} ${symbol}`;
  } else {
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    return `${wholePart.toString()}.${fractionalStr} ${symbol}`;
  }
}

describe("Predicate Extensions", function () {
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
  let simplePredicate: SimplePredicate;
  
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

    // Deploy SimplePredicate contract
    const SimplePredicateFactory = await ethers.getContractFactory("SimplePredicate");
    simplePredicate = await SimplePredicateFactory.deploy();
    await simplePredicate.waitForDeployment();

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

    console.log("Predicate test setup complete:");
    console.log(`SimplePredicate deployed at: ${await simplePredicate.getAddress()}`);
    console.log(`Maker WETH balance: ${formatBalance(await wethContract.balanceOf(maker.address), 18, 'WETH')}`);
    console.log(`Taker USDC balance: ${formatBalance(await usdcContract.balanceOf(taker.address), 6, 'USDC')}`);
  });

  it("should deploy predicate contract and update gate value", async function () {
    // Verify initial state
    expect(await simplePredicate.gateValue()).to.equal(0);
    
    // Test setting gate value
    const testValue = 100;
    await simplePredicate.setGateValue(testValue);
    
    // Verify the value was set
    expect(await simplePredicate.gateValue()).to.equal(testValue);
    
    // Test getting the value through the getter function
    expect(await simplePredicate.getGateValue()).to.equal(testValue);
    
    // Test updating to a different value
    const newValue = 200;
    await simplePredicate.setGateValue(newValue);
    expect(await simplePredicate.getGateValue()).to.equal(newValue);
    
    console.log(`SimplePredicate contract working correctly:`);
    console.log(`  - Initial value: 0`);
    console.log(`  - First update: ${testValue}`);
    console.log(`  - Second update: ${newValue}`);
    console.log(`  - Current value: ${await simplePredicate.getGateValue()}`);
  });

  it("should reject order fill when predicate condition is false", async function () {
    // Set gate value to 100 (this will make our predicate false)
    const currentGateValue = 100;
    const expectedGateValue = 200; // Our predicate will check for this value
    
    await simplePredicate.setGateValue(currentGateValue);
    console.log(`Gate value set to: ${currentGateValue}`);
    console.log(`Predicate will check for: ${expectedGateValue}`);
    console.log(`Expected result: Predicate should be FALSE`);

    // Get network info for signing
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    // Build predicate calldata using AggregationRouterV6's eq() function
    // 1. Create calldata to call simplePredicate.getGateValue()
    const getGateValueCall = (aggregationRouter as any).interface.encodeFunctionData("arbitraryStaticCall", [
      await simplePredicate.getAddress(),
      simplePredicate.interface.encodeFunctionData("getGateValue"),
    ]);

    // 2. Create predicate: getGateValue() == 200
    const predicate = (aggregationRouter as any).interface.encodeFunctionData("eq", [
      expectedGateValue,
      getGateValueCall,
    ]);

    console.log(`Predicate calldata created (length: ${predicate.length} chars)`);

    // Build order with predicate extension
    // Note: The HAS_EXTENSION flag will be automatically set to true by buildOrder()
    // when it detects that extension data (predicate) is provided
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
      salt: BigInt(Date.now()),
    }, {
      predicate: predicate, // Add predicate to extensions
    });

    console.log("Order with predicate created:", {
      salt: order.salt.toString(),
      maker: order.maker,
      makingAmount: formatBalance(order.makingAmount, 18, 'WETH'),
      takingAmount: formatBalance(order.takingAmount, 6, 'USDC'),
      predicate: predicate,
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

    // Record balances before attempted fill
    const makerWethBefore = await wethContract.balanceOf(maker.address);
    const makerUsdcBefore = await usdcContract.balanceOf(maker.address);
    const takerWethBefore = await wethContract.balanceOf(taker.address);
    const takerUsdcBefore = await usdcContract.balanceOf(taker.address);

    console.log("Balances before attempted fill:");
    console.log(`Maker WETH: ${formatBalance(makerWethBefore, 18, 'WETH')}, USDC: ${formatBalance(makerUsdcBefore, 6, 'USDC')}`);
    console.log(`Taker WETH: ${formatBalance(takerWethBefore, 18, 'WETH')}, USDC: ${formatBalance(takerUsdcBefore, 6, 'USDC')}`);

    // Attempt to fill the order - this should FAIL with PredicateIsNotTrue
    let actualError = "";
    try {
      await (aggregationRouter.connect(taker) as any).fillOrderArgs(
        order,
        r,
        vs,
        TAKING_AMOUNT,
        0, // Default taker traits
        order.extension // Pass the extension containing the predicate
      );
      throw new Error("Transaction should have failed but didn't");
    } catch (error: any) {
      actualError = error.message;
      console.log("Actual error caught:", actualError);
      
      // Check for PredicateIsNotTrue error selector (0xb2d25e49)
      expect(error.message).to.include("0xb2d25e49");
      console.log("Confirmed: PredicateIsNotTrue error (selector: 0xb2d25e49)");
    }

    // Verify balances remain unchanged (no trade occurred)
    const makerWethAfter = await wethContract.balanceOf(maker.address);
    const makerUsdcAfter = await usdcContract.balanceOf(maker.address);
    const takerWethAfter = await wethContract.balanceOf(taker.address);
    const takerUsdcAfter = await usdcContract.balanceOf(taker.address);

    expect(makerWethAfter).to.equal(makerWethBefore);
    expect(makerUsdcAfter).to.equal(makerUsdcBefore);
    expect(takerWethAfter).to.equal(takerWethBefore);
    expect(takerUsdcAfter).to.equal(takerUsdcBefore);

    console.log("Order correctly rejected by predicate:");
    console.log(`  - Gate value: ${currentGateValue}`);
    console.log(`  - Expected: ${expectedGateValue}`);
    console.log(`  - Predicate result: FALSE`);
    console.log(`  - Order fill: REJECTED`);
    console.log(`  - Balances: UNCHANGED`);
  });

  after(async function () {
    // Stop impersonating accounts
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);
  });
}); 