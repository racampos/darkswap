import { expect } from "chai";
import { ethers } from "hardhat";
import { HiddenParamPredicateZK, Groth16Verifier } from "../typechain-types";
import { encodeZKProofData } from "../src/utils/zkProofEncoder";
import { ZKProof, PublicSignals } from "../src/types/zkTypes";
import * as snarkjs from "snarkjs";
import path from "path";
const { poseidon3 } = require("poseidon-lite");

describe("ZK Predicate Integration - Real Proof Verification", function () {
  let zkPredicate: HiddenParamPredicateZK;
  let verifier: Groth16Verifier;

  // Circuit paths from Chunk 1
  const WASM_PATH = path.join(__dirname, "../circuits/hidden_params_js/hidden_params.wasm");
  const ZKEY_PATH = path.join(__dirname, "../circuits/hidden_params_0001.zkey");

  // Test scenario data
  const SECRET_PRICE = BigInt('2000');
  const SECRET_AMOUNT = BigInt('10');
  const NONCE = BigInt('123456789');
  const COMMITMENT = poseidon3([SECRET_PRICE, SECRET_AMOUNT, NONCE]);

  const VALID_SCENARIO = {
    secretPrice: SECRET_PRICE.toString(),
    secretAmount: SECRET_AMOUNT.toString(),
    nonce: NONCE.toString(),
    offeredPrice: '2100', // >= 2000
    offeredAmount: '50',  // >= 10
    commit: COMMITMENT.toString()
  };

  const INVALID_PRICE_SCENARIO = {
    secretPrice: SECRET_PRICE.toString(),
    secretAmount: SECRET_AMOUNT.toString(),
    nonce: NONCE.toString(),
    offeredPrice: '1500', // < 2000
    offeredAmount: '50',
    commit: COMMITMENT.toString()
  };

  const INVALID_AMOUNT_SCENARIO = {
    secretPrice: SECRET_PRICE.toString(),
    secretAmount: SECRET_AMOUNT.toString(),
    nonce: NONCE.toString(),
    offeredPrice: '2100',
    offeredAmount: '5',   // < 10
    commit: COMMITMENT.toString()
  };

  beforeEach(async function () {
    // Deploy contracts
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy() as Groth16Verifier;
    await verifier.waitForDeployment();

    const ZKPredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
    zkPredicate = await ZKPredicateFactory.deploy(await verifier.getAddress()) as HiddenParamPredicateZK;
    await zkPredicate.waitForDeployment();
  });

  describe("Valid Proof Verification", function () {
    it("should verify valid ZK proof and return success", async function () {
      this.timeout(30000); // ZK proof generation takes time
      
      console.log("Generating valid ZK proof...");
      console.log("Scenario: secretPrice=2000, offeredPrice=2100 (valid constraint)");
      
      // Generate real ZK proof using our Chunk 1 infrastructure
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        VALID_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      console.log("Proof generated successfully");
      console.log("Public signals:", publicSignals);
      
      // Encode proof for contract  
      const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
      
      // Verify on-chain
      const result = await zkPredicate.predicate(encodedProof.encodedData);
      expect(result).to.equal(1, "Valid proof should be accepted");
      
      console.log("On-chain verification: SUCCESS");
    });

    it("should handle multiple valid scenarios correctly", async function () {
      this.timeout(60000);
      
      const scenarios = [
        { name: "Exact threshold", offeredPrice: '2000', offeredAmount: '10' },
        { name: "High excess", offeredPrice: '3000', offeredAmount: '100' },
        { name: "Minimal excess", offeredPrice: '2001', offeredAmount: '11' }
      ];

      for (const scenario of scenarios) {
        console.log(`Testing scenario: ${scenario.name}`);
        
        const inputs = {
          ...VALID_SCENARIO,
          offeredPrice: scenario.offeredPrice,
          offeredAmount: scenario.offeredAmount
        };

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          inputs,
          WASM_PATH,
          ZKEY_PATH
        );

        const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
        const result = await zkPredicate.predicate(encodedProof.encodedData);
        
        expect(result).to.equal(1, `Scenario "${scenario.name}" should succeed`);
        console.log(`${scenario.name}: SUCCESS`);
      }
    });
  });

  describe("Invalid Proof Rejection", function () {
    it("should reject proof with price constraint violation", async function () {
      this.timeout(30000);
      
      console.log("Generating proof with price constraint violation...");
      console.log("Scenario: secretPrice=2000, offeredPrice=1500 (invalid constraint)");
      
      // Generate proof with invalid price constraint
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        INVALID_PRICE_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      console.log("Proof generated (constraint violated in circuit)");
      console.log("Public signals:", publicSignals);
      
      // The circuit should output valid=0 for constraint violation
      expect(publicSignals[0]).to.equal("0", "Circuit should output valid=0 for price violation");
      
      const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
      const result = await zkPredicate.predicate(encodedProof.encodedData);
      
      expect(result).to.equal(0, "Invalid proof should be rejected");
      console.log("On-chain verification: REJECTED (as expected)");
    });

    it("should reject proof with amount constraint violation", async function () {
      this.timeout(30000);
      
      console.log("Generating proof with amount constraint violation...");
      console.log("Scenario: secretAmount=10, offeredAmount=5 (invalid constraint)");
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        INVALID_AMOUNT_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      console.log("Public signals:", publicSignals);
      
      // The circuit should output valid=0 for constraint violation
      expect(publicSignals[0]).to.equal("0", "Circuit should output valid=0 for amount violation");
      
      const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
      const result = await zkPredicate.predicate(encodedProof.encodedData);
      
      expect(result).to.equal(0, "Invalid proof should be rejected");
      console.log("On-chain verification: REJECTED (as expected)");
    });
  });

  describe("Constraint Validation", function () {
    it("should reject proof with zero commitment", async function () {
      this.timeout(30000);
      
      // Generate valid proof but modify public signals to have zero commitment
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        VALID_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      // Corrupt public signals (zero commitment)
      const corruptedSignals = [
        "1",  // valid
        "0",  // commit = 0 (invalid)
        publicSignals[2], // nonce
        publicSignals[3], // offeredPrice
        publicSignals[4]  // offeredAmount
      ];

      const encodedProof = encodeZKProofData(proof as any, corruptedSignals as any);
      const result = await zkPredicate.predicate(encodedProof.encodedData);
      
      expect(result).to.equal(0, "Zero commitment should be rejected");
      console.log("Zero commitment correctly rejected");
    });

    it("should reject proof with zero price/amount", async function () {
      this.timeout(30000);
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        VALID_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      // Test zero price
      const zeroPrice = [
        "1", publicSignals[1], publicSignals[2], "0", publicSignals[4]
      ];
      
      let encodedProof = encodeZKProofData(proof as any, zeroPrice as any);
      let result = await zkPredicate.predicate(encodedProof.encodedData);
      expect(result).to.equal(0, "Zero price should be rejected");

      // Test zero amount
      const zeroAmount = [
        "1", publicSignals[1], publicSignals[2], publicSignals[3], "0"
      ];
      
      encodedProof = encodeZKProofData(proof as any, zeroAmount as any);
      result = await zkPredicate.predicate(encodedProof.encodedData);
      expect(result).to.equal(0, "Zero amount should be rejected");
      
      console.log("Zero price/amount validation working");
    });

    it("should handle large nonce values appropriately", async function () {
      this.timeout(30000);
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        VALID_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      // Test extremely large nonce (beyond uint128 max)
      const largeNonce = (BigInt(2) ** BigInt(129)).toString(); // Larger than uint128.max
      const corruptedSignals = [
        "1", publicSignals[1], largeNonce, publicSignals[3], publicSignals[4]
      ];

      const encodedProof = encodeZKProofData(proof as any, corruptedSignals as any);
      const result = await zkPredicate.predicate(encodedProof.encodedData);
      
      expect(result).to.equal(0, "Extremely large nonce should be rejected");
      console.log("Large nonce validation working");
    });
  });

  describe("Gas Usage and Performance", function () {
    it("should measure gas usage for valid proof verification", async function () {
      this.timeout(30000);
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        VALID_SCENARIO,
        WASM_PATH,
        ZKEY_PATH
      );

      const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
      
      // Estimate gas for predicate call
      const gasEstimate = await zkPredicate.predicate.estimateGas(encodedProof.encodedData);
      console.log(`Gas usage for ZK proof verification: ${gasEstimate.toString()}`);
      
      // Verify the call succeeds
      const result = await zkPredicate.predicate(encodedProof.encodedData);
      expect(result).to.equal(1);
      
      // Gas should be reasonable (less than 500k)
      expect(gasEstimate).to.be.lessThan(500000, "Gas usage should be reasonable");
      console.log("Gas usage within acceptable limits");
    });

    it("should have consistent gas usage across different valid proofs", async function () {
      this.timeout(60000);
      
      const gasUsages: bigint[] = [];
      
      for (let i = 0; i < 3; i++) {
        const inputs = {
          ...VALID_SCENARIO,
          nonce: (BigInt(VALID_SCENARIO.nonce) + BigInt(i)).toString()
        };

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          inputs,
          WASM_PATH,
          ZKEY_PATH
        );

        const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
        const gasEstimate = await zkPredicate.predicate.estimateGas(encodedProof.encodedData);
        gasUsages.push(gasEstimate);
      }

      console.log("Gas usages:", gasUsages.map(g => g.toString()));
      
      // All gas usages should be similar (within 10% variance)
      const avgGas = gasUsages.reduce((a, b) => a + b, 0n) / BigInt(gasUsages.length);
      const maxVariance = avgGas / 10n; // 10% tolerance

      gasUsages.forEach((gas, index) => {
        const diff = gas > avgGas ? gas - avgGas : avgGas - gas;
        expect(diff).to.be.lessThan(maxVariance, `Gas usage ${index} should be consistent`);
      });

      console.log("Gas usage consistency verified");
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("should maintain security with boundary value attacks", async function () {
      this.timeout(30000);
      
      // Test with boundary values
      const boundaryInputs = {
        secretPrice: "1", // Minimum meaningful value
        secretAmount: "1", // Minimum meaningful value
        nonce: "1",
        offeredPrice: "1", // Equal to secret (boundary condition)
        offeredAmount: "1", // Equal to secret (boundary condition)
        commit: poseidon3([BigInt("1"), BigInt("1"), BigInt("1")]).toString()
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        boundaryInputs,
        WASM_PATH,
        ZKEY_PATH
      );

      const encodedProof = encodeZKProofData(proof as any, publicSignals as any);
      const result = await zkPredicate.predicate(encodedProof.encodedData);
      
      expect(result).to.equal(1, "Boundary values should work correctly");
      console.log("Boundary value security verified");
    });
  });
}); 