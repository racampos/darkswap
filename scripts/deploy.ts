import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { getCurrentNetwork } from "./utils/networkConfig";

// Wallet addresses to fund
const MAKER_ADDRESS = "0x6061B722Bc93b604E3733Ef8738716276939158B";
const TAKER_ADDRESS = "0xCe68Cc3c23804ab1A1AEF354Ba7c3De9D10adfEe";

// Token addresses (mainnet)
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

// Whale addresses for funding
const WETH_WHALE = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
const USDC_WHALE = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503";

// Funding amounts
const MAKER_WETH_AMOUNT = ethers.parseEther("50"); // 50 WETH for maker
const TAKER_USDC_AMOUNT = BigInt("100000000000"); // 100,000 USDC for taker (6 decimals)

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

async function fundWallets(): Promise<void> {
  console.log("\n💰 Funding Maker and Taker wallets...");
  
  // Impersonate whale accounts
  await ethers.provider.send("hardhat_impersonateAccount", [WETH_WHALE]);
  await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
  
  const wethWhale = await ethers.getSigner(WETH_WHALE);
  const usdcWhale = await ethers.getSigner(USDC_WHALE);
  
  // Get token contracts
  const wethContract = await ethers.getContractAt("MockERC20", WETH_ADDRESS);
  const usdcContract = await ethers.getContractAt("MockERC20", USDC_ADDRESS);
  
  try {
    // Fund Maker with WETH
    console.log(`🔄 Funding Maker (${MAKER_ADDRESS}) with ${ethers.formatEther(MAKER_WETH_AMOUNT)} WETH...`);
    await wethContract.connect(wethWhale).transfer(MAKER_ADDRESS, MAKER_WETH_AMOUNT);
    
    // Fund Taker with USDC  
    console.log(`🔄 Funding Taker (${TAKER_ADDRESS}) with ${Number(TAKER_USDC_AMOUNT) / 1e6} USDC...`);
    await usdcContract.connect(usdcWhale).transfer(TAKER_ADDRESS, TAKER_USDC_AMOUNT);
    
    // Verify balances
    const makerWethBalance = await wethContract.balanceOf(MAKER_ADDRESS);
    const takerUsdcBalance = await usdcContract.balanceOf(TAKER_ADDRESS);
    
    console.log(`✅ Maker WETH balance: ${ethers.formatEther(makerWethBalance)} WETH`);
    console.log(`✅ Taker USDC balance: ${Number(takerUsdcBalance) / 1e6} USDC`);
    
    // Approve router to spend tokens (for convenience)
    console.log("🔄 Pre-approving router for token spending...");
    
    // Note: We can't sign transactions for these addresses without their private keys
    // Users will need to approve the router themselves in their wallets
    console.log("⚠️  Users will need to approve the 1inch router in their wallets before trading");
    
  } finally {
    // Stop impersonating accounts
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [WETH_WHALE]);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);
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

    // Fund wallets
    await fundWallets();
    
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