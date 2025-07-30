/**
 * Shared Contract Deployment for ZK Tests
 * 
 * Ensures consistent contract addresses across all test files
 * by deploying contracts once and reusing them.
 */

import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { generateProof } from "../../src/utils/proofGenerator";
import { calculateCommitment } from "../../src/utils/commitmentUtils";
import path from "path";

interface SharedContracts {
  groth16Verifier: any;
  hiddenParamPredicate: any;
  deployer: HardhatEthersSigner;
  zkPredicateAddress: string;
}

interface SharedZKProof {
  proof: any;
  publicSignals: string[];
  encodedData: string;
  commitment: bigint;
  nonce: bigint;
}

let sharedContracts: SharedContracts | null = null;
let sharedProof: SharedZKProof | null = null;

/**
 * Get or deploy shared ZK contracts
 * Deploys contracts only once and reuses them across tests
 */
export async function getSharedZKContracts(): Promise<SharedContracts> {
  if (sharedContracts) {
    return sharedContracts;
  }

  console.log("Deploying shared ZK contracts...");
  
  const [deployer] = await ethers.getSigners();

  // Deploy Groth16 Verifier
  const Groth16VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
  const groth16Verifier = await Groth16VerifierFactory.deploy();
  await groth16Verifier.waitForDeployment();

  // Deploy Hidden Param Predicate
  const HiddenParamPredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
  const hiddenParamPredicate = await HiddenParamPredicateFactory.deploy(await groth16Verifier.getAddress());
  await hiddenParamPredicate.waitForDeployment();

  const zkPredicateAddress = await hiddenParamPredicate.getAddress();

  sharedContracts = {
    groth16Verifier,
    hiddenParamPredicate,
    deployer,
    zkPredicateAddress
  };

  console.log("Shared ZK contracts deployed:");
  console.log(`   Groth16Verifier: ${await groth16Verifier.getAddress()}`);
  console.log(`   HiddenParamPredicate: ${zkPredicateAddress}`);

  return sharedContracts;
}

/**
 * Get or generate shared ZK proof
 * Generates proof only once and reuses it across tests for consistency
 */
export async function getSharedZKProof(): Promise<SharedZKProof> {
  if (sharedProof) {
    return sharedProof;
  }

  console.log("Generating shared ZK proof...");

  // Standard test parameters (same as used in both tests)
  const SECRET_PRICE = 3200000000n;
  const SECRET_AMOUNT = ethers.parseEther("2");
  const NONCE = 123456789n;
  const OFFERED_PRICE = 3500000000n;
  const OFFERED_AMOUNT = ethers.parseEther("5");

  // Generate commitment
  const commitment = calculateCommitment(SECRET_PRICE, SECRET_AMOUNT, NONCE);

  // Generate proof
  const proofInputs = {
    secretPrice: SECRET_PRICE.toString(),
    secretAmount: SECRET_AMOUNT.toString(),
    nonce: NONCE.toString(),
    offeredPrice: OFFERED_PRICE.toString(),
    offeredAmount: OFFERED_AMOUNT.toString(),
    commit: commitment.toString()
  };

  const proofConfig = {
    wasmPath: path.join(__dirname, "../../circuits/hidden_params_js/hidden_params.wasm"),
    zkeyPath: path.join(__dirname, "../../circuits/hidden_params_0001.zkey"),
    enableLogging: false
  };

  const { proof, publicSignals } = await generateProof(proofInputs, proofConfig);

  // Encode proof
  const { encodeZKProofData } = await import("../../src/utils/zkProofEncoder");
  const { encodedData } = encodeZKProofData(proof, publicSignals);

  sharedProof = {
    proof,
    publicSignals,
    encodedData,
    commitment,
    nonce: NONCE
  };

  console.log("Shared ZK proof generated");

  return sharedProof;
}

/**
 * Reset shared contracts and proofs (for cleanup)
 */
export function resetSharedContracts(): void {
  sharedContracts = null;
  sharedProof = null;
} 