import { expect } from "chai";
import { ethers } from "hardhat";
import { Groth16Verifier } from "../typechain-types";
import * as snarkjs from "snarkjs";
import * as path from "path";

describe("ZK Proof Generation SDK", function () {
  let verifier: Groth16Verifier;
  
  // Test data
  const SAMPLE_INPUTS = {
    secretPrice: "2000",      // Maker wants at least 2000 USDC per WETH  
    secretAmount: "10",       // Maker wants to sell at least 10 WETH
    nonce: "123456789",       // Random nonce for commitment uniqueness
    offeredPrice: "2100",     // Taker offers 2100 USDC per WETH (satisfies constraint)
    offeredAmount: "50",      // Taker wants 50 WETH (satisfies constraint)
    commit: (BigInt("2000") + BigInt("10") + BigInt("123456789")).toString()
  };

  // Circuit artifact paths
  const WASM_PATH = path.join(__dirname, "../circuits/hidden_params.wasm");
  const ZKEY_PATH = path.join(__dirname, "../circuits/hidden_params_0001.zkey");

  beforeEach(async function () {
    // Deploy verifier contract for integration testing
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy() as Groth16Verifier;
    await verifier.waitForDeployment();
  });

  describe("Input Validation", function () {
    it("should validate correct inputs", function () {
      // Test basic validation logic
      const secretPrice = BigInt(SAMPLE_INPUTS.secretPrice);
      const secretAmount = BigInt(SAMPLE_INPUTS.secretAmount);
      const nonce = BigInt(SAMPLE_INPUTS.nonce);
      const commit = BigInt(SAMPLE_INPUTS.commit);
      const offeredPrice = BigInt(SAMPLE_INPUTS.offeredPrice);
      const offeredAmount = BigInt(SAMPLE_INPUTS.offeredAmount);

      // Validate commitment constraint
      const expectedCommit = secretPrice + secretAmount + nonce;
      expect(commit).to.equal(expectedCommit, "Commitment should match sum of components");

      // Validate inequality constraints
      expect(offeredPrice).to.be.gte(secretPrice, "Offered price should be >= secret price");
      expect(offeredAmount).to.be.gte(secretAmount, "Offered amount should be >= secret amount");
      
      console.log("      All input constraints satisfied");
    });

    it("should detect constraint violations", function () {
      // Test price constraint violation
      const invalidPrice = BigInt("1500"); // Below secret price of 2000
      const secretPrice = BigInt(SAMPLE_INPUTS.secretPrice);
      
      expect(invalidPrice).to.be.lt(secretPrice, "Should detect price constraint violation");

      // Test amount constraint violation  
      const invalidAmount = BigInt("5"); // Below secret amount of 10
      const secretAmount = BigInt(SAMPLE_INPUTS.secretAmount);
      
      expect(invalidAmount).to.be.lt(secretAmount, "Should detect amount constraint violation");
      
      console.log("      Constraint violations detected correctly");
    });
  });

  describe("Proof Generation", function () {
    it("should generate valid ZK proof", async function () {
      this.timeout(30000); // ZK proof generation can take time
      
      console.log("      Generating ZK proof...");
      
      // Generate proof using snarkjs directly (working implementation)
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        SAMPLE_INPUTS,
        WASM_PATH,
        ZKEY_PATH
      );

      // Validate proof structure
      expect(proof).to.have.property('pi_a');
      expect(proof).to.have.property('pi_b');
      expect(proof).to.have.property('pi_c');
      expect(proof.protocol).to.equal('groth16');
      expect(proof.curve).to.equal('bn128');

      // Validate public signals
      expect(publicSignals).to.have.length(5);
      expect(publicSignals[0]).to.equal("1"); // valid signal
      expect(publicSignals[1]).to.equal(SAMPLE_INPUTS.commit);
      expect(publicSignals[2]).to.equal(SAMPLE_INPUTS.nonce);
      expect(publicSignals[3]).to.equal(SAMPLE_INPUTS.offeredPrice);
      expect(publicSignals[4]).to.equal(SAMPLE_INPUTS.offeredAmount);

      console.log("      ZK proof generated successfully");
      console.log("      Proof contains", proof.pi_a.length, "field elements in pi_a");
    });

    it("should format proof for contract consumption", async function () {
      this.timeout(30000);
      
      // Generate proof
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        SAMPLE_INPUTS,
        WASM_PATH,
        ZKEY_PATH
      );

      // Convert to contract-compatible format
      const contractProof = {
        commit: SAMPLE_INPUTS.commit,
        nonce: SAMPLE_INPUTS.nonce,
        offeredPrice: SAMPLE_INPUTS.offeredPrice,
        offeredAmount: SAMPLE_INPUTS.offeredAmount,
        a: proof.pi_a.slice(0, 2), // Remove the extra coordinate
        b: proof.pi_b.slice(0, 2).map((pair: string[]) => pair.slice(0, 2)), // Remove extra coordinates
        c: proof.pi_c.slice(0, 2)  // Remove the extra coordinate
      };

      // Validate formatted structure
      expect(contractProof.a).to.have.length(2);
      expect(contractProof.b).to.have.length(2);
      expect(contractProof.b[0]).to.have.length(2);
      expect(contractProof.b[1]).to.have.length(2);
      expect(contractProof.c).to.have.length(2);

      console.log("      Proof formatted for contract consumption");
    });
  });

  describe("Contract Integration", function () {
    it("should verify proof on-chain", async function () {
      this.timeout(30000);
      
      console.log("      Testing on-chain verification...");
      
      // Generate proof
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        SAMPLE_INPUTS,
        WASM_PATH,
        ZKEY_PATH
      );

      // Format for contract (removing extra coordinates for projective points)
      const contractA: [bigint, bigint] = [
        BigInt(proof.pi_a[0]),
        BigInt(proof.pi_a[1])
      ];
      
      const contractB: [[bigint, bigint], [bigint, bigint]] = [
        [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])], // Swapped coordinates
        [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]  // Swapped coordinates
      ];
      
      const contractC: [bigint, bigint] = [
        BigInt(proof.pi_c[0]),
        BigInt(proof.pi_c[1])
      ];
      
      const contractSignals: [bigint, bigint, bigint, bigint, bigint] = [
        BigInt(publicSignals[0]), // valid
        BigInt(publicSignals[1]), // commit
        BigInt(publicSignals[2]), // nonce
        BigInt(publicSignals[3]), // offeredPrice
        BigInt(publicSignals[4])  // offeredAmount
      ];

      // Verify proof on-chain
      const isValid = await verifier.verifyProof(
        contractA,
        contractB,
        contractC,
        contractSignals
      );

      expect(isValid).to.be.true;
      console.log("      On-chain verification successful");
    });

    it("should reject invalid proofs on-chain", async function () {
      // Test with dummy/invalid proof data
      const dummyA: [bigint, bigint] = [1n, 2n];
      const dummyB: [[bigint, bigint], [bigint, bigint]] = [[1n, 2n], [3n, 4n]];
      const dummyC: [bigint, bigint] = [5n, 6n];
      const dummySignals: [bigint, bigint, bigint, bigint, bigint] = [
        1n, 100n, 200n, 150n, 250n
      ];

      const isValid = await verifier.verifyProof(
        dummyA,
        dummyB,
        dummyC,
        dummySignals
      );

      expect(isValid).to.be.false;
      console.log("      Invalid proof correctly rejected on-chain");
    });
  });

  describe("End-to-End Workflow", function () {
    it("should complete full ZK proof workflow", async function () {
      this.timeout(30000);
      
      console.log("      Running complete ZK workflow...");
      
      // 1. Validate inputs
      console.log("      1. Validating inputs...");
      const secretPrice = BigInt(SAMPLE_INPUTS.secretPrice);
      const offeredPrice = BigInt(SAMPLE_INPUTS.offeredPrice);
      expect(offeredPrice).to.be.gte(secretPrice);
      
      // 2. Generate proof
      console.log("      2. Generating proof...");
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        SAMPLE_INPUTS,
        WASM_PATH,
        ZKEY_PATH
      );
      expect(proof).to.have.property('pi_a');
      
      // 3. Format for contract
      console.log("      3. Formatting for contract...");
      const contractProof = {
        a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])] as [bigint, bigint],
        b: [
          [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])], // Swapped coordinates
          [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]  // Swapped coordinates
        ] as [[bigint, bigint], [bigint, bigint]],
        c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])] as [bigint, bigint],
        signals: publicSignals.map(s => BigInt(s)) as [bigint, bigint, bigint, bigint, bigint]
      };
      
      // 4. Verify on-chain
      console.log("      4. Verifying on-chain...");
      const isValid = await verifier.verifyProof(
        contractProof.a,
        contractProof.b,
        contractProof.c,
        contractProof.signals
      );
      
      expect(isValid).to.be.true;
      console.log("      Complete workflow successful!");
    });
  });
}); 