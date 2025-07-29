import { expect } from "chai";
import { ethers } from "hardhat";
import { Interface } from "ethers";
import { HiddenParamPredicateZK, Groth16Verifier } from "../typechain-types";
import {
  buildZKOrder,
  createSimpleZKOrder,
  validateZKOrderParams,
  validateZKOrder,
  getZKOrderSummary,
  debugZKOrder,
  type ZKOrderParams,
  type ZKEnabledOrder,
  type ZKOrderBuildResult
} from "../src/utils/zkOrderBuilder";
import { type SecretParameters } from "../src/utils/commitmentUtils";
import { signOrder } from "./helpers/orderUtils";
import { ether } from "./helpers/utils";

// Load 1inch ABI
const AggregationRouterV6ABI = require("../abi/AggregationRouterV6.json");

// Test addresses (using mainnet addresses from existing tests)
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // Correct USDC address
const AGGREGATION_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";

describe("ZK Order Builder", function () {
  let zkPredicate: HiddenParamPredicateZK;
  let verifier: Groth16Verifier;
  let routerInterface: Interface;
  let maker: any;
  let taker: any;

  // Test parameters
  const MAKING_AMOUNT = ether("10"); // 10 WETH
  const TAKING_AMOUNT = BigInt("35000000000"); // 35000 USDC (6 decimals)

  const SECRET_PARAMS: SecretParameters = {
    secretPrice: BigInt("3200000000"), // 3200 USDC minimum (scaled for 6 decimals)
    secretAmount: ether("5"), // 5 WETH minimum
    nonce: BigInt("123456789") // Will be overridden by auto-generation
  };

  beforeEach(async function () {
    // Get signers
    const signers = await ethers.getSigners();
    maker = signers[0];
    taker = signers[1];

    // Deploy contracts
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy() as Groth16Verifier;
    await verifier.waitForDeployment();

    const ZKPredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
    zkPredicate = await ZKPredicateFactory.deploy(await verifier.getAddress()) as HiddenParamPredicateZK;
    await zkPredicate.waitForDeployment();

    // Create router interface
    routerInterface = new Interface(AggregationRouterV6ABI);
  });

  describe("Parameter Validation", function () {
    it("should validate correct ZK order parameters", async function () {
      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const validation = validateZKOrderParams(params);
      expect(validation.isValid).to.be.true;
      expect(validation.errors).to.be.empty;
      expect(validation.gasEstimate).to.be.greaterThan(0);

      console.log(`✅ ZK order parameters validated successfully`);
      console.log(`   Gas estimate: ${validation.gasEstimate}`);
    });

    it("should reject invalid addresses", async function () {
      const params: ZKOrderParams = {
        maker: "0xinvalid",
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const validation = validateZKOrderParams(params);
      expect(validation.isValid).to.be.false;
      expect(validation.errors).to.have.length.greaterThan(0);
      expect(validation.errors[0]).to.include("Invalid maker address");

      console.log(`✅ Invalid addresses properly rejected`);
    });

    it("should reject invalid amounts", async function () {
      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: BigInt(0), // Invalid
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const validation = validateZKOrderParams(params);
      expect(validation.isValid).to.be.false;
      expect(validation.errors.some(e => e.includes("makingAmount"))).to.be.true;

      console.log(`✅ Invalid amounts properly rejected`);
    });

    it("should warn about unrealistic secret parameters", async function () {
      const unrealisticParams: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: {
          ...SECRET_PARAMS,
          secretPrice: BigInt("5000000000"), // Way higher than implied order price
        },
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const validation = validateZKOrderParams(unrealisticParams);
      expect(validation.isValid).to.be.true; // Still valid
      expect(validation.warnings).to.have.length.greaterThan(0);
      expect(validation.warnings[0]).to.include("higher than implied order price");

      console.log(`✅ Unrealistic parameters properly warned about`);
    });
  });

  describe("ZK Order Creation", function () {
    it("should build a complete ZK order", async function () {
      this.timeout(30000);

      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface,
        makerTraits: {
          allowPartialFill: true,
          allowMultipleFills: false
        }
      };

      const result = await buildZKOrder(params);

      // Verify the build result structure
      expect(result).to.have.property('order');
      expect(result).to.have.property('proofData');
      expect(result).to.have.property('validationResult');
      expect(result).to.have.property('debugInfo');

      // Verify the order structure
      expect(result.order.maker).to.equal(maker.address);
      expect(result.order.makerAsset).to.equal(WETH_ADDRESS);
      expect(result.order.takerAsset).to.equal(USDC_ADDRESS);
      expect(result.order.makingAmount).to.equal(MAKING_AMOUNT);
      expect(result.order.takingAmount).to.equal(TAKING_AMOUNT);

      // Verify ZK metadata
      expect(result.order.zkMetadata).to.have.property('commitment');
      expect(result.order.zkMetadata).to.have.property('nonce');
      expect(result.order.zkMetadata).to.have.property('secretParams');
      expect(result.order.zkMetadata).to.have.property('extensionData');
      expect(result.order.zkMetadata).to.have.property('saltData');

      // Verify proof data is valid hex
      expect(result.proofData).to.match(/^0x[0-9a-fA-F]+$/);
      expect(result.proofData.length).to.be.greaterThan(100);

      console.log(`✅ Complete ZK order built successfully`);
      console.log(`   Order: ${result.order.makingAmount} WETH → ${result.order.takingAmount} USDC`);
      console.log(`   Commitment: ${result.debugInfo.commitmentHex.slice(0, 20)}...`);
      console.log(`   Salt: ${result.debugInfo.saltHex.slice(0, 20)}...`);
      console.log(`   Extension: ${result.debugInfo.extensionLength} bytes`);
      console.log(`   Gas estimate: ${result.debugInfo.totalGasEstimate}`);
    });

    it("should use custom configuration", async function () {
      this.timeout(30000);

      const customNonce = BigInt("987654321");
      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface,
        zkConfig: {
          customNonce: customNonce,
          gasLimit: 400000
        }
      };

      const result = await buildZKOrder(params);

      // Verify custom nonce was used
      expect(result.order.zkMetadata.nonce).to.equal(customNonce);

      // Verify custom gas settings affected the estimate
      expect(result.debugInfo.totalGasEstimate).to.be.greaterThanOrEqual(330000);

      console.log(`✅ Custom ZK configuration applied successfully`);
      console.log(`   Custom nonce: ${customNonce}`);
      console.log(`   Gas estimate: ${result.debugInfo.totalGasEstimate}`);
    });

    it("should create simple ZK order with minimal config", async function () {
      this.timeout(30000);

      const basicParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT
      };

      const zkAddresses = {
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const result = await createSimpleZKOrder(basicParams, SECRET_PARAMS, zkAddresses);

      expect(result.order.maker).to.equal(maker.address);
      expect(result.order.zkMetadata.secretParams.secretPrice).to.equal(SECRET_PARAMS.secretPrice);

      console.log(`✅ Simple ZK order creation working`);
    });
  });

  describe("Order Validation", function () {
    it("should validate ZK order consistency", async function () {
      this.timeout(30000);

      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const result = await buildZKOrder(params);
      const validation = validateZKOrder(result.order);

      expect(validation.isValid).to.be.true;
      expect(validation.errors).to.be.empty;
      expect(validation.gasEstimate).to.be.greaterThan(0);

      console.log(`✅ ZK order validation working correctly`);
      console.log(`   Validation passed with ${validation.warnings.length} warnings`);
    });

    it("should detect salt inconsistencies", async function () {
      this.timeout(30000);

      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const result = await buildZKOrder(params);
      
      // Corrupt the salt to test validation
      const corruptedOrder: ZKEnabledOrder = {
        ...result.order,
        salt: BigInt("0x123456789") // Wrong salt
      };

      const validation = validateZKOrder(corruptedOrder);
      expect(validation.isValid).to.be.false;
      expect(validation.errors.some(e => e.includes("Salt"))).to.be.true;

      console.log(`✅ Salt inconsistency detection working`);
    });
  });

  describe("Utility Functions", function () {
    it("should provide comprehensive order summary", async function () {
      this.timeout(30000);

      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const result = await buildZKOrder(params);
      const summary = getZKOrderSummary(result.order);

      expect(summary).to.have.property('commitmentSummary');
      expect(summary).to.have.property('secretThresholds');
      expect(summary).to.have.property('gasEstimate');
      expect(summary).to.have.property('extensionLength');

      expect(summary.commitmentSummary).to.include('Commitment');
      expect(summary.secretThresholds).to.include('Min price');
      expect(summary.gasEstimate).to.be.greaterThan(0);
      expect(summary.extensionLength).to.be.greaterThan(0);

      console.log(`✅ Order summary working correctly`);
      console.log(`   ${summary.commitmentSummary}`);
      console.log(`   ${summary.secretThresholds}`);
    });

    it("should provide detailed debug information", async function () {
      this.timeout(30000);

      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const result = await buildZKOrder(params);
      const debug = debugZKOrder(result.order);

      expect(debug).to.have.property('orderSummary');
      expect(debug).to.have.property('zkSummary');
      expect(debug).to.have.property('saltBreakdown');
      expect(debug).to.have.property('extensionBreakdown');
      expect(debug).to.have.property('validationStatus');

      expect(debug.orderSummary).to.include('ZK Order');
      expect(debug.validationStatus).to.include('✅ Valid');

      console.log(`✅ Debug information working correctly`);
      console.log(`   ${debug.orderSummary}`);
      console.log(`   ${debug.zkSummary}`);
      console.log(`   ${debug.saltBreakdown}`);
      console.log(`   ${debug.extensionBreakdown}`);
      console.log(`   ${debug.validationStatus}`);
    });
  });

  describe("Integration with Existing Patterns", function () {
    it("should integrate with existing order signing", async function () {
      this.timeout(30000);

      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const result = await buildZKOrder(params);

      // Should be able to sign the order using existing patterns
      const network = await ethers.provider.getNetwork();
      const signature = await signOrder(result.order, BigInt(network.chainId), AGGREGATION_ROUTER_V6, maker);

      // Extract signature components like in existing tests
      const sig = ethers.Signature.from(signature);
      const r = sig.r;
      const vs = sig.yParityAndS;

      expect(r).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(vs).to.match(/^0x[0-9a-fA-F]{64}$/);

      console.log(`✅ ZK order signing integration working`);
      console.log(`   Signature r: ${r.slice(0, 20)}...`);
      console.log(`   Signature vs: ${vs.slice(0, 20)}...`);
    });

    it("should maintain standard order structure", async function () {
      this.timeout(30000);

      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      const result = await buildZKOrder(params);

      // ZK order should have all standard OrderStruct fields
      expect(result.order).to.have.property('salt');
      expect(result.order).to.have.property('maker');
      expect(result.order).to.have.property('receiver');
      expect(result.order).to.have.property('makerAsset');
      expect(result.order).to.have.property('takerAsset');
      expect(result.order).to.have.property('makingAmount');
      expect(result.order).to.have.property('takingAmount');
      expect(result.order).to.have.property('makerTraits');

      // ZK metadata should be additional, not replacing standard fields
      expect(result.order.zkMetadata).to.be.an('object');

      console.log(`✅ Standard order structure maintained`);
      console.log(`   All standard fields present + ZK metadata`);
    });

    it("should work with maker traits configuration", async function () {
      this.timeout(30000);

      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface,
        makerTraits: {
          allowPartialFill: false,
          allowMultipleFills: true,
          expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          nonce: BigInt("42"),
          series: BigInt("1")
        }
      };

      const result = await buildZKOrder(params);

      // Verify maker traits were applied (they get encoded into makerTraits field)
      expect(result.order.makerTraits).to.be.a('bigint');

      console.log(`✅ Maker traits configuration working`);
      console.log(`   Maker traits encoded: 0x${result.order.makerTraits.toString(16)}`);
    });
  });

  describe("Error Handling", function () {
    it("should handle proof generation failures gracefully", async function () {
      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: SECRET_PARAMS,
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface,
        zkConfig: {
          wasmPath: "/nonexistent/path.wasm", // Invalid path
          zkeyPath: "/nonexistent/path.zkey"
        }
      };

      await expect(buildZKOrder(params)).to.be.rejected;

      console.log(`✅ Proof generation failure handling working`);
    });

    it("should reject invalid secret parameters", async function () {
      const params: ZKOrderParams = {
        maker: maker.address,
        makerAsset: WETH_ADDRESS,
        takerAsset: USDC_ADDRESS,
        makingAmount: MAKING_AMOUNT,
        takingAmount: TAKING_AMOUNT,
        secretParams: {
          secretPrice: BigInt(0), // Invalid
          secretAmount: BigInt(0), // Invalid
          nonce: BigInt(0)
        },
        zkPredicateAddress: await zkPredicate.getAddress(),
        routerInterface
      };

      expect(() => validateZKOrderParams(params)).to.not.throw();
      const validation = validateZKOrderParams(params);
      expect(validation.isValid).to.be.false;
      expect(validation.errors.some(e => e.includes("secretPrice"))).to.be.true;

      console.log(`✅ Invalid secret parameter rejection working`);
    });
  });
}); 