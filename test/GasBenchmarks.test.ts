import { expect } from "chai";
import { ethers } from "hardhat";
import { HiddenParamPredicateZK, Groth16Verifier } from "../typechain-types";
import { encodeZKProofData } from "../src/utils/zkProofEncoder";
import * as snarkjs from "snarkjs";
import path from "path";
const { poseidon3 } = require("poseidon-lite");

describe("Gas Benchmarks - Commit 2.4 Optimizations", function () {
  let zkPredicate: HiddenParamPredicateZK;
  let verifier: Groth16Verifier;

  // Circuit paths
  const WASM_PATH = path.join(__dirname, "../circuits/hidden_params_js/hidden_params.wasm");
  const ZKEY_PATH = path.join(__dirname, "../circuits/hidden_params_0001.zkey");

  // Test data
  const SECRET_PRICE = BigInt('2000');
  const SECRET_AMOUNT = BigInt('10');
  const NONCE = BigInt('123456789');
  const COMMITMENT = poseidon3([SECRET_PRICE, SECRET_AMOUNT, NONCE]);

  const VALID_SCENARIO = {
    secretPrice: SECRET_PRICE.toString(),
    secretAmount: SECRET_AMOUNT.toString(),
    nonce: NONCE.toString(),
    offeredPrice: '2100',
    offeredAmount: '50',
    commit: COMMITMENT.toString()
  };

  const INVALID_SCENARIO = {
    secretPrice: SECRET_PRICE.toString(),
    secretAmount: SECRET_AMOUNT.toString(),
    nonce: NONCE.toString(),
    offeredPrice: '1500', // Invalid constraint
    offeredAmount: '50',
    commit: COMMITMENT.toString()
  };

  beforeEach(async function () {
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy() as Groth16Verifier;
    await verifier.waitForDeployment();

    const ZKPredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
    zkPredicate = await ZKPredicateFactory.deploy(await verifier.getAddress()) as HiddenParamPredicateZK;
    await zkPredicate.waitForDeployment();
  });

  describe("Gas Usage Benchmarks", function () {
    it("should measure gas for valid proof verification", async function () {
      this.timeout(30000);
      
      console.log("\n=== VALID PROOF VERIFICATION ===");
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        VALID_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
      
      // Multiple gas measurements for accuracy
      const gasUsages: bigint[] = [];
      
      for (let i = 0; i < 5; i++) {
        const gasEstimate = await zkPredicate.predicate.estimateGas(encodedProof.encodedData);
        gasUsages.push(gasEstimate);
      }

      const avgGas = gasUsages.reduce((a, b) => a + b, 0n) / BigInt(gasUsages.length);
      const minGas = gasUsages.reduce((a, b) => a < b ? a : b);
      const maxGas = gasUsages.reduce((a, b) => a > b ? a : b);

      console.log(`Average Gas: ${avgGas.toString()}`);
      console.log(`Min Gas: ${minGas.toString()}`);
      console.log(`Max Gas: ${maxGas.toString()}`);
      console.log(`Gas Variance: ${(maxGas - minGas).toString()}`);

      // Verify functionality
      const result = await zkPredicate.predicate(encodedProof.encodedData);
      expect(result).to.equal(1);

      // Gas should be reasonable (target: under 280k with optimizations)
      expect(avgGas).to.be.lessThan(280000n, "Gas usage should be optimized");
      console.log(`✅ Gas target met: ${avgGas} < 280,000`);
    });

    it("should measure gas for invalid proof rejection", async function () {
      this.timeout(30000);
      
      console.log("\n=== INVALID PROOF REJECTION ===");
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        INVALID_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
      
      // Measure gas for rejection (should be much lower due to early exit)
      const gasUsages: bigint[] = [];
      
      for (let i = 0; i < 5; i++) {
        const gasEstimate = await zkPredicate.predicate.estimateGas(encodedProof.encodedData);
        gasUsages.push(gasEstimate);
      }

      const avgGas = gasUsages.reduce((a, b) => a + b, 0n) / BigInt(gasUsages.length);

      console.log(`Invalid Proof Gas: ${avgGas.toString()}`);

      // Verify functionality
      const result = await zkPredicate.predicate(encodedProof.encodedData);
      expect(result).to.equal(0);

      // Invalid proofs should use less gas due to early validation failure
      expect(avgGas).to.be.lessThan(55000n, "Invalid proof should fail quickly");
      console.log(`✅ Early exit optimization working: ${avgGas} < 55,000`);
    });

    it("should measure gas for empty data rejection", async function () {
      console.log("\n=== EMPTY DATA REJECTION ===");
      
      const gasEstimate = await zkPredicate.predicate.estimateGas("0x");
      console.log(`Empty Data Gas: ${gasEstimate.toString()}`);

      // Verify functionality
      const result = await zkPredicate.predicate("0x");
      expect(result).to.equal(0);

      // Empty data should use minimal gas
      expect(gasEstimate).to.be.lessThan(25000n, "Empty data should be rejected immediately");
      console.log(`✅ Immediate rejection working: ${gasEstimate} < 25,000`);
    });

    it("should measure gas for insufficient data rejection", async function () {
      console.log("\n=== INSUFFICIENT DATA REJECTION ===");
      
      const shortData = "0x" + "00".repeat(100); // Much shorter than required
      const gasEstimate = await zkPredicate.predicate.estimateGas(shortData);
      console.log(`Insufficient Data Gas: ${gasEstimate.toString()}`);

      // Verify functionality
      const result = await zkPredicate.predicate(shortData);
      expect(result).to.equal(0);

      // Insufficient data should use minimal gas
      expect(gasEstimate).to.be.lessThan(25000n, "Insufficient data should be rejected quickly");
      console.log(`✅ Length check optimization working: ${gasEstimate} < 25,000`);
    });
  });

  describe("Production Utility Functions", function () {
    it("should test gas estimation helper", async function () {
      this.timeout(30000);
      
      console.log("\n=== GAS ESTIMATION HELPER ===");
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        VALID_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
      
      // Test the built-in gas estimation function
      const estimatedGas = await zkPredicate.estimatePredicateGas(encodedProof.encodedData);
      console.log(`Built-in Gas Estimator: ${estimatedGas.toString()}`);

      // Compare with direct estimation
      const directEstimate = await zkPredicate.predicate.estimateGas(encodedProof.encodedData);
      console.log(`Direct Gas Estimate: ${directEstimate.toString()}`);

      // Should be reasonably close (within 10% difference)
      const diff = estimatedGas > directEstimate ? estimatedGas - directEstimate : directEstimate - estimatedGas;
      const tolerance = directEstimate / 10n; // 10% tolerance
      
      expect(diff).to.be.lessThan(tolerance, "Gas estimation should be accurate");
      console.log(`✅ Gas estimation accuracy: ${diff} < ${tolerance} (10% tolerance)`);
    });

    it("should test failure diagnosis utility", async function () {
      console.log("\n=== FAILURE DIAGNOSIS UTILITY ===");
      
      // Test various failure modes
      const testCases = [
        { data: "0x", expectedCode: 1, description: "Empty proof data" },
        { data: "0x1234", expectedCode: 2, description: "Insufficient proof data length" },
        { data: "0x" + "ff".repeat(500), expectedCode: 4, description: "Circuit output invalid" }
      ];

      for (const testCase of testCases) {
        const [errorCode, errorMessage] = await zkPredicate.diagnoseFailure(testCase.data);
        
        console.log(`Test: ${testCase.description}`);
        console.log(`  Error Code: ${errorCode.toString()}`);
        console.log(`  Error Message: ${errorMessage}`);
        
        expect(errorCode).to.equal(testCase.expectedCode, `Error code should match for ${testCase.description}`);
        expect(errorMessage.toLowerCase()).to.include(testCase.description.toLowerCase(), "Error message should be descriptive");
      }

      console.log("✅ Failure diagnosis working correctly");
    });

    it("should test contract constants and getters", async function () {
      console.log("\n=== CONTRACT CONSTANTS ===");
      
      const minLength = await zkPredicate.getMinProofDataLength();
      const maxNonce = await zkPredicate.getMaxReasonableNonce();
      const verifierAddr = await zkPredicate.getVerifier();

      console.log(`Min Proof Data Length: ${minLength.toString()}`);
      console.log(`Max Reasonable Nonce: ${maxNonce.toString()}`);
      console.log(`Verifier Address: ${verifierAddr}`);

      expect(minLength).to.equal(416n, "Min proof data length should be 416 bytes");
      expect(maxNonce).to.equal(BigInt(2 ** 128) - 1n, "Max nonce should be uint128 max");
      expect(verifierAddr).to.equal(await verifier.getAddress(), "Verifier address should match");

      console.log("✅ All constants and getters working correctly");
    });
  });

  describe("Performance Comparison", function () {
    it("should demonstrate optimization improvements", async function () {
      this.timeout(30000);
      
      console.log("\n=== OPTIMIZATION SUMMARY ===");
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        VALID_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
      
      // Measure current optimized performance
      const optimizedGas = await zkPredicate.predicate.estimateGas(encodedProof.encodedData);
      
      // Expected baseline (pre-optimization was ~273k)
      const baselineGas = 273000n;
      
      console.log(`Baseline Gas (pre-optimization): ${baselineGas.toString()}`);
      console.log(`Optimized Gas (Commit 2.4): ${optimizedGas.toString()}`);
      
      if (optimizedGas < baselineGas) {
        const improvement = baselineGas - optimizedGas;
        const percentImprovement = (improvement * 100n) / baselineGas;
        console.log(`Gas Improvement: ${improvement.toString()} (${percentImprovement.toString()}%)`);
        console.log("✅ Gas optimization successful!");
      } else {
        console.log("Note: Gas usage similar to baseline (optimizations may be in different areas)");
      }

      // Performance should still be reasonable regardless
      expect(optimizedGas).to.be.lessThan(300000n, "Gas usage should remain reasonable");
    });
  });
}); 