'use client'

import { useAccount, useNetwork as useWagmiNetwork, useSwitchNetwork } from 'wagmi'
import { useMemo } from 'react'
import { getNetworkConfig, isSupportedNetwork, DEFAULT_NETWORK_ID } from '@/lib/constants/networks'
import { getContractAddresses, getTokenAddresses } from '@/lib/constants/contracts'
import { type NetworkConfig } from '@/types'

export function useNetwork() {
  const { address, isConnected } = useAccount()
  const { chain } = useWagmiNetwork()
  const { switchNetwork, isLoading: isSwitching, error: switchError } = useSwitchNetwork()

  const currentChainId = chain?.id || DEFAULT_NETWORK_ID
  const isSupported = isSupportedNetwork(currentChainId)
  const networkConfig = getNetworkConfig(currentChainId)
  
  const contracts = useMemo(() => {
    return getContractAddresses(currentChainId)
  }, [currentChainId])

  const tokens = useMemo(() => {
    return getTokenAddresses(currentChainId)
  }, [currentChainId])

  const switchToNetwork = async (chainId: number) => {
    if (!switchNetwork) {
      throw new Error('Network switching not available')
    }
    
    if (!isSupportedNetwork(chainId)) {
      throw new Error(`Network ${chainId} is not supported`)
    }
    
    try {
      await switchNetwork(chainId)
    } catch (error) {
      console.error('Failed to switch network:', error)
      throw error
    }
  }

  const switchToSupported = async () => {
    await switchToNetwork(DEFAULT_NETWORK_ID)
  }

  return {
    // Current network state
    chainId: currentChainId,
    chain,
    networkConfig,
    isSupported,
    isConnected,
    address,
    
    // Contract and token addresses
    contracts,
    tokens,
    
    // Network switching
    switchToNetwork,
    switchToSupported,
    isSwitching,
    switchError,
    canSwitch: !!switchNetwork,
    
    // Helper methods
    getTokenAddress: (symbol: string) => tokens[symbol],
    isCorrectNetwork: () => isSupported && isConnected,
    needsNetworkSwitch: () => isConnected && !isSupported,
  }
}

// Hook for network status indicator
export function useNetworkStatus() {
  const { 
    isSupported, 
    isConnected, 
    chainId, 
    networkConfig, 
    isSwitching,
    needsNetworkSwitch 
  } = useNetwork()

  const getStatus = (): 'connected' | 'wrong-network' | 'disconnected' | 'switching' => {
    if (isSwitching) return 'switching'
    if (!isConnected) return 'disconnected'
    if (!isSupported) return 'wrong-network'
    return 'connected'
  }

  const getStatusColor = (): 'green' | 'yellow' | 'red' | 'blue' => {
    const status = getStatus()
    switch (status) {
      case 'connected': return 'green'
      case 'switching': return 'blue'
      case 'wrong-network': return 'yellow'
      case 'disconnected': return 'red'
      default: return 'red'
    }
  }

  const getStatusMessage = (): string => {
    const status = getStatus()
    switch (status) {
      case 'connected':
        return `Connected to ${networkConfig?.name || 'Unknown Network'}`
      case 'switching':
        return 'Switching network...'
      case 'wrong-network':
        return `Unsupported network (Chain ID: ${chainId}). Please switch to a supported network.`
      case 'disconnected':
        return 'Wallet not connected'
      default:
        return 'Unknown network status'
    }
  }

  return {
    status: getStatus(),
    color: getStatusColor(),
    message: getStatusMessage(),
    needsAction: needsNetworkSwitch(),
    isHealthy: isConnected && isSupported,
  }
}

// Hook for network requirements validation
export function useNetworkRequirements() {
  const { isConnected, isSupported, switchToSupported, isSwitching } = useNetwork()

  const checkRequirements = (): {
    isValid: boolean
    errors: string[]
    canProceed: boolean
  } => {
    const errors: string[] = []
    
    if (!isConnected) {
      errors.push('Wallet not connected')
    }
    
    if (isConnected && !isSupported) {
      errors.push('Please switch to a supported network')
    }
    
    const isValid = errors.length === 0
    const canProceed = isValid && !isSwitching
    
    return { isValid, errors, canProceed }
  }

  const requirements = checkRequirements()

  return {
    ...requirements,
    fixNetworkIssues: switchToSupported,
    isFixing: isSwitching,
  }
} 