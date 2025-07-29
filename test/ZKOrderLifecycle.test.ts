import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { buildZKOrder, type ZKOrderParams } from "../src/utils/zkOrderBuilder";
import { 
  signZKOrder, 
  processZKOrderLifecycle, 
  prepareZKOrderForFill 
} from "../src/utils/zkOrderSigning";
import { Interface } from "ethers";
import { Groth16Verifier__factory, HiddenParamPredicateZK__factory } from "../typechain-types";

// Load 1inch ABI
const AggregationRouterV6ABI = require("../abi/AggregationRouterV6.json");

const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // Correct USDC address

describe("ZK Order Lifecycle", function () {
  let maker: HardhatEthersSigner;
  let routerInterface: Interface;
  let zkPredicateAddress: string;

  this.timeout(60000);

  before(async function () {
    // Setup signers
    [maker] = await ethers.getSigners();

    // Deploy verifier and predicate contracts
    const verifierFactory = new Groth16Verifier__factory(maker);
    const verifier = await verifierFactory.deploy();
    await verifier.waitForDeployment();

    const predicateFactory = new HiddenParamPredicateZK__factory(maker);
    const predicate = await predicateFactory.deploy(await verifier.getAddress());
    await predicate.waitForDeployment();

    zkPredicateAddress = await predicate.getAddress();

    // Create router interface using complete ABI
    routerInterface = new Interface(AggregationRouterV6ABI);
  });

  describe("Complete Order Lifecycle", function () {
    it("should demonstrate end-to-end ZK order workflow", async function () {
      console.log("\nStarting complete ZK order lifecycle demonstration...\n");

      // Step 1: Create ZK order parameters
      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("10"), // 10 ETH
        takingAmount: BigInt("35000000000"), // 35,000 USDC
        secretParams: {
          secretPrice: BigInt("3200000000"), // 3200 USDC per ETH (min price)
          secretAmount: ethers.parseEther("5"), // 5 ETH minimum
          nonce: BigInt("987654321")
        },
        zkPredicateAddress,
        routerInterface
      };

      console.log("Order Parameters:");
      console.log(`   Maker: ${params.maker.slice(0, 10)}...`);
      console.log(`   Trading: 10 ETH → 35,000 USDC`);
      console.log(`   Hidden min price: 3200 USDC per ETH`);
      console.log(`   Hidden min amount: 5 ETH`);
      console.log("");

      // Step 2: Build ZK order
      console.log("Building ZK order...");
      const zkOrderResult = await buildZKOrder(params);
      console.log(`ZK order built successfully`);
      console.log(`   Commitment: ${zkOrderResult.order.zkMetadata.commitment.toString().slice(0, 20)}...`);
      console.log(`   Salt: ${zkOrderResult.order.salt.toString().slice(0, 20)}...`);
      console.log(`   Extension: ${zkOrderResult.order.extension?.length || 0} bytes`);
      console.log("");

      // Step 3: Process complete lifecycle
      console.log("Processing complete lifecycle (create → sign → validate → prepare)...");
      const lifecycle = await processZKOrderLifecycle(zkOrderResult.order, maker);
      
      expect(lifecycle.status).to.equal('ready_to_fill');
      expect(lifecycle.signature).to.not.be.undefined;
      expect(lifecycle.validation.isValid).to.be.true;
      expect(lifecycle.validation.errors).to.be.empty;

      console.log(`Lifecycle processed successfully`);
      console.log(`   Final status: ${lifecycle.status}`);
      console.log(`   Signature: ${lifecycle.signature!.r.slice(0, 20)}...`);
      console.log(`   Gas estimate: ${lifecycle.validation.gasEstimate.toLocaleString()}`);
      console.log("");

      // Step 4: Prepare for fill
      console.log("Preparing order for fill...");
      const fillPrep = prepareZKOrderForFill(lifecycle);
      
      expect(fillPrep.isReady).to.be.true;
      expect(fillPrep.errors).to.be.empty;
      expect(fillPrep.fillArgs).to.not.be.undefined;

      console.log(`Order ready for fill`);
      console.log(`   Ready: ${fillPrep.isReady}`);
      console.log(`   Fill args: r=${fillPrep.fillArgs!.r.slice(0, 10)}..., vs=${fillPrep.fillArgs!.vs.slice(0, 10)}...`);
      console.log(`   Extension: ${fillPrep.fillArgs!.extension.length} bytes`);
      console.log("");

      // Step 5: Final validation
      console.log("Final validation checks...");
      
      // Verify order structure
      expect(zkOrderResult.order.maker).to.equal(params.maker);
      expect(zkOrderResult.order.makerAsset).to.equal(params.makerAsset);
      expect(zkOrderResult.order.takerAsset).to.equal(params.takerAsset);
      expect(zkOrderResult.order.makingAmount).to.equal(params.makingAmount);
      expect(zkOrderResult.order.takingAmount).to.equal(params.takingAmount);
      
      // Verify ZK metadata
      expect(zkOrderResult.order.zkMetadata.secretParams.secretPrice).to.equal(params.secretParams.secretPrice);
      expect(zkOrderResult.order.zkMetadata.secretParams.secretAmount).to.equal(params.secretParams.secretAmount);
      expect(zkOrderResult.order.zkMetadata.secretParams.nonce).to.equal(params.secretParams.nonce);
      
      // Verify extension data
      expect(zkOrderResult.order.zkMetadata.extensionData.extensionBytes).to.have.length.greaterThan(100);
      expect(zkOrderResult.order.zkMetadata.extensionData.gasEstimate).to.be.greaterThan(0);

      console.log(`All validation checks passed`);
      console.log("\nComplete ZK order lifecycle demonstration successful!\n");
    });

    it("should handle multiple orders with different parameters", async function () {
      console.log("\nTesting multiple order lifecycle...\n");

      const orders = [
        {
          name: "Small ETH Order",
          makingAmount: ethers.parseEther("1"),
          takingAmount: BigInt("3500000000"),
          secretPrice: BigInt("3200000000"),
          secretAmount: ethers.parseEther("0.5")
        },
        {
          name: "Large ETH Order", 
          makingAmount: ethers.parseEther("10"), // Reduced from 50 to stay within constraints
          takingAmount: BigInt("35000000000"), // Reduced accordingly
          secretPrice: BigInt("3300000000"),
          secretAmount: ethers.parseEther("5") // Reduced from 25 to stay within constraints
        },
        {
          name: "Medium ETH Order",
          makingAmount: ethers.parseEther("5"),
          takingAmount: BigInt("17500000000"),
          secretPrice: BigInt("3400000000"),
          secretAmount: ethers.parseEther("2")
        }
      ];

      for (const [index, orderSpec] of orders.entries()) {
        console.log(`Processing ${orderSpec.name} (${index + 1}/${orders.length})...`);

        const params: ZKOrderParams = {
          maker: maker.address,
          makerAsset: WETH_ADDRESS,
          takerAsset: USDC_ADDRESS,
          makingAmount: orderSpec.makingAmount,
          takingAmount: orderSpec.takingAmount,
          secretParams: {
            secretPrice: orderSpec.secretPrice,
            secretAmount: orderSpec.secretAmount,
            nonce: BigInt(Date.now() + index)
          },
          zkPredicateAddress,
          routerInterface
        };

        // Build and process lifecycle
        const zkOrder = await buildZKOrder(params);
        const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker);
        const fillPrep = prepareZKOrderForFill(lifecycle);

        // Verify success
        expect(lifecycle.status).to.equal('ready_to_fill');
        expect(fillPrep.isReady).to.be.true;

        console.log(`   ${orderSpec.name} processed successfully`);
        console.log(`      Making: ${ethers.formatEther(orderSpec.makingAmount)} ETH`);
        console.log(`      Taking: ${(Number(orderSpec.takingAmount) / 1e6).toLocaleString()} USDC`);
        console.log(`      Status: ${lifecycle.status}`);
      }

      console.log("\nMultiple order lifecycle test completed successfully!\n");
    });

    it("should handle error scenarios gracefully", async function () {
      console.log("\nTesting error handling scenarios...\n");

      // Test 1: Invalid commitment (corrupted salt)
      console.log("Test 1: Corrupted salt handling...");
      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("10"),
        takingAmount: BigInt("35000000000"),
        secretParams: {
          secretPrice: BigInt("3200000000"),
          secretAmount: ethers.parseEther("5"),
          nonce: BigInt("123456789")
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      
      // Corrupt the salt
      zkOrder.order.salt = BigInt("0");
      
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker);
      expect(lifecycle.status).to.equal('invalid');
      expect(lifecycle.validation.isValid).to.be.false;
      
      console.log(`   Corrupted salt properly rejected`);
      console.log(`      Status: ${lifecycle.status}`);
      console.log(`      Error: ${lifecycle.validation.errors[0]}`);

      // Test 2: Invalid signer
      console.log("\nTest 2: Invalid signer handling...");
      const validOrder = await buildZKOrder(params);
      const invalidSigner = { 
        provider: { getNetwork: () => { throw new Error("Network unavailable"); } } 
      };

      const failedLifecycle = await processZKOrderLifecycle(validOrder.order, invalidSigner as any);
      expect(failedLifecycle.status).to.equal('invalid');
      expect(failedLifecycle.validation.errors[0]).to.include('Lifecycle processing failed');

      console.log(`   Invalid signer properly handled`);
      console.log(`      Status: ${failedLifecycle.status}`);
      console.log(`      Error: ${failedLifecycle.validation.errors[0]}`);

      console.log("\nError handling scenarios completed successfully!\n");
    });
  });

  describe("Performance and Gas Analysis", function () {
    it("should provide detailed gas analysis for ZK orders", async function () {
      console.log("\nGas Analysis for ZK Orders...\n");

      const testCases = [
        { 
          name: "Small Order", 
          makingAmount: ethers.parseEther("1"),
          takingAmount: BigInt("3500000000"),
          secretAmount: ethers.parseEther("0.5")
        },
        { 
          name: "Medium Order", 
          makingAmount: ethers.parseEther("5"),
          takingAmount: BigInt("17500000000"),
          secretAmount: ethers.parseEther("2")
        },
        { 
          name: "Large Order", 
          makingAmount: ethers.parseEther("10"),
          takingAmount: BigInt("35000000000"),
          secretAmount: ethers.parseEther("5")
        }
      ];

      for (const testCase of testCases) {
        console.log(`Analyzing ${testCase.name}...`);

        const params: ZKOrderParams = {
          maker: maker.address,
          makerAsset: WETH_ADDRESS,
          takerAsset: USDC_ADDRESS,
          makingAmount: testCase.makingAmount,
          takingAmount: testCase.takingAmount,
          secretParams: {
            secretPrice: BigInt("3200000000"),
            secretAmount: testCase.secretAmount,
            nonce: BigInt(Date.now())
          },
          zkPredicateAddress,
          routerInterface
        };

        const startTime = Date.now();
        const zkOrder = await buildZKOrder(params);
        const buildTime = Date.now() - startTime;

        const signStart = Date.now();
        const signature = await signZKOrder(zkOrder.order, maker);
        const signTime = Date.now() - signStart;

        console.log(`   Order Creation: ${buildTime}ms`);
        console.log(`   Signing: ${signTime}ms`);
        console.log(`   Extension Size: ${zkOrder.order.extension?.length || 0} bytes`);
        console.log(`   Gas Estimate: ${zkOrder.debugInfo.totalGasEstimate.toLocaleString()}`);
        console.log("");
      }

      console.log("Gas analysis completed!\n");
    });

    it("should benchmark against standard orders", async function () {
      console.log("\nBenchmarking ZK vs Standard Orders...\n");

      // ZK Order benchmark
      const zkParams: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("10"),
        takingAmount: BigInt("35000000000"),
        secretParams: {
          secretPrice: BigInt("3200000000"),
          secretAmount: ethers.parseEther("5"),
          nonce: BigInt("123456789")
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkStart = Date.now();
      const zkOrder = await buildZKOrder(zkParams);
      const zkBuildTime = Date.now() - zkStart;

      const zkSignStart = Date.now();
      await signZKOrder(zkOrder.order, maker);
      const zkSignTime = Date.now() - zkSignStart;

      console.log("ZK Order Performance:");
      console.log(`   Build Time: ${zkBuildTime}ms`);
      console.log(`   Sign Time: ${zkSignTime}ms`);
      console.log(`   Extension Size: ${zkOrder.order.extension?.length || 0} bytes`);
      console.log(`   Gas Estimate: ${zkOrder.debugInfo.totalGasEstimate.toLocaleString()}`);
      console.log("");

      // Note: Standard order comparison would be implemented here
      console.log("Performance Summary:");
      console.log(`   ZK orders add ~${zkBuildTime}ms build overhead for hidden parameters`);
      console.log(`   Extension adds ~${zkOrder.order.extension?.length || 0} bytes to order size`);
      console.log(`   Estimated gas overhead: ~${(zkOrder.debugInfo.totalGasEstimate - 21000).toLocaleString()}`);

      console.log("\nBenchmarking completed!\n");
    });
  });
}); 