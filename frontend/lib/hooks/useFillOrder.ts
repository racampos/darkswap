'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { type Address } from 'viem'
import { useAuthorization } from './useAuthorization'
import { useTransaction } from './useTransaction'
import { type PublishedOrder } from '@/lib/api/types'
import { validateFillAmount, canFillOrder, formatExecutionSummary } from '@/lib/utils/orderExecution'

enum FillOrderState {
  IDLE = 'idle',
  VALIDATING = 'validating',
  AUTHORIZING = 'authorizing',
  READY_TO_EXECUTE = 'ready_to_execute',
  EXECUTING = 'executing',
  SUCCESS = 'success',
  FAILED = 'failed'
}

interface FillOrderHookState {
  state: FillOrderState
  order: PublishedOrder | null
  fillAmount: string
  executionSummary: any | null
  canFill: boolean
  fillReason: string | null
  error: string | null
}

interface UseFillOrderResult extends FillOrderHookState {
  // Order setup
  setOrder: (order: PublishedOrder) => void
  setFillAmount: (amount: string) => void
  clearOrder: () => void
  
  // Actions
  requestAuthorization: () => Promise<void>
  executeOrder: () => Promise<void>
  resetFlow: () => void
  
  // State from sub-hooks
  authorization: ReturnType<typeof useAuthorization>
  transaction: ReturnType<typeof useTransaction>
  
  // Validation
  isValidFillAmount: boolean
  validationError: string | null
}

/**
 * Main hook for order filling that orchestrates the entire flow
 */
export function useFillOrder(): UseFillOrderResult {
  const { address } = useAccount()
  const authorization = useAuthorization()
  const transaction = useTransaction()
  
  // Simple state - no complex interdependencies
  const [order, setOrderState] = useState<PublishedOrder | null>(null)
  const [fillAmount, setFillAmountState] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // All computed values to avoid infinite loops
  const executionSummary = useMemo(() => {
    return order && fillAmount ? formatExecutionSummary(order, fillAmount) : null
  }, [order, fillAmount])

  const fillEligibility = useMemo(() => {
    return order ? canFillOrder(order, address) : { canFill: false, reason: null }
  }, [order, address])

  const currentState = useMemo(() => {
    if (authorization.isAuthorizing) return FillOrderState.AUTHORIZING
    if (authorization.isAuthorized && authorization.isAuthorizationValid()) return FillOrderState.READY_TO_EXECUTE
    if (transaction.isLoading) return FillOrderState.EXECUTING
    if (transaction.state === 'success') return FillOrderState.SUCCESS
    if (authorization.error || transaction.error) return FillOrderState.FAILED
    return FillOrderState.IDLE
  }, [
    authorization.isAuthorizing,
    authorization.isAuthorized,
    authorization.error,
    transaction.isLoading,
    transaction.state,
    transaction.error,
    authorization.isAuthorizationValid
  ])

  const isValidFillAmount = useMemo(() => {
    return order && fillAmount ? validateFillAmount(order, fillAmount).isValid : false
  }, [order, fillAmount])

  const validationError = useMemo(() => {
    return order && fillAmount ? validateFillAmount(order, fillAmount).error || null : null
  }, [order, fillAmount])

  // Simple actions without complex state updates
  const setOrder = useCallback((newOrder: PublishedOrder) => {
    setOrderState(newOrder)
    setFillAmountState('')
    setError(null)
    authorization.clearAuthorization()
    transaction.resetTransaction()
  }, []) // Empty dependency array since we don't need to recreate this function

  const setFillAmount = useCallback((amount: string) => {
    setFillAmountState(amount)
  }, [])

  const clearOrder = useCallback(() => {
    setOrderState(null)
    setFillAmountState('')
    setError(null)
    authorization.clearAuthorization()
    transaction.resetTransaction()
  }, []) // Empty dependency array

  const requestAuthorization = useCallback(async () => {
    if (!order || !fillAmount) {
      setError('Order and fill amount required')
      return
    }

    if (!fillEligibility.canFill) {
      setError(fillEligibility.reason || 'Cannot fill this order')
      return
    }

    const validation = validateFillAmount(order, fillAmount)
    if (!validation.isValid) {
      setError(validation.error || 'Invalid fill amount')
      return
    }

    setError(null)
    await authorization.requestAuthorization(order, fillAmount)
  }, [order, fillAmount, fillEligibility.canFill, fillEligibility.reason])

  const executeOrder = useCallback(async () => {
    if (!authorization.isAuthorized || !authorization.authorization) {
      setError('Authorization required before execution')
      return
    }

    if (!authorization.isAuthorizationValid()) {
      setError('Authorization has expired. Please request new authorization.')
      return
    }

    setError(null)
    await transaction.executeTransaction(authorization.authorization)
  }, [authorization.isAuthorized, authorization.authorization, authorization.isAuthorizationValid])

  const resetFlow = useCallback(() => {
    setError(null)
    authorization.clearAuthorization()
    transaction.resetTransaction()
  }, []) // Empty dependency array

  // Return computed state object
  const state = {
    state: currentState,
    order,
    fillAmount,
    executionSummary,
    canFill: fillEligibility.canFill,
    fillReason: fillEligibility.reason || null,
    error: error || authorization.error || transaction.error
  }

  return {
    ...state,
    setOrder,
    setFillAmount,
    clearOrder,
    requestAuthorization,
    executeOrder,
    resetFlow,
    authorization,
    transaction,
    isValidFillAmount,
    validationError
  }
} 