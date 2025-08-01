import { type NetworkConfig } from '@/types'

export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  1: {
    chainId: 1,
    name: 'Localhost (Forked Mainnet)',
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorer: 'https://etherscan.io',
    routerAddress: '0x111111125421ca6dc452d289314280a0f8842a65',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
}

export const DEFAULT_NETWORK_ID = 1

export function getNetworkConfig(chainId: number): NetworkConfig | null {
  return SUPPORTED_NETWORKS[chainId] || null
}

export function isSupportedNetwork(chainId: number): boolean {
  return chainId in SUPPORTED_NETWORKS
}

export function getAllSupportedNetworks(): NetworkConfig[] {
  return Object.values(SUPPORTED_NETWORKS)
} 