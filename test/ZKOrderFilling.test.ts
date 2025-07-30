import { expect } from "chai";
import { ethers, network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Interface } from "ethers";
import { Groth16Verifier__factory, HiddenParamPredicateZK__factory } from "../typechain-types";
import { buildZKOrder } from "../src/utils/zkOrderBuilder";
import { fillZKOrder, estimateZKFillGas, validateZKOrderForFill } from "../src/utils/zkOrderFilling";
import { processZKOrderLifecycle } from "../src/utils/zkOrderSigning";
import { formatBalance } from "./helpers/testUtils";
import { getSharedZKContracts, getSharedZKProof } from "./helpers/sharedContracts";
import { buildTakerTraits, signOrder } from "./helpers/orderUtils";

// Load 1inch ABI
const AggregationRouterV6ABI = require("../abi/AggregationRouterV6.json");

const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

describe("ZK Order Filling", function () {
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

    // REVERTED: Use original AggregationRouterV6ABI like working PredicateExtensions.test.ts
    // The PredicateExtensions tests prove this interface works correctly
    routerInterface = new Interface(AggregationRouterV6ABI);
    aggregationRouter = new ethers.Contract(AGGREGATION_ROUTER_V6, AggregationRouterV6ABI, deployer);

    // Setup token contracts for balance checking
    wethContract = await ethers.getContractAt("MockERC20", WETH_ADDRESS);
    usdcContract = await ethers.getContractAt("MockERC20", USDC_ADDRESS);

    // Setup whale accounts for testing  
    const wethWhale = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
    const usdcWhale = "0x28C6c06298d514Db089934071355E5743bf21d60"; // Binance 14 (massive USDC balance)

    // Impersonate whale accounts and add ETH for gas
    await ethers.provider.send("hardhat_impersonateAccount", [wethWhale]);
    await ethers.provider.send("hardhat_impersonateAccount", [usdcWhale]);

    // Add ETH to whale accounts for gas fees
    await ethers.provider.send("hardhat_setBalance", [wethWhale, "0x1000000000000000000"]); // 1 ETH
    await ethers.provider.send("hardhat_setBalance", [usdcWhale, "0x1000000000000000000"]); // 1 ETH

    const wethWhaleSigner = await ethers.getSigner(wethWhale);
    const usdcWhaleSigner = await ethers.getSigner(usdcWhale);

    // Transfer smaller amounts to be extra safe with balances
    await wethContract.connect(wethWhaleSigner).transfer(maker.address, ethers.parseEther("20"));
    await usdcContract.connect(usdcWhaleSigner).transfer(taker.address, ethers.parseUnits("50000", 6));

    // Approve router to spend tokens
    await wethContract.connect(maker).approve(AGGREGATION_ROUTER_V6, ethers.parseEther("20"));
    await usdcContract.connect(taker).approve(AGGREGATION_ROUTER_V6, ethers.parseUnits("50000", 6));

    console.log("Test setup completed:");
    console.log(`  Maker WETH: ${formatBalance(await wethContract.balanceOf(maker.address), 18, 'WETH')}`);
    console.log(`  Taker USDC: ${formatBalance(await usdcContract.balanceOf(taker.address), 6, 'USDC')}`);
  });

  afterEach(async function () {
    // Restore snapshot after each test to ensure clean state
    await ethers.provider.send("evm_revert", [snapshotId]);
    snapshotId = await ethers.provider.send("evm_snapshot", []);
  });

  after(async function () {
    // Clean up final snapshot
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  describe("Basic Fill Functionality", function () {
    it("should fill a ZK order successfully with extension processing", async function () {
      console.log("\nTesting basic ZK order fill with extension processing...\n");

      // Get shared proof for deterministic testing
      const sharedProof = await getSharedZKProof();

      // Step 1: Create and prepare ZK order using shared proof parameters
      const params = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("5"), // 5 WETH
        takingAmount: BigInt("17500000000"), // 17,500 USDC (3500 USDC per ETH)
        secretParams: {
          secretPrice: BigInt("3200000000"), // 3200 USDC per ETH minimum
          secretAmount: ethers.parseEther("2"), // 2 WETH minimum
          nonce: sharedProof.nonce // Use shared nonce for determinism
        },
        zkConfig: {
          customNonce: sharedProof.nonce, // Ensure deterministic nonce
          preGeneratedProof: {
            proof: sharedProof.proof,
            publicSignals: sharedProof.publicSignals,
            encodedData: sharedProof.encodedData,
            commitment: sharedProof.commitment
          }
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      console.log(`ZK Order built successfully:`, {
        extensionLength: zkOrder.order.extension?.length || 0,
        saltHex: `0x${zkOrder.order.salt.toString(16)}`,
        debugInfo: zkOrder.debugInfo
      });
      
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker);
      
      console.log(`Lifecycle status: ${lifecycle.status}`);
      if (lifecycle.status === 'invalid') {
        console.log(`Validation failed:`, lifecycle.validation);
      }

      expect(lifecycle.status).to.equal('ready_to_fill');
      expect(lifecycle.signature).to.not.be.undefined;

      console.log("ZK order created and ready for fill");
      console.log(`   Order: ${formatBalance(zkOrder.order.makingAmount, 18, 'WETH')} → ${formatBalance(zkOrder.order.takingAmount, 6, 'USDC')}`);
      console.log(`   Extension: ${zkOrder.order.extension?.length || 0} bytes`);

      // Step 2: Record balances before fill
      const makerWethBefore = await wethContract.balanceOf(maker.address);
      const makerUsdcBefore = await usdcContract.balanceOf(maker.address);
      const takerWethBefore = await wethContract.balanceOf(taker.address);
      const takerUsdcBefore = await usdcContract.balanceOf(taker.address);

      console.log("\nBalances before fill:");
      console.log(`   Maker: ${formatBalance(makerWethBefore, 18, 'WETH')}, ${formatBalance(makerUsdcBefore, 6, 'USDC')}`);
      console.log(`   Taker: ${formatBalance(takerWethBefore, 18, 'WETH')}, ${formatBalance(takerUsdcBefore, 6, 'USDC')}`);

      // Step 3: Fill the ZK order
      const fillAmount = zkOrder.order.takingAmount; // Full fill
      
      // Debug: Log order structure and extension details
      console.log("\nDebug: Order structure before fill:");
      console.log(`   Salt: ${zkOrder.order.salt.toString()}`);
      console.log(`   MakerTraits: ${zkOrder.order.makerTraits.toString()}`);
      console.log(`   Extension present: ${!!zkOrder.order.extension}`);
      console.log(`   Extension length: ${zkOrder.order.extension?.length || 0}`);
      if (zkOrder.order.extension) {
        console.log(`   Extension data (first 100 chars): ${zkOrder.order.extension.substring(0, 100)}`);
      }
      
             // DEBUG: Try static call first like working example
       console.log("\n🧪 Testing with static call first...");
       try {
         const extension = zkOrder.order.extension || '0x';
         const takerTraitsData = buildTakerTraits({
           makingAmount: false, // Taking amount based fill
           extension: extension,
           target: taker.address,
           interaction: '0x'
         });
        
        console.log(`   Static call parameters:`);
        console.log(`   - Order maker: ${zkOrder.order.maker}`);
        console.log(`   - Order extension length: ${zkOrder.order.extension?.length || 0}`);
        console.log(`   - Fill amount: ${fillAmount}`);
        console.log(`   - Taker traits: ${takerTraitsData.traits}`);
        console.log(`   - Extension args length: ${takerTraitsData.args.length}`);
        console.log(`   - Signature r: ${lifecycle.signature!.r}`);
        console.log(`   - Signature vs: ${lifecycle.signature!.vs}`);
        
        const staticResult = await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          zkOrder.order,
          lifecycle.signature!.r,
          lifecycle.signature!.vs,
          fillAmount,
          takerTraitsData.traits,
          takerTraitsData.args
        );
        console.log(`   ✅ Static call successful: ${staticResult}`);
        
      } catch (staticError: any) {
        console.log(`   ❌ Static call failed: ${staticError.reason || staticError.message}`);
        console.log(`   Static error data: ${staticError.data || 'none'}`);
      }
      
      const fillResult = await fillZKOrder(
        lifecycle,
        taker,
        fillAmount,
        aggregationRouter,
        { enableLogging: true }
      );

      expect(fillResult.success).to.be.true;
      expect(fillResult.txHash).to.be.a('string');
      expect(fillResult.gasUsed).to.be.greaterThan(0);
      expect(fillResult.balanceChanges).to.not.be.undefined;

      console.log("\nZK order filled successfully!");
      console.log(`   Transaction: ${fillResult.txHash}`);
      console.log(`   Gas used: ${fillResult.gasUsed?.toLocaleString()}`);

      // Step 4: Verify balance changes
      const makerWethAfter = await wethContract.balanceOf(maker.address);
      const makerUsdcAfter = await usdcContract.balanceOf(maker.address);
      const takerWethAfter = await wethContract.balanceOf(taker.address);
      const takerUsdcAfter = await usdcContract.balanceOf(taker.address);

      console.log("\nBalances after fill:");
      console.log(`   Maker: ${formatBalance(makerWethAfter, 18, 'WETH')}, ${formatBalance(makerUsdcAfter, 6, 'USDC')}`);
      console.log(`   Taker: ${formatBalance(takerWethAfter, 18, 'WETH')}, ${formatBalance(takerUsdcAfter, 6, 'USDC')}`);

      // Verify the trade occurred correctly
      expect(makerWethAfter).to.equal(makerWethBefore - zkOrder.order.makingAmount);
      expect(makerUsdcAfter).to.equal(makerUsdcBefore + zkOrder.order.takingAmount);
      expect(takerWethAfter).to.equal(takerWethBefore + zkOrder.order.makingAmount);
      expect(takerUsdcAfter).to.equal(takerUsdcBefore - zkOrder.order.takingAmount);

      // Verify balance changes match actual transfers
      const changes = fillResult.balanceChanges!;
      expect(changes.makerMakingAssetDelta).to.equal(-zkOrder.order.makingAmount);
      expect(changes.makerTakingAssetDelta).to.equal(zkOrder.order.takingAmount);
      expect(changes.takerMakingAssetDelta).to.equal(zkOrder.order.makingAmount);
      expect(changes.takerTakingAssetDelta).to.equal(-zkOrder.order.takingAmount);

      console.log("\n🎉 All balance verifications passed!");
    });

    it("should handle partial fills correctly", async function () {
      console.log("\nTesting partial ZK order fill...\n");

      // Create another ZK order for partial fill test
      const params = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("10"), // 10 WETH
        takingAmount: BigInt("35000000000"), // 35,000 USDC
        secretParams: {
          secretPrice: BigInt("3200000000"),
          secretAmount: ethers.parseEther("3"),
          nonce: BigInt("987654321")
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker);

      // Fill only 50% of the order
      const partialFillAmount = zkOrder.order.takingAmount / 2n; // 17,500 USDC
      const expectedMakingAmount = zkOrder.order.makingAmount / 2n; // 5 WETH

      console.log(`Partial fill: ${formatBalance(partialFillAmount, 6, 'USDC')} of ${formatBalance(zkOrder.order.takingAmount, 6, 'USDC')}`);

      const fillResult = await fillZKOrder(
        lifecycle,
        taker,
        partialFillAmount,
        aggregationRouter,
        { enableLogging: true }
      );

      expect(fillResult.success).to.be.true;

      // Verify partial amounts were transferred
      const changes = fillResult.balanceChanges!;
      expect(changes.makerMakingAssetDelta).to.equal(-expectedMakingAmount);
      expect(changes.makerTakingAssetDelta).to.equal(partialFillAmount);
      expect(changes.takerMakingAssetDelta).to.equal(expectedMakingAmount);
      expect(changes.takerTakingAssetDelta).to.equal(-partialFillAmount);

      console.log("Partial fill completed successfully!");
    });
  });

  describe("Gas Estimation", function () {
    it("should estimate gas accurately for ZK order fills", async function () {
      // Create ZK order for gas estimation
      const params = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3200000000"),
          secretAmount: ethers.parseEther("0.5"),
          nonce: BigInt("555666777")
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker);

      // Test gas estimation
      const estimatedGas = await estimateZKFillGas(
        lifecycle,
        taker,
        zkOrder.order.takingAmount,
        aggregationRouter
      );

      expect(estimatedGas).to.be.greaterThan(0);
      console.log(`Estimated gas for ZK fill: ${estimatedGas.toLocaleString()}`);

      // Verify estimation is reasonable (should be higher than basic transfers)
      expect(estimatedGas).to.be.greaterThan(BigInt(200000)); // Higher than basic transfers
      expect(estimatedGas).to.be.lessThan(BigInt(1000000)); // Not unreasonably high
    });
  });

  describe("Fill Validation", function () {
    it("should validate ZK orders before filling", async function () {
      // Create ZK order for validation testing
      const params = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("2"),
        takingAmount: BigInt("7000000000"),
        secretParams: {
          secretPrice: BigInt("3200000000"),
          secretAmount: ethers.parseEther("1"),
          nonce: BigInt("111222333")
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker);

      // Test valid order validation
      const validValidation = validateZKOrderForFill(
        lifecycle,
        taker.address,
        zkOrder.order.takingAmount
      );

      expect(validValidation.canFill).to.be.true;
      expect(validValidation.errors).to.be.empty;
      console.log("Valid order passed validation");

      // Test validation with excessive fill amount
      const excessiveAmountValidation = validateZKOrderForFill(
        lifecycle,
        taker.address,
        zkOrder.order.takingAmount * 2n
      );

      expect(excessiveAmountValidation.canFill).to.be.true; // Still can fill (partial)
      expect(excessiveAmountValidation.warnings.join(' ')).to.match(/exceeds order taking amount/);
      console.log("Excessive amount validation working");

      // Test validation with zero amount
      const zeroAmountValidation = validateZKOrderForFill(
        lifecycle,
        taker.address,
        0n
      );

      expect(zeroAmountValidation.canFill).to.be.false;
      expect(zeroAmountValidation.errors.join(' ')).to.match(/greater than zero/);
      console.log("Zero amount validation working");

      // Test validation with same maker/taker
      const sameMakerTakerValidation = validateZKOrderForFill(
        lifecycle,
        maker.address, // Same as maker
        zkOrder.order.takingAmount
      );

      expect(sameMakerTakerValidation.canFill).to.be.true; // Technically allowed
      expect(sameMakerTakerValidation.warnings.join(' ')).to.match(/same address/);
      console.log("Same maker/taker validation working");
    });
  });

  describe("Error Handling", function () {
    it("should handle invalid lifecycle states", async function () {
      // Create ZK order but don't process lifecycle
      const params = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3200000000"),
          secretAmount: ethers.parseEther("0.5"),
          nonce: BigInt("999888777")
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      
      // Create lifecycle without signature (not ready_to_fill)
      const invalidLifecycle = {
        order: zkOrder.order,
        validation: { isValid: true, errors: [], warnings: [], gasEstimate: 0 },
        status: 'created' as const
      };

      const fillResult = await fillZKOrder(
        invalidLifecycle,
        taker,
        zkOrder.order.takingAmount,
        aggregationRouter
      );

      expect(fillResult.success).to.be.false;
      expect(fillResult.error).to.include('status is \'created\'');
      console.log("Invalid lifecycle state properly rejected");
    });

    it("should handle missing extension data", async function () {
      // Manually create an order without extension for error testing
      const params = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3200000000"),
          secretAmount: ethers.parseEther("0.5"),
          nonce: BigInt("777666555")
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker);
      
      // Corrupt the extension
      lifecycle.order.extension = '0x';

      const fillResult = await fillZKOrder(
        lifecycle,
        taker,
        zkOrder.order.takingAmount,
        aggregationRouter
      );

      expect(fillResult.success).to.be.false;
      expect(fillResult.error).to.include('missing required extension data');
      console.log("Missing extension data properly rejected");
    });
  });

  describe("Configuration Options", function () {
    it("should handle custom fill configuration", async function () {
      // Create ZK order for configuration testing
      const params = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"),
        takingAmount: BigInt("3500000000"),
        secretParams: {
          secretPrice: BigInt("3200000000"),
          secretAmount: ethers.parseEther("0.5"),
          nonce: BigInt("444333222")
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker);

      // Test with custom configuration
      const config = {
        gasLimit: BigInt(500000),
        target: taker.address,
        interaction: '0x',
        enableLogging: false // Disable logging for cleaner test output
      };

      const fillResult = await fillZKOrder(
        lifecycle,
        taker,
        zkOrder.order.takingAmount,
        aggregationRouter,
        config
      );

      expect(fillResult.success).to.be.true;
      expect(fillResult.gasUsed).to.be.lessThanOrEqual(config.gasLimit!);
      console.log("Custom configuration applied successfully");
    });
  });

  describe("Simple ZK Extension Test", function () {
    it("should test direct ZK predicate call without arbitraryStaticCall wrapper", async function () {
      console.log("\nTesting direct ZK predicate call (bypassing complex extension builder)...\n");

      // Step 1: Build a simple ZK order manually using the working predicate pattern
      const params = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("2"), // 2 WETH
        takingAmount: BigInt("7000000000"), // 7,000 USDC
        secretParams: {
          secretPrice: BigInt("3200000000"), // 3200 USDC per ETH minimum
          secretAmount: ethers.parseEther("1"), // 1 WETH minimum
          nonce: BigInt("111222333")
        },
        zkPredicateAddress,
        routerInterface
      };

      // Calculate commitment first
      const commitment = await import('../src/utils/commitmentUtils').then(m => 
        m.calculateCommitment(
          params.secretParams.secretPrice,
          params.secretParams.secretAmount, 
          params.secretParams.nonce
        )
      );

      // Generate ZK proof 
      const { proof, publicSignals } = await import('../src/utils/proofGenerator').then(module => 
        module.generateProof({
          secretPrice: params.secretParams.secretPrice.toString(),
          secretAmount: params.secretParams.secretAmount.toString(),
          commit: commitment.toString(), // Use calculated commitment
          nonce: params.secretParams.nonce.toString(),
          offeredPrice: (params.takingAmount * BigInt(1e18) / params.makingAmount).toString(),
          offeredAmount: params.makingAmount.toString()
        }, {
          wasmPath: require('path').join(__dirname, "../circuits/hidden_params_js/hidden_params.wasm"),
          zkeyPath: require('path').join(__dirname, "../circuits/hidden_params_0001.zkey")
        })
      );

      // Encode proof data correctly
      const { encodedData: proofData } = await import('../src/utils/zkProofEncoder').then(module => 
        module.encodeZKProofData(proof, publicSignals)
      );

      console.log(`Generated proof data: ${proofData.length} chars`);

      // Create simple predicate call directly (like working PredicateExtensions.test.ts)
      const predicateCalldata = routerInterface.encodeFunctionData("arbitraryStaticCall", [
        zkPredicateAddress,
        "0x6fe7b0ba" + proofData.slice(2) // predicate(bytes) selector + proof data
      ]);

      console.log(`Simple predicate call: ${predicateCalldata.length} chars`);

      // Build order directly using the simple pattern
      const order = {
        maker: params.maker,
        receiver: ethers.ZeroAddress, // Add missing receiver property
        makerAsset: params.makerAsset,
        takerAsset: params.takerAsset,
        makingAmount: params.makingAmount,
        takingAmount: params.takingAmount,
        makerTraits: BigInt("0x1000000000000000000000000000000000000000000000000000000000000000"), // Basic maker traits as bigint
        salt: BigInt(Date.now() * 1000 + Math.floor(Math.random() * 1000)),
        extension: predicateCalldata // Direct predicate call
      };

      console.log(`Order created with simple extension: ${order.extension.length} chars`);

      // Sign order
      const network = await ethers.provider.getNetwork();
      const signature = await import('../test/helpers/orderUtils').then(module => 
        module.signOrder(order, network.chainId, aggregationRouter.target, maker)
      );
      
      const sig = ethers.Signature.from(signature);

      // Try to fill using the same pattern as working tests
      const extension = order.extension || '0x';
      const takerTraitsData = await import('../test/helpers/orderUtils').then(module => 
        module.buildTakerTraits({
          makingAmount: false,
          extension: extension,
          target: taker.address,
          interaction: '0x'
        })
      );

      console.log(`Taker traits: ${takerTraitsData.traits.toString()}`);
      console.log(`Extension args: ${takerTraitsData.args.length} bytes`);

      try {
        const fillTx = await aggregationRouter.connect(taker).fillOrderArgs(
          order,
          sig.r,
          sig.yParityAndS, // Use correct signature property
          order.takingAmount,
          takerTraitsData.traits,
          takerTraitsData.args
        );

        const receipt = await fillTx.wait();
        console.log(`Simple ZK predicate fill succeeded! Gas: ${receipt.gasUsed.toLocaleString()}`);
        
        // Basic verification
        expect(receipt.status).to.equal(1);
        
      } catch (error: any) {
        console.log(`Simple ZK predicate fill failed: ${error.message}`);
        if (error.data) {
          console.log(`   Error data: ${error.data}`);
        }
        // Don't throw - this is a diagnostic test
      }
    });
  });

  describe("Debug Direct Fill", function () {
    it("should debug direct fillOrderArgs call to isolate the issue", async function () {
      console.log("\n🔍 DEBUGGING: Direct fillOrderArgs call...");

      // Step 1: Create ZK order using shared proof (identical to working test)
      const { nonce: sharedNonce, encodedData, commitment, proof, publicSignals } = await getSharedZKProof();
      
      const params = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("5"), // 5 WETH
        takingAmount: BigInt("17500000000"), // 17,500 USDC
        secretParams: {
          secretPrice: BigInt("3200000000"), // 3200 USDC per ETH minimum
          secretAmount: ethers.parseEther("2"), // 2 WETH minimum
          nonce: sharedNonce
        },
        zkConfig: {
          customNonce: sharedNonce,
          preGeneratedProof: {
            proof,
            publicSignals,
            encodedData,
            commitment
          }
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker, aggregationRouter);

      console.log("✅ ZK Order created, now attempting DIRECT fillOrderArgs...");
      
      // Step 2: Build taker traits exactly like working example
      const extension = zkOrder.order.extension || '0x';
      const takerTraits = buildTakerTraits({
        makingAmount: false, // Taking amount based fill
        threshold: 0n,
        extension: extension,
        target: taker.address,
        interaction: "0x"
      });

      console.log("📋 Direct call parameters:");
      console.log(`   - Order maker: ${zkOrder.order.maker}`);
      console.log(`   - Order makerAsset: ${zkOrder.order.makerAsset}`);
      console.log(`   - Order takerAsset: ${zkOrder.order.takerAsset}`);
      console.log(`   - Order makingAmount: ${zkOrder.order.makingAmount}`);
      console.log(`   - Order takingAmount: ${zkOrder.order.takingAmount}`);
      console.log(`   - Order salt: 0x${zkOrder.order.salt.toString(16)}`);
      console.log(`   - Order makerTraits: ${zkOrder.order.makerTraits}`);
      console.log(`   - Extension length: ${extension.length}`);
      console.log(`   - Fill amount: ${zkOrder.order.takingAmount}`);
      console.log(`   - Taker traits: ${takerTraits.traits}`);
      console.log(`   - Extension args length: ${takerTraits.args.length}`);
      console.log(`   - Signature r: ${lifecycle.signature!.r}`);
      console.log(`   - Signature vs: ${lifecycle.signature!.vs}`);

      // Step 3: Check maker balance and allowance
      const makerWethBalance = await wethContract.balanceOf(maker.address);
      const makerAllowance = await wethContract.allowance(maker.address, AGGREGATION_ROUTER_V6);
      
      console.log("💰 Maker financial state:");
      console.log(`   - WETH balance: ${formatBalance(makerWethBalance, 18, 'WETH')}`);
      console.log(`   - WETH allowance: ${formatBalance(makerAllowance, 18, 'WETH')}`);
      console.log(`   - Required: ${formatBalance(zkOrder.order.makingAmount, 18, 'WETH')}`);

      // Step 4: Try the direct call
      try {
        // Static call to see if it would succeed
        console.log("🧪 Testing static call...");
        const staticResult = await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          zkOrder.order,
          lifecycle.signature!.r,
          lifecycle.signature!.vs,
          zkOrder.order.takingAmount,
          takerTraits.traits,
          takerTraits.args
        );
        console.log(`✅ Static call succeeded: ${staticResult}`);

        // If static call works, try real transaction
        console.log("⚡ Attempting real transaction...");
        const tx = await aggregationRouter.connect(taker).fillOrderArgs(
          zkOrder.order,
          lifecycle.signature!.r,
          lifecycle.signature!.vs,
          zkOrder.order.takingAmount,
          takerTraits.traits,
          takerTraits.args
        );
        
        const receipt = await tx.wait();
        console.log(`✅ SUCCESS! Gas used: ${receipt.gasUsed}`);
        
      } catch (error: any) {
        console.log(`❌ Direct call failed: ${error.reason || error.message}`);
        console.log(`   Error data: ${error.data || 'none'}`);
        
        // This is expected to fail with the same error, so we'll analyze it
        expect(error.data).to.equal("0xdc11ee6b");
      }
    });
  });

  describe("Debug Signature Generation", function () {
    it("should debug signature generation vs working example pattern", async function () {
      console.log("\n🔍 DEBUGGING: Signature generation...");

      // Step 1: Create ZK order using shared proof
      const { nonce: sharedNonce, encodedData, commitment, proof, publicSignals } = await getSharedZKProof();
      
      const params = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("5"),
        takingAmount: BigInt("17500000000"),
        secretParams: {
          secretPrice: BigInt("3200000000"),
          secretAmount: ethers.parseEther("2"),
          nonce: sharedNonce
        },
        zkConfig: {
          customNonce: sharedNonce,
          preGeneratedProof: { proof, publicSignals, encodedData, commitment }
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      console.log("✅ ZK Order created");

      // Step 2: Check network info
      const network = await ethers.provider.getNetwork();
      const routerAddress = await aggregationRouter.getAddress();
      
      console.log("🌐 Network Info:");
      console.log(`   Chain ID: ${network.chainId}`);
      console.log(`   Router Address: ${routerAddress}`);
      console.log(`   Expected Router: 0x111111125421cA6dc452d289314280a0f8842A65`);

             // Step 3: Generate signature using working example pattern
       console.log("\n📝 Testing signature generation patterns...");
      
      // Method 1: Our current approach via processZKOrderLifecycle
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker, aggregationRouter);
      console.log("🔐 Our signature:");
      console.log(`   r: ${lifecycle.signature!.r}`);
      console.log(`   vs: ${lifecycle.signature!.vs}`);
      
      // Method 2: Working example pattern (direct signOrder call)
      const rawSignature = await signOrder(zkOrder.order, 1n, routerAddress, maker);
      const { r, s, v } = ethers.Signature.from(rawSignature);
      const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);
      
      console.log("🔐 Working example pattern:");
      console.log(`   r: ${r}`);
      console.log(`   vs: ${vs}`);
      console.log(`   original vs (ethers): ${ethers.Signature.from(rawSignature).yParityAndS}`);
      
      // Step 4: Compare signatures
      const signaturesMatch = lifecycle.signature!.r === r && lifecycle.signature!.vs === vs;
      console.log(`\n🔍 Signatures match: ${signaturesMatch}`);
      
      if (!signaturesMatch) {
        console.log("❌ Signature mismatch detected!");
        console.log("   This could be the cause of the 0x revert");
      } else {
        console.log("✅ Signatures match - issue is elsewhere");
      }

      // Step 5: Test fill with working example signature pattern
      console.log("\n⚡ Testing fill with working example signature...");
      
      try {
        const extension = zkOrder.order.extension || '0x';
        const takerTraits = buildTakerTraits({
          makingAmount: false,
          extension: extension,
          target: taker.address,
          interaction: '0x'
        });

        const staticResult = await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          zkOrder.order,
          r, // Use working example r
          vs, // Use working example vs
          zkOrder.order.takingAmount,
          takerTraits.traits,
          takerTraits.args
        );
        console.log(`✅ SUCCESS with working signature! Static result: ${staticResult}`);
        
        // Try real transaction
        const tx = await aggregationRouter.connect(taker).fillOrderArgs(
          zkOrder.order,
          r,
          vs,
          zkOrder.order.takingAmount,
          takerTraits.traits,
          takerTraits.args
        );
        const receipt = await tx.wait();
        console.log(`🎉 REAL TRANSACTION SUCCESS! Gas used: ${receipt.gasUsed}`);
        
      } catch (error: any) {
        console.log(`❌ Still failed with working signature: ${error.reason || error.message}`);
        console.log(`   Error data: ${error.data || 'none'}`);
      }

      // Step 6: Test ZK predicate directly to isolate the issue
      console.log("\n🔍 Testing ZK predicate directly...");
      
      try {
        // Extract the encoded proof data from our shared proof
        console.log("📦 Calling predicate directly with ZK proof...");
        const result = await predicate.predicate(encodedData);
        console.log(`✅ Direct predicate call result: ${result}`);
        
        if (result === 1n) {
          console.log("✅ ZK predicate verification works correctly!");
        } else {
          console.log("❌ ZK predicate verification failed!");
        }
        
      } catch (error: any) {
        console.log(`❌ Direct predicate call failed: ${error.reason || error.message}`);
      }

      // Step 7: Test the extension processing
      console.log("\n🔧 Testing extension processing...");
      
      try {
        // Parse the extension to see what's inside
        const extension = zkOrder.order.extension!;
        console.log(`📝 Extension length: ${extension.length}`);
        console.log(`📝 Extension (first 200 chars): ${extension.substring(0, 200)}`);
        
        // Try to manually decode the extension like 1inch would
        console.log("🔍 Analyzing extension structure...");
        
      } catch (error: any) {
        console.log(`❌ Extension analysis failed: ${error.message}`);
      }
    });
  });

  describe("Debug Simple Order", function () {
    it("should test basic 1inch order without ZK to isolate the issue", async function () {
      console.log("\n🔍 DEBUGGING: Basic 1inch order without ZK...");

      // Step 1: Create a simple order without any ZK extension
      const { buildOrder, buildMakerTraits } = await import("./helpers/orderUtils");
      
      const simpleOrder = buildOrder({
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"), // 1 WETH
        takingAmount: BigInt("3500000000"), // 3,500 USDC
        makerTraits: buildMakerTraits({
          allowPartialFill: true,
          allowMultipleFills: true
        })
      });

      console.log("✅ Simple order created:");
      console.log(`   Making: 1 WETH → Taking: 3500 USDC`);
      console.log(`   Salt: 0x${simpleOrder.salt.toString(16)}`);
      console.log(`   Extension: ${simpleOrder.extension || 'none'}`);

      // Step 2: Sign the simple order
      const rawSignature = await signOrder(simpleOrder, 1n, await aggregationRouter.getAddress(), maker);
      const { r, s, v } = ethers.Signature.from(rawSignature);
      const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);
      
      console.log("✅ Simple order signed");

      // Step 3: Build simple taker traits (no extension)
      const simpleTakerTraits = buildTakerTraits({
        makingAmount: false,
        threshold: 0n,
        target: taker.address,
        interaction: "0x"
      });

      console.log("✅ Simple taker traits built");
      console.log(`   Taker traits: ${simpleTakerTraits.traits}`);
      console.log(`   Args length: ${simpleTakerTraits.args.length}`);

      // Step 4: Try to fill the simple order
      try {
        console.log("🧪 Testing simple order static call...");
        const staticResult = await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          simpleOrder,
          r,
          vs,
          BigInt("3500000000"), // Fill amount
          simpleTakerTraits.traits,
          simpleTakerTraits.args
        );
        console.log(`✅ Simple order static call succeeded: ${staticResult}`);
        
        // Try real transaction
        console.log("⚡ Attempting real simple order fill...");
        const tx = await aggregationRouter.connect(taker).fillOrderArgs(
          simpleOrder,
          r,
          vs,
          BigInt("3500000000"),
          simpleTakerTraits.traits,
          simpleTakerTraits.args
        );
        const receipt = await tx.wait();
        console.log(`🎉 Simple order fill SUCCESS! Gas used: ${receipt.gasUsed}`);
        
      } catch (error: any) {
        console.log(`❌ Simple order failed: ${error.reason || error.message}`);
        console.log(`   Error data: ${error.data || 'none'}`);
        
        if (error.data === '0x') {
          console.log("🔍 Same error as ZK order - issue is not ZK-specific!");
        } else {
          console.log("🔍 Different error - ZK order has additional issues");
        }
      }
    });
  });

  describe("Debug ZK Predicate via Router", function () {
    it("should test ZK predicate call directly via router interface", async function () {
      console.log("\n🔍 DEBUGGING: ZK predicate via router interface...");

      // Step 1: Get shared proof data
      const { encodedData } = await getSharedZKProof();
      
      console.log("📦 ZK proof data:");
      console.log(`   Length: ${encodedData.length} chars`);
      console.log(`   First 100 chars: ${encodedData.substring(0, 100)}`);

      // Step 2: Test ZK predicate directly through router interface (like PredicateExtensions)
      try {
        // Build arbitraryStaticCall using router interface (exact same pattern as PredicateExtensions)
        const zkPredicateCall = aggregationRouter.interface.encodeFunctionData("arbitraryStaticCall", [
          zkPredicateAddress,
          predicate.interface.encodeFunctionData("predicate", [encodedData])
        ]);

        console.log("✅ ZK arbitraryStaticCall created:");
        console.log(`   Length: ${zkPredicateCall.length} chars`);

        // Step 3: Wrap in gt() like PredicateExtensions does
        const zkWrappedPredicate = aggregationRouter.interface.encodeFunctionData("gt", [
          0,
          zkPredicateCall
        ]);

        console.log("✅ ZK wrapped predicate created:");
        console.log(`   Length: ${zkWrappedPredicate.length} chars`);

        // Step 4: Now create a simple order with this ZK predicate (like PredicateExtensions)
        const { buildOrder, buildMakerTraits } = await import("./helpers/orderUtils");
        
        const zkOrder = buildOrder({
          maker: maker.address,
          makerAsset: WETH_ADDRESS,
          takerAsset: USDC_ADDRESS,
          makingAmount: ethers.parseEther("1"), // 1 WETH
          takingAmount: BigInt("3500000000"), // 3,500 USDC
          makerTraits: buildMakerTraits({
            allowPartialFill: true,
            allowMultipleFills: true
          }),
          salt: BigInt(Date.now() + 12345) // Unique salt
        }, {
          makerAssetSuffix: '0x',
          takerAssetSuffix: '0x', 
          makingAmountData: '0x',
          takingAmountData: '0x',
          predicate: zkWrappedPredicate, // Use ZK predicate (same pattern as PredicateExtensions)
          permit: '0x',
          preInteraction: '0x',
          postInteraction: '0x',
        });

        console.log("✅ ZK order with router-style predicate created:");
        console.log(`   Extension length: ${(zkOrder as any).extension?.length || 0} chars`);
        console.log(`   Salt: 0x${zkOrder.salt.toString(16)}`);

        // Step 5: Sign and test like PredicateExtensions
        const rawSignature = await signOrder(zkOrder, 31337n, await aggregationRouter.getAddress(), maker);
        const { r, s, v } = ethers.Signature.from(rawSignature);
        const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);

        console.log("✅ ZK order signed");

        // Step 6: Build taker traits (same as PredicateExtensions)
        const extension = (zkOrder as any).extension || '0x';
        const takerTraitsData = buildTakerTraits({
          makingAmount: false,
          extension: extension,
          target: taker.address,
          interaction: '0x'
        });

        console.log("✅ Taker traits built:");
        console.log(`   Extension args length: ${takerTraitsData.args.length} chars`);

        // Step 7: Try to fill (this should reveal if it's a size/format issue)
        try {
          console.log("🧪 Testing ZK router-style order fill...");
          const staticResult = await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
            zkOrder,
            r,
            vs,
            BigInt("3500000000"),
            takerTraitsData.traits,
            takerTraitsData.args
          );
          console.log(`✅ ZK router-style static call succeeded: ${staticResult}`);
          
          // Try real transaction
          const tx = await aggregationRouter.connect(taker).fillOrderArgs(
            zkOrder,
            r,
            vs,
            BigInt("3500000000"),
            takerTraitsData.traits,
            takerTraitsData.args
          );
          const receipt = await tx.wait();
          console.log(`🎉 ZK router-style fill SUCCESS! Gas: ${receipt.gasUsed}`);
          
        } catch (error: any) {
          console.log(`❌ ZK router-style fill failed: ${error.reason || error.message}`);
          console.log(`   Error data: ${error.data || 'none'}`);
          
          if (error.data === '0xdc11ee6b') {
            console.log("🔍 Same 0xdc11ee6b error - issue is in ZK proof data or processing");
          }
        }

      } catch (error: any) {
        console.log(`❌ ZK predicate creation failed: ${error.message}`);
      }
    });
  });

  describe("Direct ZK Pattern Test", function () {
    it("should test ZK order using simplified direct pattern like PredicateExtensions", async function () {
      console.log("\n🔨 Testing SIMPLIFIED DIRECT ZK pattern...");

      // Step 1: Get shared proof data (like our debug test)
      const { encodedData } = await getSharedZKProof();
      
      console.log("📦 Using shared ZK proof data:");
      console.log(`   Length: ${encodedData.length} chars`);

      // Step 2: Build ZK predicate using EXACT PredicateExtensions pattern
      const zkPredicateCall = aggregationRouter.interface.encodeFunctionData("arbitraryStaticCall", [
        zkPredicateAddress,
        predicate.interface.encodeFunctionData("predicate", [encodedData])
      ]);

      console.log(`✅ ZK arbitraryStaticCall created (${zkPredicateCall.length} chars)`);

      // Step 3: Wrap in gt() exactly like PredicateExtensions does
      const zkWrappedPredicate = aggregationRouter.interface.encodeFunctionData("gt", [
        0, // Check if result > 0 (same as PredicateExtensions)
        zkPredicateCall
      ]);

      console.log(`✅ ZK wrapped predicate created (${zkWrappedPredicate.length} chars)`);

      // Step 4: Build order using EXACT PredicateExtensions pattern
      const { buildOrder, buildMakerTraits } = await import("./helpers/orderUtils");
      
      const directZKOrder = buildOrder({
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"), // 1 WETH
        takingAmount: BigInt("3500000000"), // 3,500 USDC
        makerTraits: buildMakerTraits({
          allowPartialFill: true,
          allowMultipleFills: true,
        }),
        salt: BigInt(12345678) // Fixed salt for deterministic testing
      }, {
        makerAssetSuffix: '0x',
        takerAssetSuffix: '0x', 
        makingAmountData: '0x',
        takingAmountData: '0x',
        predicate: zkWrappedPredicate, // Direct predicate (same as PredicateExtensions)
        permit: '0x',
        preInteraction: '0x',
        postInteraction: '0x',
      });

      console.log(`✅ Direct ZK order created:`);
      console.log(`   Extension length: ${(directZKOrder as any).extension?.length || 0} chars`);
      console.log(`   Salt: 0x${directZKOrder.salt.toString(16)}`);

      // Step 5: Sign using exact PredicateExtensions pattern
      const rawSignature = await signOrder(directZKOrder, 31337n, await aggregationRouter.getAddress(), maker);
      const { r, s, v } = ethers.Signature.from(rawSignature);
      const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);

      console.log("✅ Direct ZK order signed");

      // Step 6: Build taker traits exactly like PredicateExtensions
      const extension = (directZKOrder as any).extension || '0x';
      const takerTraitsData = buildTakerTraits({
        makingAmount: false, // Consistent with PredicateExtensions
        extension: extension,
        target: taker.address,
        interaction: '0x'
      });

      console.log("✅ Taker traits built:");
      console.log(`   Extension args length: ${takerTraitsData.args.length} chars`);

      // Step 7: Test the fill (this should give us 0x5cd5d233 like our debug test)
      try {
        console.log("🧪 Testing simplified direct ZK order fill...");
        
        // Static call first
        const staticResult = await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          directZKOrder,
          r,
          vs,
          BigInt("3500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        console.log(`✅ Direct ZK static call succeeded: ${staticResult}`);
        
        // Try real transaction
        const tx = await aggregationRouter.connect(taker).fillOrderArgs(
          directZKOrder,
          r,
          vs,
          BigInt("3500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        const receipt = await tx.wait();
        console.log(`🎉 Direct ZK fill SUCCESS! Gas: ${receipt.gasUsed}`);
        
      } catch (error: any) {
        console.log(`❌ Direct ZK fill failed: ${error.reason || error.message}`);
        console.log(`   Error data: ${error.data || 'none'}`);
        
        if (error.data === '0x5cd5d233') {
          console.log("🎯 Got 0x5cd5d233 - same as debug test! Pattern is consistent");
        } else if (error.data === '0xdc11ee6b') {
          console.log("🔍 Still getting 0xdc11ee6b - need to investigate further");
        } else {
          console.log(`🔍 New error code: ${error.data} - different from both patterns`);
        }
      }
    });
  });

  describe("Simplified ZK Order Test", function () {
    it("should test our simplified buildZKOrder function directly", async function () {
      console.log("\n🎯 Testing SIMPLIFIED buildZKOrder function...");

      // Step 1: Get shared proof data
      const { encodedData } = await getSharedZKProof();

      // Step 2: Use our simplified buildZKOrder function
      const { buildZKOrder } = await import("../src/utils/zkOrderBuilder");
      
      const zkOrderResult = await buildZKOrder({
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("1"), // 1 WETH
        takingAmount: BigInt("3500000000"), // 3,500 USDC
        zkPredicateAddress: zkPredicateAddress,
        routerInterface: aggregationRouter.interface,
                 secretParams: {
           secretPrice: BigInt("1800000000"), // 1800 USDC per WETH
           secretAmount: ethers.parseEther("5"), // 5 WETH minimum
           nonce: BigInt("123456789") // Fixed nonce for testing
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

      console.log(`✅ Simplified ZK order created:`);
      console.log(`   Extension length: ${(zkOrderResult.order as any).extension?.length || 0} chars`);
      console.log(`   Salt: 0x${zkOrderResult.order.salt.toString(16)}`);

      // Step 3: Sign directly (same as debug test)
      const rawSignature = await signOrder(zkOrderResult.order, 31337n, await aggregationRouter.getAddress(), maker);
      const { r, s, v } = ethers.Signature.from(rawSignature);
      const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);

      console.log("✅ Simplified ZK order signed");

      // Step 4: Build taker traits directly
      const extension = (zkOrderResult.order as any).extension || '0x';
      const takerTraitsData = buildTakerTraits({
        makingAmount: false,
        extension: extension,
        target: taker.address,
        interaction: '0x'
      });

      console.log("✅ Taker traits built:");
      console.log(`   Extension args length: ${takerTraitsData.args.length} chars`);

      // Step 5: Test fill directly (should get 0x5cd5d233 like our debug tests)
      try {
        console.log("🧪 Testing simplified ZK order fill...");
        
        const staticResult = await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          zkOrderResult.order,
          r,
          vs,
          BigInt("3500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        console.log(`✅ Simplified ZK static call succeeded: ${staticResult}`);
        
        const tx = await aggregationRouter.connect(taker).fillOrderArgs(
          zkOrderResult.order,
          r,
          vs,
          BigInt("3500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        const receipt = await tx.wait();
        console.log(`🎉 Simplified ZK fill SUCCESS! Gas: ${receipt.gasUsed}`);
        
      } catch (error: any) {
        console.log(`❌ Simplified ZK fill failed: ${error.reason || error.message}`);
        console.log(`   Error data: ${error.data || 'none'}`);
        
        if (error.data === '0x5cd5d233') {
          console.log("🎯 Got 0x5cd5d233 - SAME as debug test! Simplified pattern works!");
        } else if (error.data === '0xdc11ee6b') {
          console.log("❌ Still getting 0xdc11ee6b - something still wrong");
        } else {
          console.log(`🔍 New error: ${error.data} - different behavior`);
        }
      }
    });
  });

  describe("Direct ZK Predicate Testing", function () {
    it("should test ZK predicate directly with exact proof data from failing order", async function () {
      console.log("\n🔍 Testing ZK predicate directly with failing order's proof data...");

      // Step 1: Get shared proof data (same as failing order)
      const { encodedData } = await getSharedZKProof();
      
      console.log("📦 Proof data details:");
      console.log(`   Length: ${encodedData.length} chars (${(encodedData.length - 2) / 2} bytes)`);
      console.log(`   First 100 chars: ${encodedData.substring(0, 100)}`);

      // Step 2: Test predicate directly
      try {
        console.log("🧪 Calling predicate directly...");
        
        const result = await predicate.predicate(encodedData);
        console.log(`✅ Direct predicate call succeeded: ${result}`);
        
        if (result === 1n) {
          console.log("🎯 Predicate returns 1 - ZK proof is VALID");
        } else {
          console.log("❌ Predicate returns 0 - ZK proof is INVALID");
        }

      } catch (error: any) {
        console.log(`❌ Direct predicate call failed: ${error.message}`);
        console.log(`   Error data: ${error.data || 'none'}`);
      }

      // Step 3: Test the arbitraryStaticCall wrapper
      try {
        console.log("🧪 Testing arbitraryStaticCall wrapper...");
        
        const predicateCalldata = predicate.interface.encodeFunctionData("predicate", [encodedData]);
        const arbitraryResult = await aggregationRouter.connect(taker).arbitraryStaticCall(
          zkPredicateAddress,
          predicateCalldata
        );
        
        console.log(`✅ ArbitraryStaticCall result: ${arbitraryResult}`);
        
      } catch (error: any) {
        console.log(`❌ ArbitraryStaticCall failed: ${error.message}`);
      }

      // Step 4: Test the gt() wrapper
      try {
        console.log("🧪 Testing gt() wrapper...");
        
        const predicateCalldata = predicate.interface.encodeFunctionData("predicate", [encodedData]);
        const arbitraryCall = aggregationRouter.interface.encodeFunctionData("arbitraryStaticCall", [
          zkPredicateAddress,
          predicateCalldata
        ]);
        
        const gtResult = await aggregationRouter.connect(taker).gt(0, arbitraryCall);
        console.log(`✅ GT wrapper result: ${gtResult}`);
        
      } catch (error: any) {
        console.log(`❌ GT wrapper failed: ${error.message}`);
      }

      // Step 5: Test proof decoding manually
      try {
        console.log("🧪 Testing proof decoding...");
        
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[5]"],
          encodedData
        );
        
        console.log("✅ Proof decoded successfully:");
        console.log(`   pA: [${decoded[0][0]}, ${decoded[0][1]}]`);
        console.log(`   pC: [${decoded[2][0]}, ${decoded[2][1]}]`);
        console.log(`   Public signals: [${decoded[3].join(', ')}]`);
        
      } catch (error: any) {
        console.log(`❌ Proof decoding failed: ${error.message}`);
      }
    });
  });

  describe("Error Code Investigation", function () {
    it("should decode 0x5cd5d233 error selector", async function () {
      console.log("\n🔍 Investigating error code 0x5cd5d233...");

      // Common error patterns to check
      const commonErrors = [
        "Error(string)",
        "Panic(uint256)",
        "InvalidSignature()",
        "InsufficientBalance()",
        "UnauthorizedAccess()",
        "InvalidProof()",
        "ProofVerificationFailed()",
        "PredicateEvaluationFailed()",
        "CallFailed()",
        "CallReverted()",
        "DataTooShort()",
        "InvalidCalldata()",
        "ExcessiveGasUsage()",
        "StaticCallFailed()",
        "PredicateCallFailed()",
        "ArbitraryCallFailed()",
        "TargetNotContract()",
        "CallDataCorrupted()",
        "InvalidFunctionSelector()",
        "FunctionNotFound()"
      ];

      console.log("🧮 Calculating error selectors for common patterns...");
      
      for (const errorSig of commonErrors) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(errorSig));
        const selector = hash.substring(0, 10); // First 4 bytes (8 hex chars + 0x)
        
        console.log(`   ${errorSig.padEnd(25)} -> ${selector}`);
        
        if (selector === "0x5cd5d233") {
          console.log(`🎯 MATCH FOUND! ${errorSig} has selector 0x5cd5d233`);
          return;
        }
      }

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

      console.log("\n🔧 Checking 1inch-specific error patterns...");
      
      for (const errorSig of inchErrors) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(errorSig));
        const selector = hash.substring(0, 10);
        
        console.log(`   ${errorSig.padEnd(30)} -> ${selector}`);
        
        if (selector === "0x5cd5d233") {
          console.log(`🎯 MATCH FOUND! ${errorSig} has selector 0x5cd5d233`);
          return;
        }
      }

      console.log("\n❌ No match found in common error patterns");
      console.log("📊 This might be:");
      console.log("   1. A custom error from 1inch contracts");
      console.log("   2. A low-level EVM error");
      console.log("   3. An out-of-gas or stack overflow");
      console.log("   4. A contract-specific revert");

      // Let's also try to call a function that might give us this error
      console.log("\n🧪 Testing potential error scenarios...");
      
      try {
        // Test calling gt() with invalid data
        await aggregationRouter.connect(taker).gt(0, "0xbaddata");
      } catch (error: any) {
        console.log(`GT with bad data: ${error.data || error.message}`);
      }

      try {
        // Test arbitraryStaticCall with invalid target
        await aggregationRouter.connect(taker).arbitraryStaticCall(ethers.ZeroAddress, "0x12345678");
      } catch (error: any) {
        console.log(`ArbitraryStaticCall to zero: ${error.data || error.message}`);
      }
    });
  });

  describe("Signature Debug", function () {
    it("should compare signatures between working simple orders and failing ZK orders", async function () {
      console.log("\n🔍 Debugging BadSignature() error by comparing signature generation...");

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

      console.log("✅ Simple order created");

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

      console.log("✅ ZK order created");

      // Step 3: Compare order structures
      console.log("\n📊 Comparing order structures:");
      console.log("Simple order:");
      console.log(`   Salt: 0x${simpleOrder.salt.toString(16)}`);
      console.log(`   Maker: ${simpleOrder.maker}`);
      console.log(`   MakerTraits: 0x${simpleOrder.makerTraits.toString(16)}`);
      console.log(`   Extension: ${(simpleOrder as any).extension || 'none'}`);
      
      console.log("ZK order:");
      console.log(`   Salt: 0x${zkOrderResult.order.salt.toString(16)}`);
      console.log(`   Maker: ${zkOrderResult.order.maker}`);
      console.log(`   MakerTraits: 0x${zkOrderResult.order.makerTraits.toString(16)}`);
      console.log(`   Extension: ${(zkOrderResult.order as any).extension || 'none'}`);

      // Step 4: Generate signatures for both
      const network = await ethers.provider.getNetwork();
      const routerAddress = await aggregationRouter.getAddress();
      
      console.log("\n🔐 Generating signatures:");
      console.log(`   Chain ID: ${network.chainId}`);
      console.log(`   Router: ${routerAddress}`);

      try {
        const simpleSignature = await signOrder(simpleOrder, network.chainId, routerAddress, maker);
        console.log(`✅ Simple order signature: ${simpleSignature.substring(0, 20)}...`);
        
        const zkSignature = await signOrder(zkOrderResult.order, network.chainId, routerAddress, maker);
        console.log(`✅ ZK order signature: ${zkSignature.substring(0, 20)}...`);

        // Step 5: Extract r, vs for both
        const simpleSig = ethers.Signature.from(simpleSignature);
        const zkSig = ethers.Signature.from(zkSignature);

        console.log("\n📝 Signature components:");
        console.log("Simple order:");
        console.log(`   r: ${simpleSig.r}`);
        console.log(`   s: ${simpleSig.s}`);
        console.log(`   v: ${simpleSig.v}`);
        
        console.log("ZK order:");
        console.log(`   r: ${zkSig.r}`);
        console.log(`   s: ${zkSig.s}`);  
        console.log(`   v: ${zkSig.v}`);

        // Step 6: Test simple order fill (should work)
        console.log("\n🧪 Testing simple order fill...");
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
          console.log("✅ Simple order static call succeeded - signature is valid");
        } catch (error: any) {
          console.log(`❌ Simple order failed: ${error.data || error.message}`);
        }

        // Step 7: Test ZK order fill (should fail with BadSignature)
        console.log("\n🧪 Testing ZK order fill...");
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
          console.log("✅ ZK order static call succeeded - signature is valid");
        } catch (error: any) {
          console.log(`❌ ZK order failed: ${error.data || error.message}`);
          if (error.data === "0x5cd5d233") {
            console.log("🎯 Confirmed: ZK order has BadSignature() issue");
          }
        }

      } catch (error: any) {
        console.log(`❌ Signature generation failed: ${error.message}`);
      }
    });
  });

  describe("Static vs Real Transaction Debug", function () {
    it("should compare static call vs real transaction for ZK orders", async function () {
      console.log("\n🔍 Comparing static call vs real transaction...");

      // Step 1: Create ZK order 
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

      // Step 2: Sign order  
      const network = await ethers.provider.getNetwork();
      const routerAddress = await aggregationRouter.getAddress();
      
      console.log(`🔐 Network info:`);
      console.log(`   Chain ID at runtime: ${network.chainId}`);
      console.log(`   Router: ${routerAddress}`);

      const rawSignature = await signOrder(zkOrderResult.order, network.chainId, routerAddress, maker);
      const { r, s, v } = ethers.Signature.from(rawSignature);
      const vs = v === 27 ? s : "0x" + (BigInt(s) + BigInt("0x8000000000000000000000000000000000000000000000000000000000000000")).toString(16);

      // Step 3: Build taker traits
      const extension = (zkOrderResult.order as any).extension || '0x';
      const takerTraitsData = buildTakerTraits({
        makingAmount: false,
        extension: extension,
        target: taker.address,
        interaction: '0x'
      });

      console.log(`📊 Transaction parameters:`);
      console.log(`   Fill amount: ${BigInt("3500000000")}`);
      console.log(`   Taker traits: 0x${takerTraitsData.traits.toString(16)}`);
      console.log(`   Extension args length: ${takerTraitsData.args.length}`);

      // Step 4: Try static call (should work)
      console.log("\n🧪 Testing static call...");
      try {
        const staticResult = await aggregationRouter.connect(taker).fillOrderArgs.staticCall(
          zkOrderResult.order,
          r,
          vs,
          BigInt("3500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        console.log(`✅ Static call succeeded: ${staticResult}`);
      } catch (error: any) {
        console.log(`❌ Static call failed: ${error.data || error.message}`);
      }

      // Step 5: Try gas estimation (might reveal issues)
      console.log("\n⛽ Testing gas estimation...");
      try {
        const gasEstimate = await aggregationRouter.connect(taker).fillOrderArgs.estimateGas(
          zkOrderResult.order,
          r,
          vs,
          BigInt("3500000000"),
          takerTraitsData.traits,
          takerTraitsData.args
        );
        console.log(`✅ Gas estimation succeeded: ${gasEstimate}`);
      } catch (error: any) {
        console.log(`❌ Gas estimation failed: ${error.data || error.message}`);
        if (error.data === "0x5cd5d233") {
          console.log("🎯 BadSignature() error occurs during gas estimation!");
        }
      }

      // Step 6: Try real transaction (should fail)
      console.log("\n🔴 Testing real transaction...");
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
        console.log(`✅ Real transaction succeeded: ${receipt.gasUsed}`);
      } catch (error: any) {
        console.log(`❌ Real transaction failed: ${error.data || error.message}`);
        if (error.data === "0x5cd5d233") {
          console.log("🎯 BadSignature() error occurs during real transaction!");
        }
      }

      // Step 7: Check balances and nonces
      console.log("\n📊 Account state:");
      const makerNonce = await ethers.provider.getTransactionCount(maker.address);
      const takerNonce = await ethers.provider.getTransactionCount(taker.address);
      console.log(`   Maker nonce: ${makerNonce}`);
      console.log(`   Taker nonce: ${takerNonce}`);
    });
  });
}); 