import { expect } from "chai";
import { ethers } from "hardhat";
import { HiddenParamPredicateZK, Groth16Verifier } from "../typechain-types";

describe("HiddenParamPredicateZK - Basic Structure", function () {
  let zkPredicate: HiddenParamPredicateZK;
  let verifier: Groth16Verifier;
  
  beforeEach(async function () {
    // Deploy Groth16Verifier first
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy() as Groth16Verifier;
    await verifier.waitForDeployment();

    // Deploy ZK Predicate with verifier address
    const ZKPredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
    zkPredicate = await ZKPredicateFactory.deploy(await verifier.getAddress()) as HiddenParamPredicateZK;
    await zkPredicate.waitForDeployment();
  });

  describe("Contract Deployment", function () {
    it("should deploy successfully", async function () {
      expect(await zkPredicate.getAddress()).to.not.equal(ethers.ZeroAddress);
      console.log("ZK Predicate deployed at:", await zkPredicate.getAddress());
    });

    it("should have correct verifier address", async function () {
      const storedVerifier = await zkPredicate.getVerifier();
      const expectedVerifier = await verifier.getAddress();
      expect(storedVerifier).to.equal(expectedVerifier);
      console.log("Verifier correctly linked:", expectedVerifier);
    });

    it("should reject zero address verifier", async function () {
      const ZKPredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
      await expect(
        ZKPredicateFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("HiddenParamPredicateZK: verifier cannot be zero address");
    });
  });

  describe("LOP Predicate Interface", function () {
    it("should have correct predicate function signature", async function () {
      // Verify the predicate function exists and has correct signature
      const fragment = zkPredicate.interface.getFunction("predicate");
      expect(fragment.name).to.equal("predicate");
      expect(fragment.inputs.length).to.equal(1);
      expect(fragment.inputs[0].type).to.equal("bytes");
      expect(fragment.outputs.length).to.equal(1);
      expect(fragment.outputs[0].type).to.equal("uint256");
      console.log("LOP predicate interface verified");
    });

    it("should return 0 for empty data", async function () {
      const result = await zkPredicate.predicate("0x");
      expect(result).to.equal(0);
      console.log("Empty data correctly rejected");
    });

    it("should return 0 for invalid proof data", async function () {
      // Test with dummy data - should return 0 due to real ZK verification
      const dummyData = "0x1234567890abcdef";
      const result = await zkPredicate.predicate(dummyData);
      expect(result).to.equal(0);
      console.log("Invalid proof data correctly rejected");
    });
  });

  describe("Contract Integration", function () {
    it("should be compatible with 1inch predicate patterns", async function () {
      // Test that the contract can be called via static call (1inch pattern)
      const dummyData = "0xdeadbeef";
      
      // This is how 1inch router would call the predicate
      const result = await ethers.provider.call({
        to: await zkPredicate.getAddress(),
        data: zkPredicate.interface.encodeFunctionData("predicate", [dummyData])
      });
      
      // Decode the result - should be 0 for invalid proof data
      const decoded = zkPredicate.interface.decodeFunctionResult("predicate", result);
      expect(decoded[0]).to.equal(0);
      console.log("Static call pattern verified - invalid data correctly rejected");
    });

    it("should have immutable verifier reference", async function () {
      // Verify verifier is immutable (no setter function)
      expect(zkPredicate.interface.hasFunction("setVerifier")).to.be.false;
      
      // Verify verifier address doesn't change
      const verifierAddress1 = await zkPredicate.getVerifier();
      const verifierAddress2 = await zkPredicate.getVerifier();
      expect(verifierAddress1).to.equal(verifierAddress2);
      console.log("Verifier immutability verified");
    });
  });
}); 