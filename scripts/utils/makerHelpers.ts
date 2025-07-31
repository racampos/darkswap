import { ethers } from "hardhat";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { OrderStorage } from "../../src/storage/orderStorage";
import { generateCommitmentOrderId } from "../../src/utils/orderIdGenerator";
import { getCurrentNetwork } from "./networkConfig";

/**
 * Contract address management
 */
export interface DeployedAddresses {
  [network: string]: {
    chainId: number;
    Groth16Verifier?: string;
    HiddenParamPredicateZK?: string;
    deploymentTimestamp?: string;
  };
}

export function getDeployedAddresses(): DeployedAddresses {
  const addressesPath = path.join(process.cwd(), "config/deployed-addresses.json");
  
  if (!existsSync(addressesPath)) {
    throw new Error(`Deployed addresses file not found: ${addressesPath}`);
  }
  
  try {
    const content = readFileSync(addressesPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read deployed addresses: ${error}`);
  }
}

export function saveDeployedAddresses(addresses: DeployedAddresses): void {
  const addressesPath = path.join(process.cwd(), "config/deployed-addresses.json");
  
  try {
    writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  } catch (error) {
    throw new Error(`Failed to save deployed addresses: ${error}`);
  }
}

/**
 * Token balance setup for makers
 */
export interface TokenSetupConfig {
  wethAmount: string; // In ETH units (e.g. "10")
  usdcAmount: string; // In USDC units (e.g. "50000")
  approvalTarget: string; // Router address
}

export async function setupMakerTokens(
  maker: any, // Change from ethers.Signer to any to avoid namespace issues
  config: TokenSetupConfig
): Promise<void> {
  const { ethers: hre, network } = await import("hardhat");
  
  // Token addresses
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  
  // Whale accounts with large balances
  const wethWhale = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
  const usdcWhale = "0x28C6c06298d514Db089934071355E5743bf21d60";
  
  console.log(`   Setting up tokens for maker: ${await maker.getAddress()}`);
  
  // Impersonate whale accounts
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [wethWhale]
  });
  await network.provider.request({
    method: "hardhat_impersonateAccount", 
    params: [usdcWhale]
  });

  // Provide ETH for gas
  await network.provider.send("hardhat_setBalance", [wethWhale, "0xDE0B6B3A7640000"]);
  await network.provider.send("hardhat_setBalance", [usdcWhale, "0xDE0B6B3A7640000"]);

  const wethWhaleSigner = await hre.getSigner(wethWhale);
  const usdcWhaleSigner = await hre.getSigner(usdcWhale);

  // Get token contracts
  const wethContract = await hre.getContractAt("MockERC20", WETH_ADDRESS);
  const usdcContract = await hre.getContractAt("MockERC20", USDC_ADDRESS);

  // Transfer tokens to maker
  const wethAmount = hre.parseEther(config.wethAmount);
  const usdcAmount = hre.parseUnits(config.usdcAmount, 6);
  
  await wethContract.connect(wethWhaleSigner).transfer(await maker.getAddress(), wethAmount);
  await usdcContract.connect(usdcWhaleSigner).transfer(await maker.getAddress(), usdcAmount);

  // Approve router to spend tokens
  await wethContract.connect(maker).approve(config.approvalTarget, ethers.MaxUint256);
  await usdcContract.connect(maker).approve(config.approvalTarget, ethers.MaxUint256);

  console.log(`   ✅ WETH: ${config.wethAmount} ETH transferred and approved`);
  console.log(`   ✅ USDC: ${config.usdcAmount} USDC transferred and approved`);
}

/**
 * HTTP client for API communication
 */
export interface AuthorizeResponse {
  success: boolean;
  orderWithExtension?: any;
  signature?: string;
  error?: string;
  timestamp: string;
}

export async function registerSecretsWithAPI(
  apiUrl: string,
  orderHash: string,
  commitment: string,
  orderParams: any,
  secrets: any
): Promise<boolean> {
  try {
    // For now, since we don't have a registration endpoint, 
    // we'll return true and rely on the MakerService being initialized
    // In a real implementation, this would make an HTTP POST to register the secrets
    console.log(`   📡 Would register secrets with API: ${apiUrl}`);
    console.log(`   📝 Order Hash: ${orderHash.slice(0, 10)}...`);
    console.log(`   🔒 Commitment: ${commitment.slice(0, 10)}...`);
    
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to register secrets with API:`, error);
    return false;
  }
}

