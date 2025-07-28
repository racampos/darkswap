import { expect } from "chai";
import { ethers } from "ethers";
import {
  packSalt,
  unpackSalt,
  truncateCommitment,
  validateExtensionHash,
  validateSaltStructure,
  verifyRoundTrip,
  formatPackedSalt,
  extensionHashFromHex,
  computeExtensionHash,
  createSaltFromExtension,
  SALT_CONFIG,
  type PackedSaltData,
  type UnpackedSaltData,
  type SaltValidationResult
} from "../src/utils/saltPacking";

describe("Salt Packing System", function () {

  describe("Core Packing/Unpacking", function () {
    it("should pack and unpack salt correctly", function () {
      // Test with typical values
      const commitment = BigInt("0x123456789ABCDEF0123456789ABCDEF012345678"); // Large Poseidon hash
      const extensionHash = BigInt("0x9876543210FEDCBA9876543210FEDCBA98765432"); // 160-bit extension hash
      
      // Pack the salt
      const packed = packSalt(commitment, extensionHash);
      expect(packed.salt).to.be.a("bigint");
      expect(packed.commitment).to.equal(truncateCommitment(commitment)); // Should be truncated
      expect(packed.extensionHash).to.equal(extensionHash);
      
      // Unpack the salt
      const unpacked = unpackSalt(packed.salt);
      expect(unpacked.commitment).to.equal(packed.commitment);
      expect(unpacked.extensionHash).to.equal(packed.extensionHash);
      
      console.log(`✅ Basic salt packing/unpacking working`);
      console.log(`   ${formatPackedSalt(packed)}`);
    });

    it("should handle commitment truncation correctly", function () {
      // Test with a very large commitment (larger than 96 bits)
      const largeCommitment = BigInt("0x123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0");
      const extensionHash = BigInt("0x1111111111111111111111111111111111111111");
      
      const packed = packSalt(largeCommitment, extensionHash);
      const truncated = truncateCommitment(largeCommitment);
      
      // Verify truncation
      expect(packed.commitment).to.equal(truncated);
      expect(packed.commitment).to.not.equal(largeCommitment); // Should be different due to truncation
      expect(packed.commitment).to.be.at.most(SALT_CONFIG.COMMITMENT_MASK); // Should fit in 96 bits
      
      // Verify round-trip with truncated value
      const unpacked = unpackSalt(packed.salt);
      expect(unpacked.commitment).to.equal(truncated);
      
      console.log(`✅ Commitment truncation working correctly`);
      console.log(`   Original: 0x${largeCommitment.toString(16)}`);
      console.log(`   Truncated: 0x${truncated.toString(16)}`);
    });

    it("should verify round-trip consistency", function () {
      const testCases = [
        {
          commitment: BigInt("0x123456789ABCDEF012345678"),
          extensionHash: BigInt("0x9876543210FEDCBA9876543210FEDCBA98765432"),
          description: "Typical values"
        },
        {
          commitment: BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFF"), // Max 96-bit commitment
          extensionHash: BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"), // Max 160-bit extension
          description: "Maximum values"
        },
        {
          commitment: BigInt("0x1"),
          extensionHash: BigInt("0x1"),
          description: "Minimum values"
        }
      ];
      
      for (const testCase of testCases) {
        const isConsistent = verifyRoundTrip(testCase.commitment, testCase.extensionHash);
        expect(isConsistent).to.be.true;
        
        console.log(`   ✅ Round-trip consistent for ${testCase.description}`);
      }
      
      console.log(`✅ Round-trip verification working correctly`);
    });
  });

  describe("Validation and Error Handling", function () {
    it("should validate extension hash constraints", function () {
      // Valid extension hash
      const validHash = BigInt("0x123456789ABCDEF0123456789ABCDEF012345678");
      const validResult = validateExtensionHash(validHash);
      expect(validResult.isValid).to.be.true;
      expect(validResult.errors).to.be.empty;
      
      // Invalid: too large for 160 bits
      const tooLargeHash = BigInt("0x1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"); // 161 bits
      const invalidResult = validateExtensionHash(tooLargeHash);
      expect(invalidResult.isValid).to.be.false;
      expect(invalidResult.errors).to.have.length(1);
      expect(invalidResult.errors[0]).to.include("too large");
      
      // Invalid: negative
      expect(() => {
        validateExtensionHash(BigInt(-1));
      }).to.not.throw(); // Validation should return result, not throw
      
      const negativeResult = validateExtensionHash(BigInt(-1));
      expect(negativeResult.isValid).to.be.false;
      
      console.log(`✅ Extension hash validation working correctly`);
    });

    it("should validate salt structure", function () {
      // Valid salt
      const validSalt = BigInt("0x123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0");
      const validResult = validateSaltStructure(validSalt);
      expect(validResult.isValid).to.be.true;
      
      // Invalid: too large for 256 bits
      const tooLargeSalt = (BigInt(1) << BigInt(256)); // Exactly 257 bits
      const invalidResult = validateSaltStructure(tooLargeSalt);
      expect(invalidResult.isValid).to.be.false;
      expect(invalidResult.errors[0]).to.include("too large");
      
      console.log(`✅ Salt structure validation working correctly`);
    });

    it("should handle packing errors gracefully", function () {
      const validCommitment = BigInt("0x123456789ABCDEF012345678");
      
      // Test with invalid extension hash (too large)
      const invalidExtensionHash = BigInt("0x1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
      
      expect(() => {
        packSalt(validCommitment, invalidExtensionHash);
      }).to.throw("Invalid extension hash");
      
      // Test with valid inputs (should not throw)
      const validExtensionHash = BigInt("0x123456789ABCDEF0123456789ABCDEF012345678");
      expect(() => {
        packSalt(validCommitment, validExtensionHash);
      }).to.not.throw();
      
      console.log(`✅ Error handling working correctly`);
    });
  });

  describe("Extension Hash Utilities", function () {
    it("should compute extension hash from bytes", function () {
      const extensionBytes = "0x1234567890ABCDEF";
      const extensionHash = computeExtensionHash(extensionBytes);
      
      // Verify it's a valid 160-bit hash
      expect(extensionHash).to.be.a("bigint");
      expect(extensionHash).to.be.at.most(SALT_CONFIG.EXTENSION_MASK);
      
      // Verify it's deterministic
      const extensionHash2 = computeExtensionHash(extensionBytes);
      expect(extensionHash).to.equal(extensionHash2);
      
      // Verify different inputs produce different hashes
      const differentHash = computeExtensionHash("0xDEADBEEF");
      expect(extensionHash).to.not.equal(differentHash);
      
      console.log(`✅ Extension hash computation working`);
      console.log(`   Input: ${extensionBytes}`);
      console.log(`   Hash: 0x${extensionHash.toString(16)}`);
    });

    it("should parse extension hash from hex strings", function () {
      const hexString = "123456789ABCDEF0123456789ABCDEF012345678";
      const expectedValue = BigInt("0x" + hexString);
      
      // Test with and without 0x prefix
      const fromHexWithoutPrefix = extensionHashFromHex(hexString);
      const fromHexWithPrefix = extensionHashFromHex("0x" + hexString);
      
      expect(fromHexWithoutPrefix).to.equal(expectedValue);
      expect(fromHexWithPrefix).to.equal(expectedValue);
      expect(fromHexWithoutPrefix).to.equal(fromHexWithPrefix);
      
      // Test error for too-long hex string
      const tooLongHex = "1".repeat(50); // 50 chars > 40 chars (160-bit max)
      expect(() => {
        extensionHashFromHex(tooLongHex);
      }).to.throw("too long");
      
      console.log(`✅ Hex string parsing working correctly`);
    });

    it("should create salt from extension bytes", function () {
      const commitment = BigInt("0x987654321FEDCBA987654321FEDCBA9876543210");
      const extensionBytes = "0xABCDEF1234567890";
      
      // Create salt from extension bytes
      const saltData = createSaltFromExtension(commitment, extensionBytes);
      
      // Verify the extension hash matches manual computation
      const expectedExtensionHash = computeExtensionHash(extensionBytes);
      expect(saltData.extensionHash).to.equal(expectedExtensionHash);
      
      // Verify the commitment is properly truncated
      expect(saltData.commitment).to.equal(truncateCommitment(commitment));
      
      // Verify round-trip consistency
      const unpacked = unpackSalt(saltData.salt);
      expect(unpacked.commitment).to.equal(saltData.commitment);
      expect(unpacked.extensionHash).to.equal(saltData.extensionHash);
      
      console.log(`✅ Salt creation from extension bytes working`);
      console.log(`   ${formatPackedSalt(saltData)}`);
    });
  });

  describe("Integration Scenarios", function () {
    it("should handle real-world ZK order scenario", function () {
      // Simulate a real ZK order scenario
      const poseidonCommitment = BigInt("0x1A2B3C4D5E6F7890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890");
      const extensionData = "0x6fe7b0ba00000000000000000000000000000000000000000000000000000000000000c8";
      
      // Create salt from the extension data
      const saltData = createSaltFromExtension(poseidonCommitment, extensionData);
      
      // Verify all components
      expect(saltData.salt).to.be.a("bigint");
      expect(saltData.commitment).to.equal(truncateCommitment(poseidonCommitment));
      expect(saltData.extensionHash).to.equal(computeExtensionHash(extensionData));
      
      // Verify it works with 1inch-style hex conversion
      const saltHex = "0x" + saltData.salt.toString(16);
      expect(saltHex).to.match(/^0x[0-9a-f]+$/i);
      
      // Verify unpacking works
      const recovered = unpackSalt(saltData.salt);
      expect(recovered.commitment).to.equal(saltData.commitment);
      expect(recovered.extensionHash).to.equal(saltData.extensionHash);
      
      console.log(`✅ Real-world ZK order scenario working`);
      console.log(`   Poseidon commitment (truncated): 0x${saltData.commitment.toString(16)}`);
      console.log(`   Extension hash: 0x${saltData.extensionHash.toString(16)}`);
      console.log(`   Packed salt: ${saltHex}`);
    });

    it("should maintain precision across bit boundaries", function () {
      // Test edge cases around bit boundaries
      const testCases = [
        {
          commitment: (BigInt(1) << BigInt(95)) - BigInt(1), // Just under 96 bits
          extensionHash: (BigInt(1) << BigInt(159)) - BigInt(1), // Just under 160 bits
          description: "Just under bit limits"
        },
        {
          commitment: (BigInt(1) << BigInt(96)) - BigInt(1), // Exactly 96 bits
          extensionHash: (BigInt(1) << BigInt(160)) - BigInt(1), // Exactly 160 bits
          description: "Exactly at bit limits"
        },
        {
          commitment: BigInt(1) << BigInt(100), // Over 96 bits (will be truncated)
          extensionHash: BigInt(1) << BigInt(150), // Under 160 bits
          description: "Mixed boundaries"
        }
      ];
      
      for (const testCase of testCases) {
        const packed = packSalt(testCase.commitment, testCase.extensionHash);
        const unpacked = unpackSalt(packed.salt);
        
        // Commitment may be truncated, but extension hash should be preserved
        expect(unpacked.commitment).to.equal(truncateCommitment(testCase.commitment));
        expect(unpacked.extensionHash).to.equal(testCase.extensionHash);
        
        console.log(`   ✅ ${testCase.description}: precision maintained`);
      }
      
      console.log(`✅ Bit boundary precision working correctly`);
    });

    it("should work with ethers BigNumber integration", function () {
      // Test integration with ethers.js patterns commonly used in 1inch
      const commitment = BigInt("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");
      const extensionBytes = "0x1234567890ABCDEF1234567890ABCDEF12345678";
      
      const saltData = createSaltFromExtension(commitment, extensionBytes);
      
      // Convert to ethers-compatible formats
      const saltHex = ethers.toBeHex(saltData.salt);
      const commitmentHex = ethers.toBeHex(saltData.commitment);
      const extensionHashHex = ethers.toBeHex(saltData.extensionHash);
      
      expect(saltHex).to.be.a("string");
      expect(saltHex).to.match(/^0x[0-9a-f]+$/i);
      expect(commitmentHex).to.be.a("string");
      expect(extensionHashHex).to.be.a("string");
      
      // Verify conversion back works
      const recoveredSalt = BigInt(saltHex);
      expect(recoveredSalt).to.equal(saltData.salt);
      
      console.log(`✅ Ethers.js integration working correctly`);
      console.log(`   Salt (hex): ${saltHex}`);
      console.log(`   Commitment (hex): ${commitmentHex}`);
      console.log(`   Extension hash (hex): ${extensionHashHex}`);
    });
  });
}); 