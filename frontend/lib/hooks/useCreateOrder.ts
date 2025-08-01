import { useState, useCallback } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { 
  buildCommitmentOrder, 
  validateCommitmentOrder,
  type CommitmentOrderParams,
  type CommitmentOrder 
} from '../contracts/commitmentOrders'
import { generateNonce } from '../utils/commitment'
import { TOKEN_ADDRESSES } from '../constants/contracts'

interface CreateOrderState {
  isCreating: boolean
  order: CommitmentOrder | null
  error: string | null
}

interface CreateOrderParams {
  makerAsset: 'WETH' | 'USDC'
  takerAsset: 'WETH' | 'USDC'
  makingAmount: string
  takingAmount: string
  secretPrice: string
  secretAmount: string
  expiry?: number
  nonce?: bigint
}

/**
 * Hook for creating commitment orders
 */
export function useCreateOrder() {
  const { address } = useAccount()
  const chainId = useChainId()
  
  const [state, setState] = useState<CreateOrderState>({
    isCreating: false,
    order: null,
    error: null,
  })

  const createOrder = useCallback(async (params: CreateOrderParams): Promise<CommitmentOrder | null> => {
    if (!address) {
      setState(prev => ({ ...prev, error: 'Wallet not connected' }))
      return null
    }

    setState(prev => ({ ...prev, isCreating: true, error: null }))

    try {
      // Convert string amounts to BigInt
      const makingAmount = BigInt(params.makingAmount)
      const takingAmount = BigInt(params.takingAmount)
      const secretPrice = BigInt(params.secretPrice)
      const secretAmount = BigInt(params.secretAmount)
      const nonce = params.nonce || generateNonce()

      // Build commitment order parameters
      const orderParams: CommitmentOrderParams = {
        maker: address,
        makerAsset: TOKEN_ADDRESSES[params.makerAsset] as `0x${string}`,
        takerAsset: TOKEN_ADDRESSES[params.takerAsset] as `0x${string}`,
        makingAmount,
        takingAmount,
        secretParams: {
          secretPrice,
          secretAmount,
          nonce,
        },
        expiry: params.expiry,
      }

      // Validate parameters
      const validation = validateCommitmentOrder(orderParams)
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '))
      }

      // Create the commitment order
      const order = buildCommitmentOrder(orderParams)

      setState(prev => ({ 
        ...prev, 
        isCreating: false, 
        order,
        error: null 
      }))

      return order
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create order'
      setState(prev => ({ 
        ...prev, 
        isCreating: false, 
        error: errorMessage 
      }))
      return null
    }
  }, [address])

  const reset = useCallback(() => {
    setState({
      isCreating: false,
      order: null,
      error: null,
    })
  }, [])

  return {
    ...state,
    createOrder,
    reset,
    isConnected: !!address,
    userAddress: address,
    chainId,
  }
} 