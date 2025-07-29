import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { calculateCommitment } from "../src/utils/commitmentUtils";
import { generateProof } from "../src/utils/proofGenerator";
import { encodeZKProofData } from "../src/utils/zkProofEncoder";
import path from "path";

describe("Direct ZK Proof Verification", function () {
  let deployer: HardhatEthersSigner;
  let groth16Verifier: any;
  let hiddenParamPredicate: any;

  const SECRET_PRICE = 1800000000n; // $1800 in 6 decimals
  const SECRET_AMOUNT = 500000000000000000n; // 0.5 ETH in wei
  const NONCE = 12345n;
  const OFFERED_PRICE = 1900000000n; // $1900 in 6 decimals (higher than secret)
  const OFFERED_AMOUNT = 600000000000000000n; // 0.6 ETH in wei (higher than secret)

  // Proof generation configuration
  const PROOF_CONFIG = {
    wasmPath: path.join(__dirname, "../circuits/hidden_params_js/hidden_params.wasm"),
    zkeyPath: path.join(__dirname, "../circuits/hidden_params_0001.zkey"),
    enableLogging: true
  };

  before(async function () {
    [deployer] = await ethers.getSigners();
    
    console.log("Deploying ZK verification contracts...");
    
    // Deploy Groth16Verifier
    const Groth16VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    groth16Verifier = await Groth16VerifierFactory.deploy();
    await groth16Verifier.waitForDeployment();
    console.log(`Groth16Verifier deployed at: ${await groth16Verifier.getAddress()}`);

    // Deploy HiddenParamPredicateZK
    const HiddenParamPredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
    hiddenParamPredicate = await HiddenParamPredicateFactory.deploy(await groth16Verifier.getAddress());
    await hiddenParamPredicate.waitForDeployment();
    console.log(`HiddenParamPredicateZK deployed at: ${await hiddenParamPredicate.getAddress()}`);
  });

  describe("Basic Proof Generation", function () {
    it("should generate a valid ZK proof for valid parameters", async function () {
      console.log("\nTesting proof generation...");
      
      // Calculate commitment using our utility
      const commitment = calculateCommitment(SECRET_PRICE, SECRET_AMOUNT, NONCE);
      console.log(`Calculated commitment: ${commitment}`);

      // Generate proof
      const proofInputs = {
        secretPrice: SECRET_PRICE.toString(),
        secretAmount: SECRET_AMOUNT.toString(),
        nonce: NONCE.toString(),
        offeredPrice: OFFERED_PRICE.toString(),
        offeredAmount: OFFERED_AMOUNT.toString(),
        commit: commitment.toString()
      };

      console.log(`Generating proof with inputs:`, {
        secretPrice: proofInputs.secretPrice,
        secretAmount: proofInputs.secretAmount,
        nonce: proofInputs.nonce,
        offeredPrice: proofInputs.offeredPrice,
        offeredAmount: proofInputs.offeredAmount,
        commit: proofInputs.commit
      });

      const { proof, publicSignals } = await generateProof(proofInputs, PROOF_CONFIG);
      
      expect(proof).to.not.be.undefined;
      expect(publicSignals).to.not.be.undefined;
      expect(publicSignals.length).to.be.greaterThan(0);
      
      console.log(`Proof generated successfully`);
      console.log(`Public signals: [${publicSignals.join(', ')}]`);
    });
  });

  describe("Direct Contract Verification", function () {
    it("should verify a valid proof directly through the contract", async function () {
      console.log("\nTesting direct contract verification...");
      
      // Step 1: Generate commitment and proof
      const commitment = calculateCommitment(SECRET_PRICE, SECRET_AMOUNT, NONCE);
      console.log(`Commitment: ${commitment}`);

      const proofInputs = {
        secretPrice: SECRET_PRICE.toString(),
        secretAmount: SECRET_AMOUNT.toString(),
        nonce: NONCE.toString(),
        offeredPrice: OFFERED_PRICE.toString(),
        offeredAmount: OFFERED_AMOUNT.toString(),
        commit: commitment.toString()
      };

      const { proof, publicSignals } = await generateProof(proofInputs, PROOF_CONFIG);
      console.log(`Proof generated with ${publicSignals.length} public signals`);

      // Step 2: Encode proof for contract
      const encodedProof = encodeZKProofData(proof, publicSignals);
      console.log(`Encoded proof length: ${encodedProof.encodedData.length} characters`);

      // Step 3: Call predicate contract directly
      console.log(`Calling predicate contract with encoded proof...`);
      
      try {
        const result = await hiddenParamPredicate.predicate(encodedProof.encodedData);
        console.log(`Predicate result: ${result}`);
        expect(result).to.equal(1, "Valid proof should return 1");
      } catch (error: any) {
        console.error(`Predicate call failed:`, error.message);
        if (error.data) {
          console.error(`Error data: ${error.data}`);
        }
        throw error;
      }
    });

    it("should reject an invalid proof", async function () {
      console.log("\n🚫 Testing invalid proof rejection...");
      
      // Generate a valid proof first
      const commitment = calculateCommitment(SECRET_PRICE, SECRET_AMOUNT, NONCE);
      
      const validProofInputs = {
        secretPrice: SECRET_PRICE.toString(),
        secretAmount: SECRET_AMOUNT.toString(),
        nonce: NONCE.toString(),
        offeredPrice: OFFERED_PRICE.toString(),
        offeredAmount: OFFERED_AMOUNT.toString(),
        commit: commitment.toString()
      };

      console.log(`Generating valid proof to corrupt...`);
      const { proof, publicSignals } = await generateProof(validProofInputs, PROOF_CONFIG);
      const encodedProof = encodeZKProofData(proof, publicSignals);

      // Corrupt the encoded data to make verification fail
      const corruptedData = encodedProof.encodedData.slice(0, -10) + "0000000000";
      console.log(`Calling predicate with corrupted proof data...`);
      
      const result = await hiddenParamPredicate.predicate(corruptedData);
      console.log(`Corrupted proof result: ${result}`);
      expect(result).to.equal(0, "Corrupted proof should return 0");
    });
  });

  describe("Groth16 Verifier Direct Test", function () {
    it("should verify proof using Groth16Verifier directly", async function () {
      console.log("\nTesting Groth16Verifier directly...");
      
      // Generate proof
      const commitment = calculateCommitment(SECRET_PRICE, SECRET_AMOUNT, NONCE);
      const proofInputs = {
        secretPrice: SECRET_PRICE.toString(),
        secretAmount: SECRET_AMOUNT.toString(),
        nonce: NONCE.toString(),
        offeredPrice: OFFERED_PRICE.toString(),
        offeredAmount: OFFERED_AMOUNT.toString(),
        commit: commitment.toString()
      };

      const { proof, publicSignals } = await generateProof(proofInputs, PROOF_CONFIG);
      console.log(`Generated proof for direct verifier test`);
      console.log(`Public signals: [${publicSignals.join(', ')}]`);

      // Manually construct verifier inputs to match what our circuit expects
      try {
        // Extract proof components
        const pi_a = [proof.pi_a[0], proof.pi_a[1]];
        const pi_b = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]]; // Swap coordinates for G2
        const pi_c = [proof.pi_c[0], proof.pi_c[1]];

        console.log(`Calling verifier with:`);
        console.log(`   pi_a: [${pi_a.join(', ')}]`);
        console.log(`   pi_b: [[${pi_b[0].join(', ')}], [${pi_b[1].join(', ')}]]`);
        console.log(`   pi_c: [${pi_c.join(', ')}]`);
        console.log(`   publicSignals: [${publicSignals.join(', ')}]`);

        const isValid = await groth16Verifier.verifyProof(pi_a, pi_b, pi_c, publicSignals);
        console.log(`Groth16 verification result: ${isValid}`);
        expect(isValid).to.be.true;
      } catch (error: any) {
        console.error(`Groth16 verification failed:`, error.message);
        if (error.data) {
          console.error(`Error data: ${error.data}`);
        }
        throw error;
      }
    });
  });

  describe("Parameter Validation", function () {
    it("should fail when commitment doesn't match secret parameters", async function () {
      console.log("\nTesting commitment validation...");
      
      // Use a wrong commitment
      const wrongCommitment = calculateCommitment(SECRET_PRICE + 1n, SECRET_AMOUNT, NONCE);
      
      const proofInputs = {
        secretPrice: SECRET_PRICE.toString(),
        secretAmount: SECRET_AMOUNT.toString(),
        nonce: NONCE.toString(),
        offeredPrice: OFFERED_PRICE.toString(),
        offeredAmount: OFFERED_AMOUNT.toString(),
        commit: wrongCommitment.toString() // Wrong commitment!
      };

      console.log(`Attempting proof generation with mismatched commitment...`);
      
      try {
        await generateProof(proofInputs, PROOF_CONFIG);
        expect.fail("Should have failed with commitment mismatch");
      } catch (error: any) {
        console.log(`Correctly rejected mismatched commitment: ${error.message}`);
        expect(error.message).to.include("Commitment mismatch");
      }
    });
  });
}); 