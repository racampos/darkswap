import { CONTRACT_ADDRESSES } from '../constants/contracts'

export type ContractAddresses = {
  groth16Verifier: `0x${string}`
  hiddenParamPredicateZK: `0x${string}`
  aggregationRouterV6: `0x${string}`
}

/**
 * Load deployed contract addresses for the current network
 */
export async function loadDeployedAddresses(networkName: string = 'localhost'): Promise<ContractAddresses | null> {
  try {
    // In a production environment, this would fetch from a deployed addresses endpoint
    // For now, we use the hardcoded addresses from our constants
    const addresses = CONTRACT_ADDRESSES[networkName as keyof typeof CONTRACT_ADDRESSES]
    
    if (!addresses) {
      console.warn(`No contract addresses found for network: ${networkName}`)
      return null
    }

    // Validate that required contracts are deployed
    const { Groth16Verifier, HiddenParamPredicateZK, AggregationRouterV6 } = addresses.contracts

    if (!Groth16Verifier || !HiddenParamPredicateZK) {
      console.warn(`Core contracts not deployed on network: ${networkName}`)
      return null
    }

    return {
      groth16Verifier: Groth16Verifier as `0x${string}`,
      hiddenParamPredicateZK: HiddenParamPredicateZK as `0x${string}`,
      aggregationRouterV6: AggregationRouterV6 as `0x${string}`,
    }
  } catch (error) {
    console.error('Failed to load deployed addresses:', error)
    return null
  }
}

/**
 * Check if all required contracts are deployed on the given network
 */
export async function validateContractDeployment(networkName: string): Promise<boolean> {
  const addresses = await loadDeployedAddresses(networkName)
  return addresses !== null
}

/**
 * Get the API base URL for the current environment
 * Always points to port 3000 where the maker service runs
 */
export function getAPIBaseURL(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'
} 