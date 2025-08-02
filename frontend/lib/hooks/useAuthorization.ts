'use client'

import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { type Address } from 'viem'
import { apiClient } from '@/lib/api/client'
import { type AuthorizeFillResponse, type PublishedOrder } from '@/lib/api/types'

interface AuthorizationState {
  isAuthorizing: boolean
  isAuthorized: boolean
  authorization: AuthorizeFillResponse | null
  error: string | null
  authorizationTime: number | null
}

interface UseAuthorizationResult extends AuthorizationState {
  requestAuthorization: (order: PublishedOrder, fillAmount: string) => Promise<void>
  clearAuthorization: () => void
  isAuthorizationValid: () => boolean
}

/**
 * Hook for managing ZK authorization requests for order filling
 */
export function useAuthorization(): UseAuthorizationResult {
  const { address } = useAccount()
  const [state, setState] = useState<AuthorizationState>({
    isAuthorizing: false,
    isAuthorized: false,
    authorization: null,
    error: null,
    authorizationTime: null
  })

  const requestAuthorization = useCallback(async (
    order: PublishedOrder,
    fillAmount: string
  ) => {
    if (!address) {
      setState(prev => ({
        ...prev,
        error: 'Wallet not connected'
      }))
      return
    }

    setState(prev => ({
      ...prev,
      isAuthorizing: true,
      error: null,
      isAuthorized: false,
      authorization: null
    }))

    try {
      console.log('🔐 Requesting authorization for order fill:', {
        orderHash: order.id,
        fillAmount,
        takerAddress: address
      })

      const authorization = await apiClient.authorizeFill({
        orderHash: order.id,
        fillAmount,
        takerAddress: address
      })

      console.log('✅ Authorization received:', {
        success: authorization.success,
        hasSignature: !!authorization.signature,
        hasOrderData: !!authorization.orderWithExtension
      })

      setState(prev => ({
        ...prev,
        isAuthorizing: false,
        isAuthorized: authorization.success,
        authorization: authorization.success ? authorization : null,
        authorizationTime: Date.now(),
        error: authorization.success ? null : (authorization.message || 'Authorization failed')
      }))

    } catch (error: any) {
      console.error('❌ Authorization request failed:', error)
      
      setState(prev => ({
        ...prev,
        isAuthorizing: false,
        isAuthorized: false,
        authorization: null,
        error: error.message || 'Failed to request authorization'
      }))
    }
  }, [address])

  const clearAuthorization = useCallback(() => {
    setState({
      isAuthorizing: false,
      isAuthorized: false,
      authorization: null,
      error: null,
      authorizationTime: null
    })
  }, [])

  const isAuthorizationValid = useCallback(() => {
    if (!state.isAuthorized || !state.authorization || !state.authorizationTime) {
      return false
    }

    // Authorization expires after 10 minutes
    const expirationTime = 10 * 60 * 1000
    const isExpired = Date.now() - state.authorizationTime > expirationTime

    if (isExpired) {
      console.warn('⚠️ Authorization has expired')
      return false
    }

    return true
  }, [state.isAuthorized, state.authorization, state.authorizationTime])

  return {
    ...state,
    requestAuthorization,
    clearAuthorization,
    isAuthorizationValid
  }
} 