import { expect } from "chai";
import { ethers } from "hardhat";
import { Interface } from "ethers";
import { HiddenParamPredicateZK, Groth16Verifier } from "../typechain-types";
import {
  buildZKExtension,
  createZKExtensionWithPredicates,
  buildCombinedExtension,
  createCompleteZKExtension,
  validateZKProofData,
  formatZKExtensionForTakerTraits,
  estimateZKExtensionGas,
  debugZKExtension,
  createArbitraryStaticCall,
  ZK_EXTENSION_CONFIG,
  type ZKExtensionData,
  type CombinedExtensionConfig
} from "../src/utils/zkExtensionBuilder";
import { encodeZKProofData } from "../src/utils/zkProofEncoder";
import * as snarkjs from "snarkjs";
import path from "path";
const { poseidon3 } = require("poseidon-lite");

// Load 1inch ABI
const AggregationRouterV6ABI = require("../abi/AggregationRouterV6.json");

describe("ZK Extension Builder", function () {
  let zkPredicate: HiddenParamPredicateZK;
  let verifier: Groth16Verifier;
  let routerInterface: Interface;
  
  // Circuit paths
  const WASM_PATH = path.join(__dirname, "../circuits/hidden_params_js/hidden_params.wasm");
  const ZKEY_PATH = path.join(__dirname, "../circuits/hidden_params_0001.zkey");

  // Test data for ZK proofs
  const SECRET_PRICE = BigInt('2000');
  const SECRET_AMOUNT = BigInt('10');
  const NONCE = BigInt('123456789');
  const COMMITMENT = poseidon3([SECRET_PRICE, SECRET_AMOUNT, NONCE]);

  const VALID_ZK_SCENARIO = {
    secretPrice: SECRET_PRICE.toString(),
    secretAmount: SECRET_AMOUNT.toString(),
    nonce: NONCE.toString(),
    offeredPrice: '2100',
    offeredAmount: '50',
    commit: COMMITMENT.toString()
  };

  let validZKProofData: string;

  beforeEach(async function () {
    // Deploy contracts
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy() as Groth16Verifier;
    await verifier.waitForDeployment();

    const ZKPredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
    zkPredicate = await ZKPredicateFactory.deploy(await verifier.getAddress()) as HiddenParamPredicateZK;
    await zkPredicate.waitForDeployment();

    // Create router interface
    routerInterface = new Interface(AggregationRouterV6ABI);

    // Generate valid ZK proof data for testing
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      VALID_ZK_SCENARIO,
      WASM_PATH,
      ZKEY_PATH
    );
    const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
    validZKProofData = encodedProof.encodedData;
  });

  describe("Core Extension Building", function () {
    it("should build a basic ZK extension", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      const extension = buildZKExtension(
        routerInterface,
        predicateAddress,
        validZKProofData
      );

      expect(extension.extensionBytes).to.be.a("string");
      expect(extension.extensionBytes).to.match(/^0x[0-9a-fA-F]+$/);
      expect(extension.extensionHash).to.be.a("bigint");
      expect(extension.predicateCall).to.equal(extension.extensionBytes);
      expect(extension.gasEstimate).to.be.greaterThan(0);

      console.log(`✅ Basic ZK extension built successfully`);
      console.log(`   Extension length: ${(extension.extensionBytes.length - 2) / 2} bytes`);
      console.log(`   Extension hash: 0x${extension.extensionHash.toString(16).slice(0, 16)}...`);
      console.log(`   Gas estimate: ${extension.gasEstimate}`);
    });

    it("should create arbitraryStaticCall correctly", function () {
      const targetAddress = "0x1234567890123456789012345678901234567890";
      const calldata = "0xabcdef1234567890";
      
      const staticCall = createArbitraryStaticCall(routerInterface, targetAddress, calldata);
      
      expect(staticCall).to.be.a("string");
      expect(staticCall).to.match(/^0x[0-9a-fA-F]+$/);
      
      // Decode and verify the function call
      const decoded = routerInterface.decodeFunctionData("arbitraryStaticCall", staticCall);
      expect(decoded[0]).to.equal(targetAddress);
      expect(decoded[1]).to.equal(calldata);
      
      console.log(`✅ arbitraryStaticCall encoding working correctly`);
      console.log(`   Target: ${targetAddress}`);
      console.log(`   Calldata: ${calldata}`);
      console.log(`   Encoded length: ${staticCall.length} chars`);
    });

    it("should build extension with correct predicate selector", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      const extension = buildZKExtension(
        routerInterface,
        predicateAddress,
        validZKProofData
      );

      // The extension should contain the predicate function selector
      expect(extension.extensionBytes).to.include(ZK_EXTENSION_CONFIG.PREDICATE_SELECTOR.slice(2));
      
      console.log(`✅ Predicate selector correctly included`);
      console.log(`   Selector: ${ZK_EXTENSION_CONFIG.PREDICATE_SELECTOR}`);
    });
  });

  describe("Input Validation", function () {
    it("should validate ZK proof data format", function () {
      // Valid data
      const validResult = validateZKProofData(validZKProofData);
      expect(validResult.isValid).to.be.true;
      expect(validResult.errors).to.be.empty;
      
      // Invalid: no 0x prefix
      const invalidFormat = validateZKProofData("abcdef123456");
      expect(invalidFormat.isValid).to.be.false;
      expect(invalidFormat.errors).to.have.length.greaterThan(0);
      
      // Invalid: odd length
      const invalidLength = validateZKProofData("0xabcdef123");
      expect(invalidLength.isValid).to.be.false;
      expect(invalidLength.errors).to.have.length.greaterThan(0);
      
      // Invalid: non-hex characters
      const invalidChars = validateZKProofData("0xabcdefghij");
      expect(invalidChars.isValid).to.be.false;
      expect(invalidChars.errors).to.have.length.greaterThan(0);
      
      console.log(`✅ ZK proof data validation working correctly`);
    });

    it("should reject invalid predicate addresses", function () {
      expect(() => {
        buildZKExtension(
          routerInterface,
          "0xinvalid",
          validZKProofData
        );
      }).to.throw("Invalid predicate address");
      
      expect(() => {
        buildZKExtension(
          routerInterface,
          "not-an-address",
          validZKProofData
        );
      }).to.throw("Invalid predicate address");
      
      console.log(`✅ Address validation working correctly`);
    });

    it("should reject invalid ZK proof data", function () {
      const predicateAddress = "0x1234567890123456789012345678901234567890";
      
      expect(() => {
        buildZKExtension(
          routerInterface,
          predicateAddress,
          "0xinvalidproofdata"
        );
      }).to.throw("Invalid ZK proof data");
      
      expect(() => {
        buildZKExtension(
          routerInterface,
          predicateAddress,
          "not-hex-data"
        );
      }).to.throw("Invalid ZK proof data");
      
      console.log(`✅ ZK proof data validation working correctly`);
    });
  });

  describe("Combined Extensions", function () {
    it("should combine multiple ZK extensions", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      // Create two ZK extensions
      const extension1 = buildZKExtension(routerInterface, predicateAddress, validZKProofData);
      const extension2 = buildZKExtension(routerInterface, predicateAddress, validZKProofData);
      
      // Combine them
      const combined = buildCombinedExtension({
        zkExtensions: [extension1, extension2],
        additionalPredicates: [],
        useOrLogic: false
      });
      
      expect(combined.extensionBytes).to.be.a("string");
      expect(combined.extensionHash).to.be.a("bigint");
      expect(combined.gasEstimate).to.be.greaterThan(extension1.gasEstimate);
      
      // Combined extension should be longer than individual extensions
      expect(combined.extensionBytes.length).to.be.greaterThan(extension1.extensionBytes.length);
      
      console.log(`✅ Multiple ZK extensions combined successfully`);
      console.log(`   Individual length: ${extension1.extensionBytes.length} chars`);
      console.log(`   Combined length: ${combined.extensionBytes.length} chars`);
    });

    it("should combine ZK extension with additional predicates", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      // Create a ZK extension
      const zkExtension = buildZKExtension(routerInterface, predicateAddress, validZKProofData);
      
      // Create a dummy additional predicate
      const dummyPredicate = "0x" + "12".repeat(50); // 100 char dummy predicate
      
      // Combine them
      const combined = buildCombinedExtension({
        zkExtensions: [zkExtension],
        additionalPredicates: [dummyPredicate],
        useOrLogic: false
      });
      
      expect(combined.extensionBytes).to.be.a("string");
      expect(combined.extensionHash).to.be.a("bigint");
      expect(combined.gasEstimate).to.be.greaterThan(zkExtension.gasEstimate);
      
      console.log(`✅ ZK extension combined with additional predicates`);
      console.log(`   ZK extension gas: ${zkExtension.gasEstimate}`);
      console.log(`   Combined gas: ${combined.gasEstimate}`);
    });

    it("should handle single predicate without joinStaticCalls", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      const zkExtension = buildZKExtension(routerInterface, predicateAddress, validZKProofData);
      
      // Combine with no additional predicates (should return the same)
      const combined = buildCombinedExtension({
        zkExtensions: [zkExtension],
        additionalPredicates: [],
        useOrLogic: false
      });
      
      expect(combined.extensionBytes).to.equal(zkExtension.extensionBytes);
      expect(combined.extensionHash).to.equal(zkExtension.extensionHash);
      
      console.log(`✅ Single predicate handled correctly without joinStaticCalls`);
    });
  });

  describe("Utility Functions", function () {
    it("should estimate gas correctly", function () {
      const shortProofLength = 500;
      const longProofLength = 1000;
      
      const shortGas = estimateZKExtensionGas(shortProofLength);
      const longGas = estimateZKExtensionGas(longProofLength);
      
      expect(longGas).to.be.greaterThan(shortGas);
      
      // With additional predicates
      const gasWithPredicates = estimateZKExtensionGas(shortProofLength, 2);
      expect(gasWithPredicates).to.be.greaterThan(shortGas);
      
      console.log(`✅ Gas estimation working correctly`);
      console.log(`   Short proof: ${shortGas} gas`);
      console.log(`   Long proof: ${longGas} gas`);
      console.log(`   With 2 additional predicates: ${gasWithPredicates} gas`);
    });

    it("should format extension for taker traits", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      const extension = buildZKExtension(routerInterface, predicateAddress, validZKProofData);
      const formatted = formatZKExtensionForTakerTraits(extension);
      
      expect(formatted).to.have.property('extension');
      expect(formatted).to.have.property('gasEstimate');
      expect(formatted.extension).to.equal(extension.extensionBytes);
      expect(formatted.gasEstimate).to.equal(extension.gasEstimate);
      
      console.log(`✅ Extension formatted for taker traits correctly`);
    });

    it("should provide debug information", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      const extension = buildZKExtension(routerInterface, predicateAddress, validZKProofData);
      const debug = debugZKExtension(extension);
      
      expect(debug).to.have.property('summary');
      expect(debug).to.have.property('details');
      expect(debug.details).to.have.property('extensionLength');
      expect(debug.details).to.have.property('hashHex');
      expect(debug.details).to.have.property('gasEstimate');
      expect(debug.details).to.have.property('calldataBreakdown');
      
      console.log(`✅ Debug information working correctly`);
      console.log(`   ${debug.summary}`);
    });
  });

  describe("Integration with Existing Patterns", function () {
    it("should create complete ZK extension package", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      const complete = createCompleteZKExtension(
        routerInterface,
        predicateAddress,
        validZKProofData
      );
      
      expect(complete).to.have.property('extensionData');
      expect(complete).to.have.property('takerTraitsConfig');
      expect(complete).to.have.property('saltPackingHash');
      
      expect(complete.extensionData.extensionBytes).to.be.a("string");
      expect(complete.takerTraitsConfig.extension).to.equal(complete.extensionData.extensionBytes);
      expect(complete.saltPackingHash).to.equal(complete.extensionData.extensionHash);
      
      console.log(`✅ Complete ZK extension package created successfully`);
      console.log(`   Extension ready for order building`);
      console.log(`   Salt packing hash: 0x${complete.saltPackingHash.toString(16).slice(0, 16)}...`);
    });

    it("should validate-only mode work correctly", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      // Valid data should pass validation
      expect(() => {
        createCompleteZKExtension(
          routerInterface,
          predicateAddress,
          validZKProofData,
          { validateOnly: true }
        );
      }).to.not.throw();
      
      // Invalid data should throw in validation
      expect(() => {
        createCompleteZKExtension(
          routerInterface,
          predicateAddress,
          "0xinvalid",
          { validateOnly: true }
        );
      }).to.throw("ZK proof validation failed");
      
      console.log(`✅ Validate-only mode working correctly`);
    });

    it("should work with existing predicate combinations", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      // Create an existing predicate (dummy)
      const existingPredicate = "0x" + "ff".repeat(40);
      
      const combined = createZKExtensionWithPredicates(
        routerInterface,
        predicateAddress,
        validZKProofData,
        [existingPredicate]
      );
      
      expect(combined.extensionBytes).to.be.a("string");
      expect(combined.extensionBytes.length).to.be.greaterThan(validZKProofData.length);
      
      console.log(`✅ ZK extension combined with existing predicates successfully`);
      console.log(`   Extension includes both ZK and traditional predicates`);
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("should handle empty predicate configurations", function () {
      expect(() => {
        buildCombinedExtension({
          zkExtensions: [],
          additionalPredicates: [],
          useOrLogic: false
        });
      }).to.throw("At least one predicate");
      
      console.log(`✅ Empty predicate configuration properly rejected`);
    });

    it("should warn about OR logic limitation", async function () {
      const predicateAddress = await zkPredicate.getAddress();
      
      const extension1 = buildZKExtension(routerInterface, predicateAddress, validZKProofData);
      const extension2 = buildZKExtension(routerInterface, predicateAddress, validZKProofData);
      
      // Capture console.warn calls
      const originalWarn = console.warn;
      let warnCalled = false;
      console.warn = (message: string) => {
        if (message.includes("OR logic")) {
          warnCalled = true;
        }
      };
      
      buildCombinedExtension({
        zkExtensions: [extension1, extension2],
        additionalPredicates: [],
        useOrLogic: true // This should trigger a warning
      });
      
      console.warn = originalWarn;
      expect(warnCalled).to.be.true;
      
      console.log(`✅ OR logic limitation properly warned about`);
    });

    it("should handle warnings for short proof data", function () {
      const shortProofData = "0x" + "00".repeat(200); // Shorter than expected
      
      const validation = validateZKProofData(shortProofData);
      expect(validation.isValid).to.be.true; // Should still be valid
      expect(validation.warnings).to.have.length.greaterThan(0); // But with warnings
      expect(validation.warnings[0]).to.include("seems short");
      
      console.log(`✅ Short proof data warnings working correctly`);
    });
  });
}); 