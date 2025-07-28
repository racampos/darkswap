import { expect } from "chai";
import {
  generateNonce,
  validateSecretParameters,
  calculateCommitment,
  createCommitment,
  validateCommitment,
  isCommitmentSafe,
  formatCommitmentData,
  COMMITMENT_CONSTANTS,
  type SecretParameters,
  type CommitmentData
} from "../src/utils/commitmentUtils";

const { poseidon3 } = require("poseidon-lite");

describe("Commitment System - Core Utilities", function () {

  describe("Core Functionality", function () {
    it("should generate unique nonces and calculate commitments", function () {
      // Test nonce generation
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).to.be.a("bigint");
      expect(nonce2).to.be.a("bigint");
      expect(nonce1).to.not.equal(nonce2); // Should be unique
      expect(nonce1).to.be.at.most(COMMITMENT_CONSTANTS.MAX_NONCE);
      
      // Test commitment calculation using Poseidon hash
      const secretPrice = BigInt(2000);
      const secretAmount = BigInt(1000);
      const nonce = BigInt(555);
      
      const commitment = calculateCommitment(secretPrice, secretAmount, nonce);
      const expectedCommitment = poseidon3([secretPrice, secretAmount, nonce]); // Poseidon hash
      expect(commitment).to.equal(expectedCommitment);
      
      console.log(`✅ Nonce generation and Poseidon commitment calculation working`);
    });

    it("should validate parameters and reject invalid inputs", function () {
      const validParams: SecretParameters = {
        secretPrice: BigInt(1000),
        secretAmount: BigInt(500),
        nonce: BigInt(123456)
      };
      
      // Valid parameters should pass
      const validResult = validateSecretParameters(validParams);
      expect(validResult.isValid).to.be.true;
      expect(validResult.errors).to.be.empty;
      
      // Invalid parameters should fail with errors
      const invalidParams = { ...validParams, secretPrice: BigInt(0) };
      const invalidResult = validateSecretParameters(invalidParams);
      expect(invalidResult.isValid).to.be.false;
      expect(invalidResult.errors).to.have.length(1);
      expect(invalidResult.errors[0]).to.include("Secret price too low");
      
      // Commitment calculation should reject invalid inputs
      expect(() => {
        calculateCommitment(BigInt(0), BigInt(1000), BigInt(555));
      }).to.throw("Invalid secret parameters");
      
      console.log(`✅ Parameter validation working correctly`);
    });

    it("should create commitments with manual and auto-generated nonces", function () {
      const secretPrice = BigInt(3000);
      const secretAmount = BigInt(1500);
      
      // Test with provided nonce
      const manualNonce = BigInt(777);
      const manualCommitment = createCommitment(secretPrice, secretAmount, manualNonce);
      expect(manualCommitment.secretParams.nonce).to.equal(manualNonce);
      
      // Verify Poseidon hash calculation
      const expectedCommitment = poseidon3([secretPrice, secretAmount, manualNonce]);
      expect(manualCommitment.commitment).to.equal(expectedCommitment);
      
      // Test with auto-generated nonce
      const autoCommitment = createCommitment(secretPrice, secretAmount);
      expect(autoCommitment.secretParams.nonce).to.be.a("bigint");
      expect(autoCommitment.secretParams.nonce).to.be.at.least(COMMITMENT_CONSTANTS.MIN_NONCE);
      
      // Auto-generated should create unique commitments
      const autoCommitment2 = createCommitment(secretPrice, secretAmount);
      expect(autoCommitment.commitment).to.not.equal(autoCommitment2.commitment);
      
      console.log(`✅ Manual and auto-generated nonce creation with Poseidon working`);
    });

    it("should validate commitment consistency", function () {
      const secretParams: SecretParameters = {
        secretPrice: BigInt(2200),
        secretAmount: BigInt(1100),
        nonce: BigInt(888)
      };
      
      // Correct commitment should validate
      const correctCommitment = calculateCommitment(
        secretParams.secretPrice, 
        secretParams.secretAmount, 
        secretParams.nonce
      );
      const validResult = validateCommitment(correctCommitment, secretParams);
      expect(validResult.isValid).to.be.true;
      expect(validResult.errors).to.be.empty;
      
      // Incorrect commitment should fail
      const wrongCommitment = BigInt(999999);
      const invalidResult = validateCommitment(wrongCommitment, secretParams);
      expect(invalidResult.isValid).to.be.false;
      expect(invalidResult.errors).to.have.length(1);
      expect(invalidResult.errors[0]).to.include("Commitment mismatch");
      
      console.log(`✅ Poseidon commitment validation working correctly`);
    });

    it("should handle complete workflow correctly", function () {
      // Create commitment with auto-generated nonce
      const secretPrice = BigInt(5000);
      const secretAmount = BigInt(2500);
      const commitmentData = createCommitment(secretPrice, secretAmount);
      
      // Validate the created commitment
      const validation = validateCommitment(commitmentData.commitment, commitmentData.secretParams);
      expect(validation.isValid).to.be.true;
      
      // Check safety and formatting (Poseidon hashes are always safe as they're within field bounds)
      expect(isCommitmentSafe(commitmentData.commitment)).to.be.true;
      
      const formatted = formatCommitmentData(commitmentData);
      expect(formatted).to.include("Commitment(");
      expect(formatted).to.include("price(5000)");
      expect(formatted).to.include("amount(2500)");
      
      // Test consistency between creation methods
      const directCommitment = calculateCommitment(
        secretPrice, 
        secretAmount, 
        commitmentData.secretParams.nonce
      );
      expect(commitmentData.commitment).to.equal(directCommitment);
      
      console.log(`✅ Complete Poseidon workflow successful`);
      console.log(`   ${formatted}`);
    });

    it("should handle errors gracefully", function () {
      // Invalid parameters in validation
      const invalidParams: SecretParameters = {
        secretPrice: BigInt(0), // Invalid
        secretAmount: BigInt(1100),
        nonce: BigInt(888)
      };
      
      const result = validateCommitment(BigInt(123456), invalidParams);
      expect(result.isValid).to.be.false;
      expect(result.errors.length).to.be.greaterThan(0);
      
      // Safety checks (Poseidon hashes are much larger but still safe)
      const testCommitment = poseidon3([BigInt(1000), BigInt(2000), BigInt(3000)]);
      expect(isCommitmentSafe(testCommitment)).to.be.true;
      expect(isCommitmentSafe(BigInt(0))).to.be.true; // Zero should be safe
      
      console.log(`✅ Error handling and safety checks working`);
    });

    it("should handle boundary values correctly", function () {
      // Test with minimum valid values
      const minCommitment = createCommitment(
        COMMITMENT_CONSTANTS.MIN_PRICE,
        COMMITMENT_CONSTANTS.MIN_AMOUNT,
        COMMITMENT_CONSTANTS.MIN_NONCE
      );
      expect(isCommitmentSafe(minCommitment.commitment)).to.be.true;
      
      // Test with maximum valid values  
      const maxCommitment = createCommitment(
        COMMITMENT_CONSTANTS.MAX_PRICE,
        COMMITMENT_CONSTANTS.MAX_AMOUNT,
        COMMITMENT_CONSTANTS.MAX_NONCE
      );
      expect(isCommitmentSafe(maxCommitment.commitment)).to.be.true;
      
      // Test boundary rejection
      const boundaryParams: SecretParameters = {
        secretPrice: COMMITMENT_CONSTANTS.MAX_PRICE + BigInt(1), // Over limit
        secretAmount: COMMITMENT_CONSTANTS.MAX_AMOUNT,
        nonce: COMMITMENT_CONSTANTS.MAX_NONCE
      };
      const boundaryResult = validateSecretParameters(boundaryParams);
      expect(boundaryResult.isValid).to.be.false;
      
      console.log(`✅ Boundary value handling working`);
      console.log(`   Min commitment: ${minCommitment.commitment}`);
      console.log(`   Max commitment: ${maxCommitment.commitment}`);
    });
  });
}); 