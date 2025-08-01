import { type Address } from 'viem'

// Contract addresses for different networks
export interface ContractAddresses {
  groth16Verifier: Address
  hiddenParamPredicateZK: Address
  aggregationRouterV6: Address
}

// Default contract addresses (will be overridden by deployed addresses)
export const DEFAULT_CONTRACTS: Record<number, ContractAddresses> = {
  // Localhost (forked mainnet)
  1: {
    groth16Verifier: '0x0000000000000000000000000000000000000000',
    hiddenParamPredicateZK: '0x0000000000000000000000000000000000000000',
    aggregationRouterV6: '0x111111125421ca6dc452d289314280a0f8842a65', // 1inch router on mainnet
  },
}

// Token addresses
export const TOKEN_ADDRESSES: Record<number, Record<string, Address>> = {
  1: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86a3E6441F6c1BF9c62c8C7A1E1a46a3e59e',
  },
}

// Helper function to get contract addresses for a specific chain
export function getContractAddresses(chainId: number): ContractAddresses {
  return DEFAULT_CONTRACTS[chainId] || DEFAULT_CONTRACTS[1]
}

// Helper function to get token addresses for a specific chain
export function getTokenAddresses(chainId: number): Record<string, Address> {
  return TOKEN_ADDRESSES[chainId] || TOKEN_ADDRESSES[1]
} 