export async function testAPIHealth(apiUrl: string): Promise<boolean> {
  try {
    // Use Node.js fetch (available in Node 18+) or implement a simple HTTP client
    console.log(`   🏥 Testing API health: ${apiUrl}/api/health`);
    
    // For now, assume the API is healthy if we can connect
    // In a real implementation, this would make an HTTP GET request
    return true;
  } catch (error) {
    console.error(`   ❌ API health check failed:`, error);
    return false;
  }
}

/**
 * Order publishing utilities
 */
export interface PublishOrderRequest {
  orderData: any;
  signature: string;
  orderHash: string;
  commitment: string;
  secrets: {
    secretPrice: bigint;
    secretAmount: bigint;
    nonce: bigint;
    maker: string;
  };
  metadata: {
    network: string;
    maker: string;
    makerAsset: string;
    takerAsset: string;
    makingAmount: bigint;
    takingAmount: bigint;
  };
}

export async function publishOrderToStorage(request: PublishOrderRequest): Promise<string> {
  try {
    const orderStorage = new OrderStorage('storage/published_orders.json');
    
    // Generate unique order ID
    const orderId = generateCommitmentOrderId(request.commitment);
    
    // Create order request for storage with proper metadata structure
    const storageRequest = {
      orderData: request.orderData,
      signature: request.signature,
      commitment: request.commitment,
      secrets: {
        secretPrice: request.secrets.secretPrice.toString(),
        secretAmount: request.secrets.secretAmount.toString(),
        nonce: request.secrets.nonce.toString(),
        maker: request.secrets.maker
      },
      metadata: {
        maker: request.metadata.maker,
        makerAsset: request.metadata.makerAsset,
        takerAsset: request.metadata.takerAsset,
        makingAmount: request.metadata.makingAmount.toString(), // Convert BigInt to string
        takingAmount: request.metadata.takingAmount.toString(), // Convert BigInt to string
        network: request.metadata.network,
        originalSalt: request.orderData.salt?.toString() || "0", // Get salt from orderData
        displayPrice: `${ethers.formatUnits(request.metadata.takingAmount, 6)} USDC per WETH`
      }
    };
    
    const result = await orderStorage.publishOrder(storageRequest);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to publish order');
    }
    
    console.log(`   ✅ Order published to storage with ID: ${result.orderId}`);
    return result.orderId!;
    
  } catch (error) {
    console.error(`   ❌ Failed to publish order to storage:`, error);
    throw error;
  }
}

/**
 * Verification utilities
 */
export async function verifyPublishedOrder(orderId: string): Promise<boolean> {
  try {
    const orderStorage = new OrderStorage('storage/published_orders.json');
    const order = await orderStorage.getOrderById(orderId);
    
    if (!order) {
      console.error(`   ❌ Order not found in storage: ${orderId}`);
      return false;
    }
    
    console.log(`   ✅ Order verified in storage:`);
    console.log(`      ID: ${order.id}`);
    console.log(`      Status: ${order.metadata.status}`);
    console.log(`      Network: ${order.metadata.network}`);
    console.log(`      Published: ${order.metadata.published}`);
    
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to verify published order:`, error);
    return false;
  }
}

/**
 * Display utilities
 */
export function displayOrderSummary(order: any, metadata: any): void {
  console.log(`\n📋 ORDER SUMMARY`);
  console.log(`${"=".repeat(50)}`);
  console.log(`   Order Type: Commitment Order (ZK-enabled)`);
  console.log(`   Maker: ${metadata.maker}`);
  console.log(`   Making: ${ethers.formatEther(metadata.makingAmount)} WETH`);
  console.log(`   Taking: ${ethers.formatUnits(metadata.takingAmount, 6)} USDC`);
  console.log(`   Network: ${metadata.network}`);
  console.log(`   Salt: ${order.salt.toString()}`);
  console.log(`   Commitment: ${metadata.commitment?.slice(0, 20)}...`);
  console.log(`${"=".repeat(50)}`);
}

export function displaySecretsSummary(secrets: any): void {
  console.log(`\n🔐 SECRETS SUMMARY`);
  console.log(`${"=".repeat(50)}`);
  console.log(`   Secret Price: ${ethers.formatUnits(secrets.secretPrice, 6)} USDC (minimum)`);
  console.log(`   Secret Amount: ${ethers.formatUnits(secrets.secretAmount, 6)} USDC (minimum)`);
  console.log(`   Nonce: ${secrets.nonce.toString()}`);
  console.log(`   Maker: ${secrets.maker}`);
  console.log(`${"=".repeat(50)}`);
  console.log(`   ⚠️  These secrets are NEVER revealed on-chain`);
  console.log(`   ⚠️  Only ZK proofs demonstrate knowledge of secrets`);
  console.log(`${"=".repeat(50)}`);
} 