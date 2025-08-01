import { useState, useCallback } from 'react'
import { useAccount, useChainId, useConfig } from 'wagmi'
import { signCommitmentOrder, validateSignature } from '../utils/signing'
import { calculateOrderHash } from '../utils/signing'
import { getRouterAddress } from '../constants/contracts'
import { type OrderStruct } from '../contracts/commitmentOrders'

interface SigningState {
  isSigning: boolean
  signature: string | null
  orderHash: string | null
  error: string | null
}

/**
 * Hook for signing commitment orders
 */
export function useOrderSigning() {
  const { address } = useAccount()
  const chainId = useChainId()
  const config = useConfig()
  
  const [state, setState] = useState<SigningState>({
    isSigning: false,
    signature: null,
    orderHash: null,
    error: null,
  })

  const signOrder = useCallback(async (order: OrderStruct): Promise<{ signature: string; orderHash: string } | null> => {
    if (!address) {
      setState(prev => ({ ...prev, error: 'Wallet not connected' }))
      return null
    }

    if (!chainId) {
      setState(prev => ({ ...prev, error: 'Chain ID not available' }))
      return null
    }

    setState(prev => ({ ...prev, isSigning: true, error: null }))

    try {
      // Get router address for the current network
      const routerAddress = getRouterAddress('localhost') as `0x${string}`
      
      // Calculate order hash
      const orderHash = calculateOrderHash(order, chainId, routerAddress)
      
      // Sign the order
      const signature = await signCommitmentOrder(order, chainId, routerAddress, config)
      
      // Validate signature format
      const validation = validateSignature(signature)
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid signature format')
      }

      setState(prev => ({ 
        ...prev, 
        isSigning: false, 
        signature,
        orderHash,
        error: null 
      }))

      return { signature, orderHash }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign order'
      setState(prev => ({ 
        ...prev, 
        isSigning: false, 
        error: errorMessage 
      }))
      return null
    }
  }, [address, chainId, config])

  const reset = useCallback(() => {
    setState({
      isSigning: false,
      signature: null,
      orderHash: null,
      error: null,
    })
  }, [])

  return {
    ...state,
    signOrder,
    reset,
    isConnected: !!address,
    userAddress: address,
    chainId,
  }
} 