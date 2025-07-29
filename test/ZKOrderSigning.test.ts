import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  signZKOrder, 
  createZKOrderLifecycle, 
  processZKOrderLifecycle,
  validateZKOrderSignature,
  prepareZKOrderForFill,
  estimateZKOrderGas,
  type ZKOrderSignature,
  type ZKOrderLifecycle 
} from "../src/utils/zkOrderSigning";
import { buildZKOrder, type ZKOrderParams } from "../src/utils/zkOrderBuilder";
import { Interface } from "ethers";
import { Groth16Verifier__factory, HiddenParamPredicateZK__factory } from "../typechain-types";

// Load 1inch ABI
const AggregationRouterV6ABI = require("../abi/AggregationRouterV6.json");

const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

describe("ZK Order Signing", function () {
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

  describe("Basic Signing Functionality", function () {
    it("should sign a ZK order successfully", async function () {
      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: ethers.parseEther("10"),
        takingAmount: BigInt("35000000000"), // 35k USDC
        secretParams: {
          secretPrice: BigInt("3200000000"), // 3200 USDC per ETH (min price)
          secretAmount: ethers.parseEther("5"), // 5 ETH minimum
          nonce: BigInt("123456789")
        },
        zkPredicateAddress,
        routerInterface
      };

      const zkOrder = await buildZKOrder(params);
      const signature = await signZKOrder(zkOrder.order, maker);

      expect(signature.r).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(signature.vs).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(signature.signature).to.be.a('string');
      expect(signature.signature.length).to.be.greaterThan(100);

      console.log("ZK order signed successfully");
      console.log(`   Signature r: ${signature.r.slice(0, 20)}...`);
      console.log(`   Signature vs: ${signature.vs.slice(0, 20)}...`);
    });

    it("should reject signing invalid ZK orders", async function () {
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
      
      // Corrupt the order to make it invalid
      zkOrder.order.salt = BigInt("0");

      await expect(signZKOrder(zkOrder.order, maker))
        .to.be.rejectedWith(/Cannot sign invalid ZK order/);

      console.log("Invalid ZK order signing properly rejected");
    });

    it("should validate ZK order signatures", async function () {
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
      const signature = await signZKOrder(zkOrder.order, maker);

      const isValid = await validateZKOrderSignature(zkOrder.order, signature);
      expect(isValid).to.be.true;

      // Test invalid signature
      const invalidSignature: ZKOrderSignature = {
        r: "0x" + "0".repeat(64),
        vs: "0x" + "1".repeat(64),
        signature: "invalid"
      };

      const isInvalid = await validateZKOrderSignature(zkOrder.order, invalidSignature);
      expect(isInvalid).to.be.false;

      console.log("ZK order signature validation working");
    });
  });

  describe("Lifecycle Management", function () {
    it("should create ZK order lifecycle objects", async function () {
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
      const lifecycle = createZKOrderLifecycle(zkOrder.order);

      expect(lifecycle.order).to.deep.equal(zkOrder.order);
      expect(lifecycle.signature).to.be.undefined;
      expect(lifecycle.validation.isValid).to.be.true;
      expect(lifecycle.status).to.equal('created');

      console.log("ZK order lifecycle created successfully");
      console.log(`   Status: ${lifecycle.status}`);
      console.log(`   Valid: ${lifecycle.validation.isValid}`);
      console.log(`   Gas estimate: ${lifecycle.validation.gasEstimate}`);
    });

    it("should process complete ZK order lifecycle", async function () {
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
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker);

      expect(lifecycle.status).to.equal('ready_to_fill');
      expect(lifecycle.signature).to.not.be.undefined;
      expect(lifecycle.validation.isValid).to.be.true;
      expect(lifecycle.validation.errors).to.be.empty;

      console.log("Complete ZK order lifecycle processed");
      console.log(`   Final status: ${lifecycle.status}`);
      console.log(`   Signature present: ${!!lifecycle.signature}`);
      console.log(`   Validation errors: ${lifecycle.validation.errors.length}`);
    });

    it("should handle lifecycle processing errors gracefully", async function () {
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
      
      // Create an invalid signer to trigger an error
      const invalidSigner = { 
        provider: { getNetwork: () => { throw new Error("Network error"); } } 
      };

      const lifecycle = await processZKOrderLifecycle(zkOrder.order, invalidSigner as any);

      expect(lifecycle.status).to.equal('invalid');
      expect(lifecycle.validation.isValid).to.be.false;
      expect(lifecycle.validation.errors.length).to.be.greaterThan(0);
      expect(lifecycle.validation.errors[0]).to.include('Lifecycle processing failed');

      console.log("Lifecycle error handling working");
      console.log(`   Status: ${lifecycle.status}`);
      console.log(`   Error: ${lifecycle.validation.errors[0]}`);
    });
  });

  describe("Fill Preparation", function () {
    it("should prepare ZK order for filling", async function () {
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
      const lifecycle = await processZKOrderLifecycle(zkOrder.order, maker);
      const fillPrep = prepareZKOrderForFill(lifecycle);

      expect(fillPrep.isReady).to.be.true;
      expect(fillPrep.errors).to.be.empty;
      expect(fillPrep.fillArgs).to.not.be.undefined;
      expect(fillPrep.fillArgs!.r).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(fillPrep.fillArgs!.vs).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(fillPrep.fillArgs!.extension).to.match(/^0x[0-9a-fA-F]/);

      console.log("ZK order prepared for filling");
      console.log(`   Ready: ${fillPrep.isReady}`);
      console.log(`   Extension length: ${fillPrep.fillArgs!.extension.length}`);
    });

    it("should handle unready orders in fill preparation", async function () {
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
      const lifecycle = createZKOrderLifecycle(zkOrder.order); // No signature
      const fillPrep = prepareZKOrderForFill(lifecycle);

      expect(fillPrep.isReady).to.be.false;
      expect(fillPrep.errors.length).to.be.greaterThan(0);
      expect(fillPrep.errors[0]).to.equal('Order is not ready for fill');
      expect(fillPrep.fillArgs).to.be.undefined;

      console.log("Unready order handling working");
      console.log(`   Ready: ${fillPrep.isReady}`);
      console.log(`   Error: ${fillPrep.errors[0]}`);
    });
  });

  describe("Gas Estimation", function () {
    it("should estimate gas for ZK order operations", async function () {
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
      const gasEstimate = estimateZKOrderGas(zkOrder.order);

      expect(gasEstimate.orderCreation).to.be.greaterThan(0);
      expect(gasEstimate.signing).to.equal(5000);
      expect(gasEstimate.validation).to.equal(10000);
      expect(gasEstimate.total).to.be.greaterThan(gasEstimate.orderCreation + gasEstimate.signing + gasEstimate.validation);

      console.log("ZK order gas estimation working");
      console.log(`   Order creation: ${gasEstimate.orderCreation.toLocaleString()} gas`);
      console.log(`   Signing: ${gasEstimate.signing.toLocaleString()} gas`);
      console.log(`   Validation: ${gasEstimate.validation.toLocaleString()} gas`);
      console.log(`   Total: ${gasEstimate.total.toLocaleString()} gas`);
    });
  });

  describe("Configuration Options", function () {
    it("should handle custom signing configuration", async function () {
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
      const network = await ethers.provider.getNetwork();
      
      const signature = await signZKOrder(zkOrder.order, maker, {
        chainId: BigInt(network.chainId),
        verifyingContract: AGGREGATION_ROUTER_V6,
        validateAfterSigning: true
      });

      expect(signature.r).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(signature.vs).to.match(/^0x[0-9a-fA-F]{64}$/);

      console.log("Custom signing configuration working");
      console.log(`   Chain ID: ${network.chainId}`);
      console.log(`   Verifying contract: ${AGGREGATION_ROUTER_V6.slice(0, 10)}...`);
    });

    it("should skip validation when configured", async function () {
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
      
      // Corrupt the order
      zkOrder.order.salt = BigInt("0");

      // Should succeed because validation is disabled
      const signature = await signZKOrder(zkOrder.order, maker, {
        validateAfterSigning: false
      });

      expect(signature.r).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(signature.vs).to.match(/^0x[0-9a-fA-F]{64}$/);

      console.log("Validation skipping working");
    });
  });
}); 