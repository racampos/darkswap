import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import Groth16VerifierModule from "./Groth16Verifier";

const HiddenParamPredicateZKModule = buildModule("HiddenParamPredicateZKModule", (m) => {
  // Deploy Groth16Verifier first (dependency)
  const { verifier } = m.useModule(Groth16VerifierModule);

  // Deploy HiddenParamPredicateZK with verifier address
  const zkPredicate = m.contract("HiddenParamPredicateZK", [verifier]);

  return { zkPredicate, verifier };
});

export default HiddenParamPredicateZKModule; 