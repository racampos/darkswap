import { useState, useCallback } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { apiClient } from '../api/client'
import { getAPIBaseURL } from '../contracts/deployedAddresses'
import { type CommitmentOrder } from '../contracts/commitmentOrders'
import { type CreateOrderRequest, type PublishedOrder } from '../api/types'
import { OrderStatus } from '@/types'

interface PublishState {
  isPublishing: boolean
  publishedOrder: PublishedOrder | null
  isRegistering: boolean
  registrationComplete: boolean
  error: string | null
}

interface PublishOrderParams {
  order: CommitmentOrder
  signature: string
  orderHash: string
}

/**
 * Hook for publishing orders to storage and registering secrets with API
 */
export function usePublishOrder() {
  const { address } = useAccount()
  const chainId = useChainId()
  
  const [state, setState] = useState<PublishState>({
    isPublishing: false,
    publishedOrder: null,
    isRegistering: false,
    registrationComplete: false,
    error: null,
  })

  const publishOrder = useCallback(async (params: PublishOrderParams): Promise<PublishedOrder | null> => {
    if (!address) {
      setState(prev => ({ ...prev, error: 'Wallet not connected' }))
      return null
    }

    setState(prev => ({ 
      ...prev, 
      isPublishing: true, 
      isRegistering: false,
      registrationComplete: false,
      error: null 
    }))

    try {
      // Step 1: Register secrets with API service
      setState(prev => ({ ...prev, isRegistering: true }))
      
      const apiBaseUrl = getAPIBaseURL()
      const secretRegistrationResponse = await fetch(`${apiBaseUrl}/api/maker/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderHash: params.orderHash,
          commitment: params.order.commitment,
          orderParameters: {
            maker: params.order.order.maker,
            makerAsset: params.order.order.makerAsset,
            takerAsset: params.order.order.takerAsset,
            makingAmount: params.order.order.makingAmount.toString(),
            takingAmount: params.order.order.takingAmount.toString(),
            originalSalt: params.order.order.salt.toString(),
          },
          secrets: {
            secretPrice: Number(params.order.secretParams.secretPrice),
            secretAmount: Number(params.order.secretParams.secretAmount),
            nonce: Number(params.order.secretParams.nonce),
            maker: address,
          },
        }),
      })

      if (!secretRegistrationResponse.ok) {
        const errorData = await secretRegistrationResponse.json().catch(() => ({ error: 'Registration failed' }))
        console.warn('Secret registration failed:', errorData)
      }

      setState(prev => ({ ...prev, isRegistering: false, registrationComplete: true }))

      // Step 2: Publish order to storage
      const createOrderRequest: CreateOrderRequest = {
        chainId: chainId,
        order: {
          salt: params.order.order.salt.toString(),
          maker: params.order.order.maker,
          receiver: params.order.order.receiver,
          makerAsset: params.order.order.makerAsset,
          takerAsset: params.order.order.takerAsset,
          makingAmount: params.order.order.makingAmount.toString(),
          takingAmount: params.order.order.takingAmount.toString(),
          makerTraits: params.order.order.makerTraits.toString(),
        },
        signature: params.signature,
        extension: params.order.order.extension,
        commitment: params.order.commitment, // ✅ Include the frontend-calculated commitment
        metadata: {
          makerToken: {
            address: params.order.order.makerAsset,
            symbol: 'WETH', // TODO: Get from token addresses mapping
            name: 'Wrapped Ether',
            decimals: 18,
          },
          takerToken: {
            address: params.order.order.takerAsset,
            symbol: 'USDC',
            name: 'USD Coin', 
            decimals: 6,
          },
          rate: Number(params.order.order.takingAmount) / Number(params.order.order.makingAmount),
          maker: address,
          network: 'localhost',
        },
        secrets: {
          secretPrice: Number(params.order.secretParams.secretPrice),
          secretAmount: Number(params.order.secretParams.secretAmount),
          nonce: Number(params.order.secretParams.nonce),
        },
      }

      console.log('📝 Publishing order:', createOrderRequest)

      const publishResponse = await fetch(`${apiBaseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createOrderRequest),
      })

      if (!publishResponse.ok) {
        const errorData = await publishResponse.json().catch(() => ({ error: 'Failed to publish order' }))
        throw new Error(errorData.error || `HTTP ${publishResponse.status}: Failed to publish order`)
      }

      const publishResult = await publishResponse.json()

      if (!publishResult.success) {
        throw new Error(publishResult.error || 'Order publishing failed')
      }

      // Create a simplified published order object
      const publishedOrder: PublishedOrder = {
        id: publishResult.orderId || publishResult.id || 'unknown',
        chainId: chainId || 1,
        order: createOrderRequest.order,
        signature: params.signature,
        extension: params.order.order.extension,
        metadata: createOrderRequest.metadata,
        secrets: createOrderRequest.secrets,
        status: OrderStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      setState(prev => ({ 
        ...prev, 
        isPublishing: false, 
        publishedOrder,
        error: null 
      }))

      return publishedOrder
    } catch (error: any) {
      console.error('❌ Order publishing error:', error)
      
      // Ensure error message is a string
      let errorMessage = 'Failed to publish order'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        errorMessage = error.message || error.error || JSON.stringify(error)
      }
      
      setState(prev => ({ 
        ...prev, 
        isPublishing: false, 
        isRegistering: false,
        error: errorMessage 
      }))
      return null
    }
  }, [address, chainId])

  const reset = useCallback(() => {
    setState({
      isPublishing: false,
      publishedOrder: null,
      isRegistering: false,
      registrationComplete: false,
      error: null,
    })
  }, [])

  return {
    ...state,
    publishOrder,
    reset,
    isConnected: !!address,
    userAddress: address,
    chainId,
  }
} 