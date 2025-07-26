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

  after(async function () {
    // Stop impersonating accounts
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);
  });
}); 