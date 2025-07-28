import { expect } from "chai";
import { ethers } from "hardhat";
import { HiddenParamPredicateZK, Groth16Verifier } from "../typechain-types";
import { encodeZKProofData, decodeZKProofData, EncodedZKProofData } from "../src/utils/zkProofEncoder";
import { ZKProof, PublicSignals } from "../src/types/zkTypes";

describe("ZK Proof Encoding/Decoding Pipeline", function () {
  let zkPredicate: HiddenParamPredicateZK;
  let verifier: Groth16Verifier;

  // Sample test data
  const SAMPLE_PROOF: ZKProof = {
    pi_a: [
      "12687972680129708834699730064403403339161438118804251353911904315013992840675",
      "650528900900429171963549362553552303983733971139436109413326945005931039187"
    ],
    pi_b: [
      [
        "16381176086881384563937101326645703065703604031806469385245050036942737088334",
        "16615719773790589276925711721206682381747662696345046427078573937578672757236"
      ],
      [
        "8830468592493215446504179901510322433629188389167780995191694452477279284359",
        "13809121074164559218896211437100211790867347546317703906330375027575106139329"
      ]
    ],
    pi_c: [
      "11584917816843486166331714297644487769964716175749211645900865226869092069203",
      "11213121531217213664397162522873281672408050636171192881159856441269791716587"
    ],
    protocol: "groth16",
    curve: "bn128"
  };

  const SAMPLE_PUBLIC_SIGNALS: PublicSignals = [
    "1",  // valid
    "10528133930517520486573650037327983173279503154763622900167624628081496408586", // commit (Poseidon hash)
    "123456789", // nonce
    "2100", // offeredPrice
    "50"   // offeredAmount
  ];

  beforeEach(async function () {
    // Deploy contracts
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy() as Groth16Verifier;
    await verifier.waitForDeployment();

    const ZKPredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
    zkPredicate = await ZKPredicateFactory.deploy(await verifier.getAddress()) as HiddenParamPredicateZK;
    await zkPredicate.waitForDeployment();
  });

  describe("TypeScript Encoding", function () {
    it("should encode valid proof data successfully", function () {
      console.log("Testing proof data encoding...");
      
      const encoded = encodeZKProofData(SAMPLE_PROOF, SAMPLE_PUBLIC_SIGNALS);
      
      expect(encoded.encodedData).to.be.a("string");
      expect(encoded.encodedData).to.match(/^0x[0-9a-fA-F]+$/);
      expect(encoded.encodedData.length).to.be.greaterThan(2); // More than just '0x'
      
      console.log("Encoded data length:", encoded.encodedData.length);
      console.log("Encoded successfully");
    });

    it("should validate proof components correctly", function () {
      const encoded = encodeZKProofData(SAMPLE_PROOF, SAMPLE_PUBLIC_SIGNALS);
      
      // Verify pi_a components
      expect(encoded.components.pi_a).to.have.length(2);
      expect(encoded.components.pi_a[0]).to.equal(BigInt(SAMPLE_PROOF.pi_a[0]));
      expect(encoded.components.pi_a[1]).to.equal(BigInt(SAMPLE_PROOF.pi_a[1]));
      
      // Verify pi_b components (should be coordinate-swapped)
      expect(encoded.components.pi_b).to.have.length(2);
      expect(encoded.components.pi_b[0][0]).to.equal(BigInt(SAMPLE_PROOF.pi_b[0][1])); // Swapped
      expect(encoded.components.pi_b[0][1]).to.equal(BigInt(SAMPLE_PROOF.pi_b[0][0])); // Swapped
      
      // Verify public signals
      expect(encoded.components.publicSignals).to.have.length(5);
      expect(encoded.components.publicSignals[0]).to.equal(BigInt(SAMPLE_PUBLIC_SIGNALS[0]));
      
      console.log("Component validation successful");
    });

    it("should reject invalid proof structures", function () {
      // Invalid pi_a
      const invalidProof1 = { ...SAMPLE_PROOF, pi_a: ["123"] }; // Wrong length
      expect(() => encodeZKProofData(invalidProof1 as any, SAMPLE_PUBLIC_SIGNALS))
        .to.throw("Invalid pi_a: must be array of 2 elements");

      // Invalid pi_b
      const invalidProof2 = { ...SAMPLE_PROOF, pi_b: [["123"], ["456"]] }; // Wrong nested length
      expect(() => encodeZKProofData(invalidProof2 as any, SAMPLE_PUBLIC_SIGNALS))
        .to.throw("Invalid pi_b: must be 2x2 array");

      // Invalid public signals
      const invalidSignals = ["1", "2", "3"]; // Wrong length
      expect(() => encodeZKProofData(SAMPLE_PROOF, invalidSignals as any))
        .to.throw("Invalid public signals: must be array of 5 elements");

      console.log("Invalid input rejection working");
    });
  });

  describe("TypeScript Decoding", function () {
    it("should decode encoded data back to original components", function () {
      const encoded = encodeZKProofData(SAMPLE_PROOF, SAMPLE_PUBLIC_SIGNALS);
      const decoded = decodeZKProofData(encoded.encodedData);
      
      // Verify round-trip consistency
      expect(decoded.pi_a[0]).to.equal(encoded.components.pi_a[0]);
      expect(decoded.pi_a[1]).to.equal(encoded.components.pi_a[1]);
      
      expect(decoded.pi_b[0][0]).to.equal(encoded.components.pi_b[0][0]);
      expect(decoded.pi_b[0][1]).to.equal(encoded.components.pi_b[0][1]);
      
      expect(decoded.publicSignals[0]).to.equal(encoded.components.publicSignals[0]);
      expect(decoded.publicSignals[1]).to.equal(encoded.components.publicSignals[1]);
      
      console.log("Round-trip decoding successful");
    });

    it("should reject malformed encoded data", function () {
      expect(() => decodeZKProofData("0xinvalid"))
        .to.throw("Failed to decode proof data");

      expect(() => decodeZKProofData(""))
        .to.throw("Failed to decode proof data");

      console.log("Malformed data rejection working");
    });
  });

  describe("Solidity Decoding", function () {
    it("should handle valid encoded proof data", async function () {
      const encoded = encodeZKProofData(SAMPLE_PROOF, SAMPLE_PUBLIC_SIGNALS);
      
      // Call predicate with encoded data
      const result = await zkPredicate.predicate(encoded.encodedData);
      expect(result).to.equal(1); // Should succeed with current placeholder logic
      
      console.log("Solidity decoding successful");
    });

    it("should reject empty proof data", async function () {
      const result = await zkPredicate.predicate("0x");
      expect(result).to.equal(0);
      
      console.log("Empty data correctly rejected");
    });

    it("should reject insufficient proof data", async function () {
      const shortData = "0x1234"; // Too short
      const result = await zkPredicate.predicate(shortData);
      expect(result).to.equal(0);
      
      console.log("Insufficient data correctly rejected");
    });

    it("should validate minimum proof data length", async function () {
      const minLength = await zkPredicate.getMinProofDataLength();
      expect(minLength).to.equal(416); // 13 uint256 values * 32 bytes
      
      console.log("Minimum data length:", minLength.toString());
    });

    it("should handle malformed ABI data gracefully", async function () {
      // Create malformed ABI data
      const malformedData = "0x" + "1234".repeat(100); // Valid hex but wrong structure
      const result = await zkPredicate.predicate(malformedData);
      expect(result).to.equal(0); // Should fail gracefully
      
      console.log("Malformed ABI data handled gracefully");
    });
  });

  describe("Round-Trip Consistency", function () {
    it("should maintain data integrity through full pipeline", async function () {
      console.log("Testing full round-trip consistency...");
      
      // 1. Encode in TypeScript
      const encoded = encodeZKProofData(SAMPLE_PROOF, SAMPLE_PUBLIC_SIGNALS);
      console.log("1. TypeScript encoding completed");
      
      // 2. Decode in TypeScript (verify our encoder/decoder)
      const tsDecoded = decodeZKProofData(encoded.encodedData);
      console.log("2. TypeScript decoding completed");
      
      // 3. Send to Solidity for decoding (implicit in predicate call)
      const solidityResult = await zkPredicate.predicate(encoded.encodedData);
      expect(solidityResult).to.equal(1); // Placeholder should succeed for valid data
      console.log("3. Solidity decoding completed");
      
      // 4. Verify TypeScript round-trip consistency
      expect(tsDecoded.pi_a[0]).to.equal(encoded.components.pi_a[0]);
      expect(tsDecoded.publicSignals[0]).to.equal(encoded.components.publicSignals[0]);
      console.log("4. Round-trip consistency verified");
      
      console.log("Full pipeline integrity maintained");
    });

    it("should handle edge case values correctly", async function () {
      // Test with edge case values
      const edgeCaseSignals: PublicSignals = [
        "0",  // valid = 0 (edge case)
        "0",  // commit = 0
        "1",  // nonce = 1 (minimum)
        "1",  // offeredPrice = 1
        "1"   // offeredAmount = 1
      ];

      const encoded = encodeZKProofData(SAMPLE_PROOF, edgeCaseSignals);
      const decoded = decodeZKProofData(encoded.encodedData);
      
      // Verify edge cases
      expect(decoded.publicSignals[0]).to.equal(0n);
      expect(decoded.publicSignals[1]).to.equal(0n);
      expect(decoded.publicSignals[2]).to.equal(1n);
      
      // Should work in Solidity too
      const result = await zkPredicate.predicate(encoded.encodedData);
      expect(result).to.equal(1); // Current logic should accept this
      
      console.log("Edge case values handled correctly");
    });

    it("should detect public signal validation errors", async function () {
      // Create signals with invalid valid flag (> 1)
      const invalidSignals: PublicSignals = [
        "2",  // valid = 2 (invalid, should be 0 or 1)
        "10528133930517520486573650037327983173279503154763622900167624628081496408586",
        "123456789",
        "2100",
        "50"
      ];

      const encoded = encodeZKProofData(SAMPLE_PROOF, invalidSignals);
      
      // Should fail in Solidity validation
      const result = await zkPredicate.predicate(encoded.encodedData);
      expect(result).to.equal(0); // Should fail validation
      
      console.log("Public signal validation working");
    });
  });
}); 