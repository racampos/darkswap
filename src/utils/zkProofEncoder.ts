import { ethers } from "ethers";
import { ZKProof, PublicSignals } from "../types/zkTypes";

/**
 * Encoded ZK proof data structure for contract consumption
 */
export interface EncodedZKProofData {
  encodedData: string;    // ABI-encoded bytes
  components: {
    pi_a: [bigint, bigint];
    pi_b: [[bigint, bigint], [bigint, bigint]];
    pi_c: [bigint, bigint];
    publicSignals: [bigint, bigint, bigint, bigint, bigint];
  };
}

/**
 * Validates ZK proof structure before encoding
 */
function validateZKProof(proof: ZKProof): void {
  if (!proof.pi_a || proof.pi_a.length !== 3) {
    throw new Error("Invalid pi_a: must be array of 3 elements (projective coordinates)");
  }
  
  if (!proof.pi_b || proof.pi_b.length !== 3 || 
      proof.pi_b[0].length !== 2 || proof.pi_b[1].length !== 2 || proof.pi_b[2].length !== 2) {
    throw new Error("Invalid pi_b: must be 3x2 array (G2 point with projective coordinate)");
  }
  
  if (!proof.pi_c || proof.pi_c.length !== 3) {
    throw new Error("Invalid pi_c: must be array of 3 elements (projective coordinates)");
  }
}

/**
 * Validates public signals structure
 */
function validatePublicSignals(signals: PublicSignals): void {
  if (!signals || signals.length !== 5) {
    throw new Error("Invalid public signals: must be array of 5 elements");
  }
  
  // Validate each signal can be converted to BigInt
  signals.forEach((signal, index) => {
    try {
      BigInt(signal);
    } catch (error) {
      throw new Error(`Invalid public signal at index ${index}: ${signal}`);
    }
  });
}

/**
 * Formats ZK proof for Solidity verifier consumption
 * Handles projective coordinates and G2 coordinate swapping
 */
function formatProofForSolidity(proof: ZKProof): {
  pi_a: [bigint, bigint];
  pi_b: [[bigint, bigint], [bigint, bigint]];
  pi_c: [bigint, bigint];
} {
  return {
    // Convert from projective coordinates (take first 2 elements)
    pi_a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
    // G2 coordinates need to be swapped for Solidity compatibility
    // Also convert from projective coordinates (take first 2 elements of each)
    pi_b: [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])], // Swapped coordinates
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]  // Swapped coordinates
    ],
    // Convert from projective coordinates (take first 2 elements)
    pi_c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])]
  };
}

/**
 * Encodes ZK proof data for contract consumption
 * @param proof Raw ZK proof from snarkjs
 * @param publicSignals Public signals array
 * @returns Encoded proof data with ABI-encoded bytes
 */
export function encodeZKProofData(proof: ZKProof, publicSignals: PublicSignals): EncodedZKProofData {
  // Validate inputs
  validateZKProof(proof);
  validatePublicSignals(publicSignals);
  
  // Format proof components for Solidity
  const formattedProof = formatProofForSolidity(proof);
  
  // Convert public signals to BigInt array
  const formattedSignals: [bigint, bigint, bigint, bigint, bigint] = [
    BigInt(publicSignals[0]), // valid
    BigInt(publicSignals[1]), // commit
    BigInt(publicSignals[2]), // nonce
    BigInt(publicSignals[3]), // offeredPrice
    BigInt(publicSignals[4])  // offeredAmount
  ];
  
  // ABI encode the proof data
  // Structure: (uint256[2] pi_a, uint256[2][2] pi_b, uint256[2] pi_c, uint256[5] publicSignals)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encodedData = abiCoder.encode(
    ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[5]"],
    [
      [formattedProof.pi_a[0], formattedProof.pi_a[1]],
      [
        [formattedProof.pi_b[0][0], formattedProof.pi_b[0][1]],
        [formattedProof.pi_b[1][0], formattedProof.pi_b[1][1]]
      ],
      [formattedProof.pi_c[0], formattedProof.pi_c[1]],
      [
        formattedSignals[0],
        formattedSignals[1], 
        formattedSignals[2],
        formattedSignals[3],
        formattedSignals[4]
      ]
    ]
  );
  
  return {
    encodedData,
    components: {
      pi_a: formattedProof.pi_a,
      pi_b: formattedProof.pi_b,
      pi_c: formattedProof.pi_c,
      publicSignals: formattedSignals
    }
  };
}

/**
 * Decodes ABI-encoded proof data (for testing purposes)
 * @param encodedData ABI-encoded bytes
 * @returns Decoded proof components
 */
export function decodeZKProofData(encodedData: string): EncodedZKProofData["components"] {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  try {
    const decoded = abiCoder.decode(
      ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[5]"],
      encodedData
    );
    
    return {
      pi_a: [BigInt(decoded[0][0]), BigInt(decoded[0][1])],
      pi_b: [
        [BigInt(decoded[1][0][0]), BigInt(decoded[1][0][1])],
        [BigInt(decoded[1][1][0]), BigInt(decoded[1][1][1])]
      ],
      pi_c: [BigInt(decoded[2][0]), BigInt(decoded[2][1])],
      publicSignals: [
        BigInt(decoded[3][0]),
        BigInt(decoded[3][1]),
        BigInt(decoded[3][2]),
        BigInt(decoded[3][3]),
        BigInt(decoded[3][4])
      ]
    };
  } catch (error) {
    throw new Error(`Failed to decode proof data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 