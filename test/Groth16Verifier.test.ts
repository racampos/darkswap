import { expect } from "chai";
import { ethers } from "hardhat";
import { Groth16Verifier } from "../typechain-types";

describe("Groth16Verifier", function () {
  let verifier: Groth16Verifier;

  beforeEach(async function () {
    // Deploy the Groth16Verifier contract
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy() as Groth16Verifier;
    await verifier.waitForDeployment();
  });

  describe("Contract Deployment", function () {
    it("should deploy successfully", async function () {
      const address = await verifier.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
      console.log(`      Verifier deployed at: ${address}`);
    });

    it("should have the correct verifyProof function", async function () {
      // Check that the verifyProof function exists
      expect(verifier.verifyProof).to.be.a("function");
    });
  });

  describe("Proof Verification", function () {
    it("should reject invalid proofs gracefully", async function () {
      // Test with dummy proof data (should return false, not revert)
      // Use proper tuple types to match TypeChain-generated interface
      const dummyA: [bigint, bigint] = [1n, 2n];
      const dummyB: [[bigint, bigint], [bigint, bigint]] = [[1n, 2n], [3n, 4n]];
      const dummyC: [bigint, bigint] = [5n, 6n];
      const dummyPublicSignals: [bigint, bigint, bigint, bigint, bigint] = [
        1n,   // valid
        100n, // commit  
        200n, // nonce
        150n, // offeredPrice
        250n  // offeredAmount
      ];

      // This should not revert, just return false for invalid proof
      const result = await verifier.verifyProof(
        dummyA,
        dummyB, 
        dummyC,
        dummyPublicSignals
      );
      
      expect(result).to.be.false;
      console.log(`      Invalid proof correctly rejected: ${result}`);
    });

    it("should handle malformed input gracefully", async function () {
      // Test with incorrect array sizes to ensure robust error handling
      try {
        // TypeScript should catch this at compile time, but testing runtime behavior
        await (verifier as any).verifyProof(
          [1n], // Wrong size - should be [2]  
          [[1n, 2n], [3n, 4n]],
          [5n, 6n],
          [1n, 2n, 3n, 4n, 5n]
        );
        expect.fail("Should have reverted with malformed input");
      } catch (error: any) {
        // This might fail at the ABI encoding level or contract level
        expect(error.message).to.satisfy((msg: string) => 
          msg.includes("array is wrong length") || 
          msg.includes("invalid array length") || 
          msg.includes("invalid type") ||
          msg.includes("revert")
        );
        console.log(`      Malformed input correctly rejected`);
      }
    });
  });

  describe("Public Signals Interface", function () {
    it("should accept the correct number of public signals", async function () {
      // Our circuit expects exactly 5 public signals:
      // [valid, commit, nonce, offeredPrice, offeredAmount]
      const validA: [bigint, bigint] = [1n, 2n];
      const validB: [[bigint, bigint], [bigint, bigint]] = [[1n, 2n], [3n, 4n]];
      const validC: [bigint, bigint] = [5n, 6n];
      const validPublicSignals: [bigint, bigint, bigint, bigint, bigint] = [
        1n,    // valid
        123n,  // commit
        456n,  // nonce  
        2100n, // offeredPrice
        50n    // offeredAmount
      ];

      // Should not revert due to wrong number of signals
      const result = await verifier.verifyProof(
        validA,
        validB,
        validC, 
        validPublicSignals
      );
      
      // Result should be false (invalid proof) but not revert
      expect(result).to.be.false;
      console.log(`      Public signals interface working correctly`);
    });
  });
}); 