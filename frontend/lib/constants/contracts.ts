import { type Address } from 'viem'

// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  localhost: {
    chainId: 31337,
    contracts: {
      Groth16Verifier: "0xFEE2d383Ee292283eC43bdf0fa360296BE1e1149",
      HiddenParamPredicateZK: "0xf0014CBe67b3aB638bdaA2e2Cb1B531935829E50",
      AggregationRouterV6: "0x111111125421cA6dc452d289314280a0f8842A65"
    }
  },
  hardhat: {
    chainId: 31337,
    contracts: {
      Groth16Verifier: "",
      HiddenParamPredicateZK: "",
      AggregationRouterV6: "0x111111125421cA6dc452d289314280a0f8842A65"
    }
  }
} as const

// Token addresses for different networks
export const TOKEN_ADDRESSES = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
} as const

// Token addresses by chain ID (for useNetwork hook)
export const TOKEN_ADDRESSES_BY_CHAIN: Record<number, Record<string, string>> = {
  31337: { // Updated to use the new chain ID
    WETH: TOKEN_ADDRESSES.WETH,
    USDC: TOKEN_ADDRESSES.USDC,
  },
  1: { // Keep mainnet for reference
    WETH: TOKEN_ADDRESSES.WETH,
    USDC: TOKEN_ADDRESSES.USDC,
  }
}

// Get contract addresses for a specific network
export function getContractAddresses(network: string) {
  return CONTRACT_ADDRESSES[network as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES.localhost
}

// Get router address for a specific network
export function getRouterAddress(network: string): string {
  const addresses = getContractAddresses(network)
  return addresses.contracts.AggregationRouterV6
}

// Get token addresses for a specific chain ID
export function getTokenAddresses(chainId: number): Record<string, string> {
  return TOKEN_ADDRESSES_BY_CHAIN[chainId] || TOKEN_ADDRESSES_BY_CHAIN[31337]
}

// Check if contracts are deployed for a network
export function areContractsDeployed(network: string): boolean {
  const addresses = getContractAddresses(network)
  return !!(addresses.contracts.Groth16Verifier && addresses.contracts.HiddenParamPredicateZK)
} 