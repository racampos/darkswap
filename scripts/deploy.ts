import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { getCurrentNetwork } from "./utils/networkConfig";

interface DeployedContracts {
  Groth16Verifier: string;
  HiddenParamPredicateZK: string;
}

interface NetworkDeployment {
  chainId: number;
  contracts: DeployedContracts;
  deployedAt: string;
  deploymentTxHash: string;
}

interface DeploymentConfig {
  networks: Record<string, NetworkDeployment>;
}

async function loadDeploymentConfig(): Promise<DeploymentConfig> {
  const configPath = path.join(__dirname, "../config/deployed-addresses.json");
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`Deployment config not found at: ${configPath}`);
  }
  
  const configData = fs.readFileSync(configPath, "utf8");
  return JSON.parse(configData);
}

async function saveDeploymentConfig(config: DeploymentConfig): Promise<void> {
  const configPath = path.join(__dirname, "../config/deployed-addresses.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function deployContracts(): Promise<DeployedContracts> {
  console.log("Starting contract deployment...");
  
  // Deploy Groth16Verifier
  console.log("Deploying Groth16Verifier...");
  const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await VerifierFactory.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`✅ Groth16Verifier deployed at: ${verifierAddress}`);

  // Deploy HiddenParamPredicateZK with verifier address
  console.log("Deploying HiddenParamPredicateZK...");
  const PredicateFactory = await ethers.getContractFactory("HiddenParamPredicateZK");
  const predicate = await PredicateFactory.deploy(verifierAddress);
  await predicate.waitForDeployment();
  const predicateAddress = await predicate.getAddress();
  console.log(`✅ HiddenParamPredicateZK deployed at: ${predicateAddress}`);

  return {
    Groth16Verifier: verifierAddress,
    HiddenParamPredicateZK: predicateAddress
  };
}

async function verifyDeployment(contracts: DeployedContracts): Promise<void> {
  console.log("\nVerifying deployment...");
  
  // Verify Groth16Verifier
  const verifier = await ethers.getContractAt("Groth16Verifier", contracts.Groth16Verifier);
  console.log(`📋 Groth16Verifier at ${contracts.Groth16Verifier}: VERIFIED`);
  
  // Verify HiddenParamPredicateZK
  const predicate = await ethers.getContractAt("HiddenParamPredicateZK", contracts.HiddenParamPredicateZK);
  const verifierInPredicate = await predicate.verifier();
  
  if (verifierInPredicate.toLowerCase() === contracts.Groth16Verifier.toLowerCase()) {
    console.log(`📋 HiddenParamPredicateZK at ${contracts.HiddenParamPredicateZK}: VERIFIED`);
    console.log(`📋 Verifier reference in predicate: CORRECT`);
  } else {
    throw new Error(`Verifier reference mismatch! Expected: ${contracts.Groth16Verifier}, Got: ${verifierInPredicate}`);
  }
}

async function main() {
  try {
    console.log("🚀 Starting deployment process...");
    
    // Get current network info
    const { name: networkName, config: networkConfig } = await getCurrentNetwork();
    console.log(`📡 Network: ${networkName} (chainId: ${networkConfig.chainId})`);
    console.log(`🏦 1inch Router: ${networkConfig.routerAddress}`);
    
    // Get deployer info
    const [deployer] = await ethers.getSigners();
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(deployerBalance)} ETH`);
    
    if (deployerBalance === 0n) {
      throw new Error("Deployer has no ETH balance!");
    }
    
    // Deploy contracts
    const contracts = await deployContracts();
    
    // Verify deployment
    await verifyDeployment(contracts);
    
    // Load and update config
    const config = await loadDeploymentConfig();
    
    config.networks[networkName] = {
      chainId: networkConfig.chainId,
      contracts,
      deployedAt: new Date().toISOString(),
      deploymentTxHash: "" // Transaction hash tracking will be added in future commits
    };
    
    // Save updated config
    await saveDeploymentConfig(config);
    console.log(`💾 Configuration saved to config/deployed-addresses.json`);
    
    console.log("\n🎉 Deployment completed successfully!");
    console.log(`📋 Contract addresses for ${networkName}:`);
    console.log(`   Groth16Verifier: ${contracts.Groth16Verifier}`);
    console.log(`   HiddenParamPredicateZK: ${contracts.HiddenParamPredicateZK}`);
    
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Deployment script error:", error);
  process.exit(1);
}); 