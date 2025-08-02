'use client'

import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { type Hash } from 'viem'
import { 
  TransactionState, 
  createTransactionSteps, 
  updateTransactionStep,
  type TransactionStep
} from '@/lib/utils/transactionTracking'
import { type AuthorizeFillResponse } from '@/lib/api/types'

interface TransactionHookState {
  state: TransactionState
  steps: TransactionStep[]
  txHash: Hash | null
  error: string | null
  isLoading: boolean
}

interface UseTransactionResult extends TransactionHookState {
  executeTransaction: (authorization: AuthorizeFillResponse) => Promise<void>
  resetTransaction: () => void
  getCurrentStep: () => TransactionStep | null
  getProgress: () => number
}

/**
 * Hook for managing blockchain transactions with step-by-step progress tracking
 */
export function useTransaction(): UseTransactionResult {
  const { address } = useAccount()
  const [state, setState] = useState<TransactionHookState>({
    state: TransactionState.IDLE,
    steps: createTransactionSteps(),
    txHash: null,
    error: null,
    isLoading: false
  })

  // Use wagmi hooks for contract writing
  // const { writeContractAsync, isPending: isWritePending } = useWriteContract()

  // Wait for transaction confirmation
  // const { 
  //   data: receipt, 
  //   isLoading: isWaitingForReceipt, 
  //   error: receiptError 
  // } = useWaitForTransactionReceipt({
  //   hash: state.txHash || undefined,
  // })

  const updateStep = useCallback((stepId: string, updates: Partial<TransactionStep>) => {
    setState(prev => ({
      ...prev,
      steps: updateTransactionStep(prev.steps, stepId, updates)
    }))
  }, [])

  const executeTransaction = useCallback(async (authorization: AuthorizeFillResponse) => {
    if (!address) {
      setState(prev => ({
        ...prev,
        error: 'Wallet not connected',
        state: TransactionState.FAILED
      }))
      return
    }

    if (!authorization.success || !authorization.orderWithExtension) {
      setState(prev => ({
        ...prev,
        error: 'Invalid authorization',
        state: TransactionState.FAILED
      }))
      return
    }

    try {
      setState(prev => ({
        ...prev,
        state: TransactionState.EXECUTING,
        isLoading: true,
        error: null
      }))

      // Step 1: Authorization (already complete)
      updateStep('authorize', { state: 'success' })

      // Step 2: Token approval (simplified - assume approved for demo)
      updateStep('approve', { state: 'loading' })
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate approval
      updateStep('approve', { state: 'success' })

      // Step 3: Execute order
      updateStep('execute', { state: 'loading' })

      console.log('🔄 Executing order with authorization:', {
        orderData: authorization.orderWithExtension,
        signature: authorization.signature
      })

      // For demo purposes, we'll simulate the transaction
      // In a real implementation, this would call the 1inch router contract
      const mockTxHash = `0x${Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}` as Hash

      // Simulate transaction submission
      await new Promise(resolve => setTimeout(resolve, 2000))

      setState(prev => ({
        ...prev,
        txHash: mockTxHash,
        state: TransactionState.CONFIRMING
      }))

      updateStep('execute', { 
        state: 'success', 
        txHash: mockTxHash 
      })

      // Step 4: Wait for confirmation
      updateStep('confirm', { state: 'loading' })

      // Simulate confirmation wait
      await new Promise(resolve => setTimeout(resolve, 3000))

      updateStep('confirm', { state: 'success' })

      setState(prev => ({
        ...prev,
        state: TransactionState.SUCCESS,
        isLoading: false
      }))

      console.log('✅ Transaction completed successfully:', mockTxHash)

    } catch (error: any) {
      console.error('❌ Transaction failed:', error)
      
      const currentStepId = state.steps.find(step => step.state === 'loading')?.id
      if (currentStepId) {
        updateStep(currentStepId, { 
          state: 'error', 
          error: error.message 
        })
      }

      setState(prev => ({
        ...prev,
        state: TransactionState.FAILED,
        isLoading: false,
        error: error.message || 'Transaction failed'
      }))
    }
  }, [address, updateStep, state.steps])

  const resetTransaction = useCallback(() => {
    setState({
      state: TransactionState.IDLE,
      steps: createTransactionSteps(),
      txHash: null,
      error: null,
      isLoading: false
    })
  }, [])

  const getCurrentStep = useCallback((): TransactionStep | null => {
    const loadingStep = state.steps.find(step => step.state === 'loading')
    if (loadingStep) return loadingStep
    
    // Find the last successful step
    let lastSuccessIndex = -1
    for (let i = state.steps.length - 1; i >= 0; i--) {
      if (state.steps[i].state === 'success') {
        lastSuccessIndex = i
        break
      }
    }
    
    if (lastSuccessIndex === -1) return state.steps[0]
    
    const nextIndex = lastSuccessIndex + 1
    return nextIndex < state.steps.length ? state.steps[nextIndex] : null
  }, [state.steps])

  const getProgress = useCallback((): number => {
    const completedSteps = state.steps.filter(step => step.state === 'success').length
    return Math.round((completedSteps / state.steps.length) * 100)
  }, [state.steps])

  return {
    ...state,
    executeTransaction,
    resetTransaction,
    getCurrentStep,
    getProgress
  }
} 