/**
 * ZK Basic Integration Test - Reference Implementation
 * 
 * Validates the complete ZK order workflow using the proven working pattern:
 * 1. Generate commitment using Poseidon hash
 * 2. Create ZK proof with circuit
 * 3. Build 1inch extension with gt() wrapper
 * 4. Create order with packed salt
 * 
 * This test serves as both validation and reference implementation for
 * ZK-enabled 1inch limit orders. The pattern demonstrated here is known
 * to work correctly with the 1inch protocol.
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { buildMakerTraits, buildTakerTraits, signOrder, buildOrder } from "./helpers/orderUtils";
import { getSharedZKContracts, getSharedZKProof } from "./helpers/sharedContracts";

describe("ZK Basic Integration - Reference Implementation", function () {
  let deployer: HardhatEthersSigner;
  let maker: HardhatEthersSigner;  
  let taker: HardhatEthersSigner;
  let groth16Verifier: any;
  let hiddenParamPredicate: any;

  // Mainnet addresses
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

  before(async function () {
    [deployer, maker, taker] = await ethers.getSigners();
    
    // Use shared ZK contracts for consistent addresses
    const contracts = await getSharedZKContracts();
    groth16Verifier = contracts.groth16Verifier;
    hiddenParamPredicate = contracts.hiddenParamPredicate;
  });

  it("should demonstrate working ZK order integration pattern", async function () {
    // Use shared proof for deterministic testing
    const sharedProof = await getSharedZKProof();
    const { encodedData: proofData, commitment, nonce } = sharedProof;
    
    expect(sharedProof.publicSignals).to.have.length(5);
    expect(sharedProof.publicSignals[0]).to.equal('1'); // Valid proof indicator
    
    // Verify predicate returns success (1)
    const predicateResult = await hiddenParamPredicate.predicate(proofData);
    expect(predicateResult).to.equal(1, "Predicate should return 1 for valid proof");
    
    // Build 1inch extension using proven pattern
    const predicateAddress = await hiddenParamPredicate.getAddress();
    const AggregationRouterV6ABI = require("../abi/AggregationRouterV6.json");
    const routerInterface = new ethers.Interface(AggregationRouterV6ABI);
    
    // Create predicate call
    const predicateCalldata = hiddenParamPredicate.interface.encodeFunctionData("predicate", [proofData]);
    const arbitraryCall = routerInterface.encodeFunctionData("arbitraryStaticCall", [
      predicateAddress,
      predicateCalldata
    ]);
    
    // Wrap in gt() for boolean result
    const predicate = routerInterface.encodeFunctionData("gt", [
      0, // Check if result > 0 (i.e., equals 1)
      arbitraryCall
    ]);
    
    // Create order with extension
    const makerTraits = buildMakerTraits({
      allowPartialFill: true,
      allowMultipleFills: false
    });
    
    const orderParams = {
      maker: maker.address,
      makerAsset: WETH_ADDRESS,
      takerAsset: USDC_ADDRESS,
      makingAmount: ethers.parseEther("5"), // 5 WETH
      takingAmount: BigInt("17500000000"), // 17,500 USDC
      makerTraits: makerTraits
    };
    
    const order = buildOrder(orderParams, {
      predicate: predicate
    });
    
    // Pack commitment into salt (critical for ZK verification)
    const extensionHash = ethers.keccak256(predicate);
    const commitHashTruncated = commitment & ((1n << 96n) - 1n);
    const commitHashShifted = commitHashTruncated << 160n;
    const extensionHashLower = BigInt(extensionHash) & ((1n << 160n) - 1n);
    order.salt = commitHashShifted | extensionHashLower;
    
    // Validate final order structure
    expect(order.extension).to.have.length.greaterThan(1000, "Extension should contain ZK predicate");
    expect(order.salt).to.be.greaterThan(0n, "Salt should be packed with commitment");
    
    // Create taker traits for potential filling
    const takerTraits = buildTakerTraits({
      makingAmount: false, // Taking amount based fill
      threshold: 0n,
      extension: predicate,
      target: taker.address,
      interaction: "0x"
    });
    
    expect(takerTraits.args).to.have.length.greaterThan(1000, "Taker args should contain extension");
    
    console.log("ZK integration pattern validated successfully");
    console.log(`   Order salt: 0x${order.salt.toString(16)}`);
    console.log(`   Extension length: ${order.extension.length} chars`);
  });
}); 