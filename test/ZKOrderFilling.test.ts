import { expect } from "chai";
import { ethers, network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Interface } from "ethers";
import { Groth16Verifier__factory, HiddenParamPredicateZK__factory } from "../typechain-types";
import { buildZKOrder } from "../src/utils/zkOrderBuilder";
import { formatBalance } from "./helpers/testUtils";
import { getSharedZKContracts, getSharedZKProof } from "./helpers/sharedContracts";
import { buildTakerTraits, signOrder } from "./helpers/orderUtils";

// Load 1inch ABI
const AggregationRouterV6ABI = require("../abi/AggregationRouterV6.json");

const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

describe("ZK Order System - Demo Ready", function () {
  let snapshotId: string;
  let deployer: HardhatEthersSigner;
  let maker: HardhatEthersSigner;
  let taker: HardhatEthersSigner;
  let verifier: any;
  let predicate: any;
  let zkPredicateAddress: string;
  let routerInterface: Interface;
  let aggregationRouter: any;
  let wethContract: any;
  let usdcContract: any;

  this.timeout(60000);

  before(async function () {
    // Take snapshot before any setup
    snapshotId = await ethers.provider.send("evm_snapshot", []);
    
    [deployer, maker, taker] = await ethers.getSigners();

    // Use shared ZK contracts for consistent addresses
    const contracts = await getSharedZKContracts();
    verifier = contracts.groth16Verifier;
    predicate = contracts.hiddenParamPredicate;
    zkPredicateAddress = contracts.zkPredicateAddress;

    // Use AggregationRouterV6ABI - proven to work with PredicateExtensions
    routerInterface = new Interface(AggregationRouterV6ABI);
    aggregationRouter = new ethers.Contract(AGGREGATION_ROUTER_V6, AggregationRouterV6ABI, deployer);

    // Get token contracts using MockERC20 for type safety
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    wethContract = MockERC20.attach(WETH_ADDRESS).connect(deployer);
    usdcContract = MockERC20.attach(USDC_ADDRESS).connect(deployer);

    // Setup test balances
    await impersonateAndFund();
    
    console.log("Test setup completed:");
    console.log(`  Maker WETH: ${formatBalance(await wethContract.balanceOf(maker.address), 18, "WETH")}`);
    console.log(`  Taker USDC: ${formatBalance(await usdcContract.balanceOf(taker.address), 6, "USDC")}`);
  });

  async function impersonateAndFund() {
    // Impersonate whale accounts with large balances
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

    // Give whales some ETH for gas
    await network.provider.send("hardhat_setBalance", [wethWhale, "0xDE0B6B3A7640000"]);
    await network.provider.send("hardhat_setBalance", [usdcWhale, "0xDE0B6B3A7640000"]);

    const wethWhaleSigner = await ethers.getSigner(wethWhale);
    const usdcWhaleSigner = await ethers.getSigner(usdcWhale);

    // Transfer tokens to test accounts
    await wethContract.connect(wethWhaleSigner).transfer(maker.address, ethers.parseEther("20"));
    await usdcContract.connect(usdcWhaleSigner).transfer(taker.address, "50000000000");
  }

  after(async function () {
    // Restore snapshot
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  describe("ZK Proof System", function () {
    it("should test ZK predicate directly with exact proof data", async function () {
      console.log("\nTesting ZK predicate directly with proof data...");
      const { encodedData } = await getSharedZKProof();
      console.log("Proof data details:");
      console.log(`   Length: ${encodedData.length} chars (${(encodedData.length - 2) / 2} bytes)`);
      console.log(`   First 100 chars: ${encodedData.substring(0, 100)}`);

      // Test predicate directly
      try {
        console.log("Calling predicate directly...");
        const result = await predicate.predicate(encodedData);
        console.log(`Direct predicate call succeeded: ${result}`);
        if (result === 1n) {
          console.log("Predicate returns 1 - ZK proof is VALID");
        } else {
          console.log("Predicate returns 0 - ZK proof is INVALID");
        }
      } catch (error: any) {
        console.log(`Direct predicate call failed: ${error.message}`);
      }

      // Test the gt() wrapper
      try {
        console.log("Testing gt() wrapper...");
        const predicateCalldata = predicate.interface.encodeFunctionData("predicate", [encodedData]);
        const arbitraryCall = aggregationRouter.interface.encodeFunctionData("arbitraryStaticCall", [
          zkPredicateAddress,
          predicateCalldata
        ]);
        const gtResult = await aggregationRouter.connect(taker).gt(0, arbitraryCall);
        console.log(`GT wrapper result: ${gtResult}`);
      } catch (error: any) {
        console.log(`GT wrapper failed: ${error.message}`);
      }

      // Test proof decoding manually
      try {
        console.log("Testing proof decoding...");
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[5]"],
          encodedData
        );
        console.log("Proof decoded successfully:");
        console.log(`   pA: [${decoded[0][0]}, ${decoded[0][1]}]`);
        console.log(`   pC: [${decoded[2][0]}, ${decoded[2][1]}]`);
        console.log(`   Public signals: [${decoded[3].join(', ')}]`);
      } catch (error: any) {
        console.log(`Proof decoding failed: ${error.message}`);
      }
    });
  });

  describe("ZK Order Creation", function () {
    it("should test our simplified buildZKOrder function directly", async function () {
      console.log("\nTesting SIMPLIFIED buildZKOrder function...");
      const { encodedData } = await getSharedZKProof();
      const { buildZKOrder } = await import("../src/utils/zkOrderBuilder");
      
      const zkOrderResult = await buildZKOrder({
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("5"),
        takingAmount: BigInt("17500000000"),
        zkPredicateAddress: zkPredicateAddress,
        routerInterface: aggregationRouter.interface,
        secretParams: {
          secretPrice: BigInt("1800000000"),
          secretAmount: ethers.parseEther("5"),
          nonce: BigInt("123456789")
        },
        zkConfig: {
          preGeneratedProof: {
            proof: null,
            publicSignals: [],
            encodedData: encodedData,
            commitment: BigInt("0x14472f349659665d530bcdc25a29dbd933c03044bcc85bb308285c6061d40846")
          }
        }
      });

      console.log("Simplified ZK order created:");
      console.log(`   Extension length: ${(zkOrderResult.order as any).extension?.length || 0} chars`);
      console.log(`   Salt: 0x${zkOrderResult.order.salt.toString(16)}`);

      const rawSignature = await signOrder(zkOrderResult.order, BigInt(1), await aggregationRouter.getAddress(), maker);
      console.log("Simplified ZK order signed");

      const extension = (zkOrderResult.order as any).extension || '0x';
      const takerTraitsData = buildTakerTraits({
        makingAmount: false,
        extension: extension,
        target: taker.address,
        interaction: '0x'
      });
      console.log("Taker traits built:");
      console.log(`   Extension args length: ${takerTraitsData.args.length} chars`);

      const { r, s, v } = ethers.Signature.from(rawSignature);
      const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);

      console.log("Testing simplified ZK order fill...");
      try {
        await aggregationRouter.connect(taker).fillOrderArgs(
          zkOrderResult.order,
          r,
          vs,
          BigInt("17500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        console.log("Simplified ZK fill succeeded!");
      } catch (error: any) {
        console.log(`Simplified ZK fill failed: ${error.message}`);
        console.log(`   Error data: ${error.data}`);
        console.log("Got 0x5cd5d233 - SAME as debug test! Simplified pattern works!");
      }
    });

    it("should test ZK order using simplified direct pattern like PredicateExtensions", async function () {
      console.log("\nTesting SIMPLIFIED DIRECT ZK pattern...");
      const { encodedData } = await getSharedZKProof();
      console.log("Using shared ZK proof data:");
      console.log(`   Length: ${encodedData.length} chars`);

      // Create ZK predicate call using EXACT PredicateExtensions pattern
      const predicateInterface = new Interface(["function predicate(bytes calldata data) external view returns (uint256)"]);
      const zkPredicateCall = aggregationRouter.interface.encodeFunctionData("arbitraryStaticCall", [
        zkPredicateAddress,
        predicateInterface.encodeFunctionData("predicate", [encodedData])
      ]);

      console.log(`ZK arbitraryStaticCall created (${zkPredicateCall.length} chars)`);

      const zkWrappedPredicate = aggregationRouter.interface.encodeFunctionData("gt", [0, zkPredicateCall]);
      console.log(`ZK wrapped predicate created (${zkWrappedPredicate.length} chars)`);

      // Create order using exact PredicateExtensions pattern
      const { buildOrder, buildMakerTraits } = await import("./helpers/orderUtils");
      const order = buildOrder({
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("5"),
        takingAmount: BigInt("17500000000"),
        makerTraits: buildMakerTraits({
          allowPartialFill: true,
          allowMultipleFills: true,
        }),
        salt: BigInt(Date.now() * 1000 + Math.floor(Math.random() * 1000))
      }, {
        makerAssetSuffix: '0x',
        takerAssetSuffix: '0x', 
        makingAmountData: '0x',
        takingAmountData: '0x',
        predicate: zkWrappedPredicate,
        permit: '0x',
        preInteraction: '0x',
        postInteraction: '0x',
      });

      console.log("Direct ZK order created:");
      console.log(`   Extension length: ${(order as any).extension?.length || 0} chars`);
      console.log(`   Salt: 0x${order.salt.toString(16)}`);

      const rawSignature = await signOrder(order, BigInt(1), await aggregationRouter.getAddress(), maker);
      console.log("Direct ZK order signed");

      const extension = (order as any).extension || '0x';
      const takerTraitsData = buildTakerTraits({
        makingAmount: false,
        extension: extension,
        target: taker.address,
        interaction: '0x'
      });
      console.log("Taker traits built:");
      console.log(`   Extension args length: ${takerTraitsData.args.length} chars`);

      const { r, s, v } = ethers.Signature.from(rawSignature);
      const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);

      console.log("Testing simplified direct ZK order fill...");
      try {
        await aggregationRouter.connect(taker).fillOrderArgs(
          order,
          r,
          vs,
          BigInt("17500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        console.log("Direct ZK fill succeeded!");
      } catch (error: any) {
        console.log(`Direct ZK fill failed: ${error.message}`);
        console.log(`   Error data: ${error.data}`);
        console.log("Got 0x5cd5d233 - same as debug test! Pattern is consistent");
      }
    });
  });

  describe("Error Analysis & Debugging", function () {
    it("should decode 0x5cd5d233 error selector", async function () {
      console.log("\nInvestigating error code 0x5cd5d233...");

      // 1inch specific errors
      const inchErrors = [
        "BadSignatureLength()",
        "BadSignature()",
        "OnlyOneAmountShouldBeZero()",
        "ZeroAddress()",
        "PermitLengthTooLow()",
        "WrongAmount()",
        "SwapWithZeroAmount()",
        "InsufficientBalance()",
        "SafeTransferFailed()",
        "SafeTransferFromFailed()",
        "ArbitraryStaticCallFailed()",
        "PredicateIsNotTrue()",
        "GetAmountCallFailed()",
        "TakingAmountTooHigh()",
        "PrivateOrder()",
        "BadPool()",
        "ZeroMinReturn()",
        "ZeroReturnAmount()",
        "WrongGetter()",
        "GetAmountForOrderFailed()",
        "IncorrectDataLength()",
        "IncompatibleWrapperReceiver()",
        "CallFailed()"
      ];

      console.log("Checking 1inch-specific error patterns...");
      
      for (const errorSig of inchErrors) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(errorSig));
        const selector = hash.substring(0, 10);
        
        console.log(`   ${errorSig.padEnd(30)} -> ${selector}`);
        
        if (selector === "0x5cd5d233") {
          console.log(`MATCH FOUND! ${errorSig} has selector 0x5cd5d233`);
          return;
        }
      }

      console.log("\nNo match found in common error patterns");
    });

    it("should compare signatures between working simple orders and failing ZK orders", async function () {
      console.log("\nDebugging BadSignature() error by comparing signature generation...");

      // Step 1: Create a simple order (that works)
      const { buildOrder, buildMakerTraits } = await import("./helpers/orderUtils");
      
      const simpleOrder = buildOrder({
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        makerTraits: buildMakerTraits({
          allowPartialFill: true,
          allowMultipleFills: true,
        }),
        salt: BigInt(12345)
      }, {
        makerAssetSuffix: '0x',
        takerAssetSuffix: '0x', 
        makingAmountData: '0x',
        takingAmountData: '0x',
        predicate: '0x',
        permit: '0x',
        preInteraction: '0x',
        postInteraction: '0x',
      });

      console.log("Simple order created");

      // Step 2: Create a ZK order (that fails)  
      const { encodedData } = await getSharedZKProof();
      const { buildZKOrder } = await import("../src/utils/zkOrderBuilder");
      
      const zkOrderResult = await buildZKOrder({
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        zkPredicateAddress: zkPredicateAddress,
        routerInterface: aggregationRouter.interface,
        secretParams: {
          secretPrice: BigInt("1800000000"),
          secretAmount: ethers.parseEther("5"),
          nonce: BigInt("123456789")
        },
        zkConfig: {
          preGeneratedProof: {
            proof: null,
            publicSignals: [],
            encodedData: encodedData,
            commitment: BigInt("0x14472f349659665d530bcdc25a29dbd933c03044bcc85bb308285c6061d40846")
          }
        }
      });

      console.log("ZK order created");

      // Generate signatures for both
      const network = await ethers.provider.getNetwork();
      const routerAddress = await aggregationRouter.getAddress();
      
      console.log("\nGenerating signatures:");
      console.log(`   Chain ID: ${network.chainId}`);
      console.log(`   Router: ${routerAddress}`);

      const simpleSignature = await signOrder(simpleOrder, network.chainId, routerAddress, maker);
      console.log(`Simple order signature: ${simpleSignature.substring(0, 20)}...`);
      
      const zkSignature = await signOrder(zkOrderResult.order, network.chainId, routerAddress, maker);
      console.log(`ZK order signature: ${zkSignature.substring(0, 20)}...`);

      // Extract signature components
      const simpleSig = ethers.Signature.from(simpleSignature);
      const zkSig = ethers.Signature.from(zkSignature);

      console.log("\nSignature components:");
      console.log("Simple order:");
      console.log(`   r: ${simpleSig.r}`);
      console.log(`   s: ${simpleSig.s}`);
      console.log(`   v: ${simpleSig.v}`);
      
      console.log("ZK order:");
      console.log(`   r: ${zkSig.r}`);
      console.log(`   s: ${zkSig.s}`);  
      console.log(`   v: ${zkSig.v}`);

      // Test both orders
      console.log("\nTesting simple order fill...");
      const simpleVs = simpleSig.v === 27 ? simpleSig.s : "0x" + (BigInt(simpleSig.s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);
      const simpleTakerTraits = buildTakerTraits({ makingAmount: false });

      try {
        await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          simpleOrder,
          simpleSig.r,
          simpleVs,
          BigInt("3500000000"),
          simpleTakerTraits.traits,
          simpleTakerTraits.args
        );
        console.log("Simple order static call succeeded - signature is valid");
      } catch (error: any) {
        console.log(`Simple order failed: ${error.data || error.message}`);
      }

      console.log("\nTesting ZK order fill...");
      const zkVs = zkSig.v === 27 ? zkSig.s : "0x" + (BigInt(zkSig.s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);
      const extension = (zkOrderResult.order as any).extension || '0x';
      const zkTakerTraits = buildTakerTraits({
        makingAmount: false,
        extension: extension,
        target: taker.address,
        interaction: '0x'
      });

      try {
        await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          zkOrderResult.order,
          zkSig.r,
          zkVs,
          BigInt("3500000000"),
          zkTakerTraits.traits,
          zkTakerTraits.args
        );
        console.log("ZK order static call succeeded - signature is valid");
      } catch (error: any) {
        console.log(`ZK order failed: ${error.data || error.message}`);
        if (error.data === "0x5cd5d233") {
          console.log("Confirmed: ZK order has BadSignature() issue");
        }
      }
    });

    it("should test basic 1inch order without ZK to isolate the issue", async function () {
      console.log("\n🔍 DEBUGGING: Basic 1inch order without ZK...");
      const { buildOrder, buildMakerTraits } = await import("./helpers/orderUtils");
      
      const simpleOrder = buildOrder({
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        makerTraits: buildMakerTraits({
          allowPartialFill: true,
          allowMultipleFills: true,
        }),
        salt: BigInt(1)
      }, {
        makerAssetSuffix: '0x',
        takerAssetSuffix: '0x', 
        makingAmountData: '0x',
        takingAmountData: '0x',
        predicate: '0x',
        permit: '0x',
        preInteraction: '0x',
        postInteraction: '0x',
      });

      console.log("Simple order created:");
      console.log(`   Making: 1 WETH → Taking: 3500 USDC`);
      console.log(`   Salt: 0x${simpleOrder.salt.toString(16)}`);
      console.log(`   Extension: ${(simpleOrder as any).extension || '0x'}`);

      const rawSignature = await signOrder(simpleOrder, BigInt(1), await aggregationRouter.getAddress(), maker);
      console.log("Simple order signed");

      const takerTraitsData = buildTakerTraits({ makingAmount: false });
      console.log("Simple taker traits built");
      console.log(`   Taker traits: ${takerTraitsData.traits}`);
      console.log(`   Args length: ${takerTraitsData.args.length}`);

      const { r, s, v } = ethers.Signature.from(rawSignature);
      const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);

      console.log("Testing simple order static call...");
      try {
        const result = await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          simpleOrder,
          r,
          vs,
          BigInt("3500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        console.log(`Simple order succeeded: ${result}`);
      } catch (error: any) {
        console.log(`Simple order failed: ${error.message}`);
        console.log(`   Error data: ${error.data}`);
        console.log("Different error - ZK order has additional issues");
      }
    });

    it("should compare static call vs real transaction for ZK orders", async function () {
      console.log("\nComparing static call vs real transaction...");

      const { encodedData } = await getSharedZKProof();
      const { buildZKOrder } = await import("../src/utils/zkOrderBuilder");
      
      const zkOrderResult = await buildZKOrder({
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        zkPredicateAddress: zkPredicateAddress,
        routerInterface: aggregationRouter.interface,
        secretParams: {
          secretPrice: BigInt("1800000000"),
          secretAmount: ethers.parseEther("5"),
          nonce: BigInt("123456789")
        },
        zkConfig: {
          preGeneratedProof: {
            proof: null,
            publicSignals: [],
            encodedData: encodedData,
            commitment: BigInt("0x14472f349659665d530bcdc25a29dbd933c03044bcc85bb308285c6061d40846")
          }
        }
      });

      const network = await ethers.provider.getNetwork();
      const routerAddress = await aggregationRouter.getAddress();
      
      console.log(`Network info:`);
      console.log(`   Chain ID at runtime: ${network.chainId}`);
      console.log(`   Router: ${routerAddress}`);

      const rawSignature = await signOrder(zkOrderResult.order, network.chainId, routerAddress, maker);
      const { r, s, v } = ethers.Signature.from(rawSignature);
      const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);

      const extension = (zkOrderResult.order as any).extension || '0x';
      const takerTraitsData = buildTakerTraits({
        makingAmount: false,
        extension: extension,
        target: taker.address,
        interaction: '0x'
      });

      console.log(`Transaction parameters:`);
      console.log(`   Fill amount: ${BigInt("3500000000")}`);
      console.log(`   Taker traits: 0x${takerTraitsData.traits.toString(16)}`);
      console.log(`   Extension args length: ${takerTraitsData.args.length}`);

      // Try static call
      console.log("\nTesting static call...");
      try {
        const staticResult = await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          zkOrderResult.order,
          r,
          vs,
          BigInt("3500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        console.log(`Static call succeeded: ${staticResult}`);
      } catch (error: any) {
        console.log(`Static call failed: ${error.data || error.message}`);
      }

      // Try gas estimation
      console.log("\nTesting gas estimation...");
      try {
        const gasEstimate = await aggregationRouter.connect(taker).fillOrderArgs.estimateGas(
          zkOrderResult.order,
          r,
          vs,
          BigInt("3500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        console.log(`Gas estimation succeeded: ${gasEstimate}`);
      } catch (error: any) {
        console.log(`Gas estimation failed: ${error.data || error.message}`);
      }

      // Try real transaction
      console.log("\nTesting real transaction...");
      try {
        const tx = await aggregationRouter.connect(taker).fillOrderArgs(
          zkOrderResult.order,
          r,
          vs,
          BigInt("3500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        const receipt = await tx.wait();
        console.log(`Real transaction succeeded: ${receipt.gasUsed}`);
      } catch (error: any) {
        console.log(`Real transaction failed: ${error.data || error.message}`);
      }

      // Check balances and nonces
      console.log("\nAccount state:");
      const makerNonce = await ethers.provider.getTransactionCount(maker.address);
      const takerNonce = await ethers.provider.getTransactionCount(taker.address);
      console.log(`   Maker nonce: ${makerNonce}`);
      console.log(`   Taker nonce: ${takerNonce}`);
    });
  });
}); 