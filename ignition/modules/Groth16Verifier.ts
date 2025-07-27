// Hardhat Ignition deployment module for Groth16Verifier contract
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Groth16VerifierModule = buildModule("Groth16VerifierModule", (m) => {
  // Deploy the Groth16Verifier contract (no constructor parameters needed)
  const verifier = m.contract("Groth16Verifier", []);

  return { verifier };
});

export default Groth16VerifierModule; 