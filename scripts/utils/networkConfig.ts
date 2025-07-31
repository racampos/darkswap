import { ethers } from "hardhat";

export interface NetworkConfig {
  url: string;
  chainId: number;
  routerAddress: string;
  name: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  localhost: {
    url: "http://127.0.0.1:8545",
    chainId: 1, // Matches forked mainnet chain ID
    routerAddress: "0x111111125421cA6dc452d289314280a0f8842A65", // 1inch AggregationRouterV6
    name: "localhost"
  },
  hardhat: {
    url: "hardhat",
    chainId: 1, // Forked mainnet
    routerAddress: "0x111111125421cA6dc452d289314280a0f8842A65", // 1inch AggregationRouterV6
    name: "hardhat"
  }
};

export function getNetworkConfig(networkName: string): NetworkConfig {
  const config = NETWORKS[networkName];
  if (!config) {
    throw new Error(`Network configuration not found for: ${networkName}`);
  }
  return config;
}

export async function getCurrentNetwork(): Promise<{ name: string; config: NetworkConfig }> {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  
  // Find network by chainId
  const networkEntry = Object.entries(NETWORKS).find(([, config]) => config.chainId === chainId);
  
  if (!networkEntry) {
    throw new Error(`Unknown network with chainId: ${chainId}`);
  }
  
  return {
    name: networkEntry[0],
    config: networkEntry[1]
  };
}

export function getRouterAddress(networkName?: string): string {
  if (networkName) {
    return getNetworkConfig(networkName).routerAddress;
  }
  
  // Default to localhost for demo purposes
  return NETWORKS.localhost.routerAddress;
} 