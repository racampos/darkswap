'use client'

import { type Hash, type TransactionReceipt } from 'viem'

// Transaction states
export enum TransactionState {
  IDLE = 'idle',
  AUTHORIZING = 'authorizing',
  AUTHORIZED = 'authorized',
  CONFIRMING = 'confirming',
  CONFIRMED = 'confirmed',
  EXECUTING = 'executing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Transaction step definitions
export interface TransactionStep {
  id: string
  title: string
  description: string
  state: 'pending' | 'loading' | 'success' | 'error'
  txHash?: Hash
  timestamp?: number
  error?: string
}

/**
 * Creates the standard transaction steps for order filling
 */
export function createTransactionSteps(): TransactionStep[] {
  return [
    {
      id: 'authorize',
      title: 'Request Authorization',
      description: 'Requesting ZK proof from maker for order fill',
      state: 'pending'
    },
    {
      id: 'approve',
      title: 'Token Approval',
      description: 'Approve spending of taker tokens',
      state: 'pending'
    },
    {
      id: 'execute',
      title: 'Execute Order',
      description: 'Submit order fill transaction to blockchain',
      state: 'pending'
    },
    {
      id: 'confirm',
      title: 'Confirm Transaction',
      description: 'Wait for blockchain confirmation',
      state: 'pending'
    }
  ]
}

/**
 * Updates a specific step in the transaction flow
 */
export function updateTransactionStep(
  steps: TransactionStep[],
  stepId: string,
  updates: Partial<TransactionStep>
): TransactionStep[] {
  return steps.map(step => 
    step.id === stepId 
      ? { ...step, ...updates, timestamp: updates.timestamp || Date.now() }
      : step
  )
}

/**
 * Gets the current active step
 */
export function getCurrentStep(steps: TransactionStep[]): TransactionStep | null {
  const loadingStep = steps.find(step => step.state === 'loading')
  if (loadingStep) return loadingStep
  
  // Find the last successful step manually for ES2020 compatibility
  let lastSuccessIndex = -1
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].state === 'success') {
      lastSuccessIndex = i
      break
    }
  }
  
  if (lastSuccessIndex === -1) return steps[0]
  
  const nextIndex = lastSuccessIndex + 1
  return nextIndex < steps.length ? steps[nextIndex] : null
}

/**
 * Checks if all steps are completed successfully
 */
export function isTransactionComplete(steps: TransactionStep[]): boolean {
  return steps.every(step => step.state === 'success')
}

/**
 * Checks if any step has failed
 */
export function hasTransactionFailed(steps: TransactionStep[]): boolean {
  return steps.some(step => step.state === 'error')
}

/**
 * Gets transaction progress percentage
 */
export function getTransactionProgress(steps: TransactionStep[]): number {
  const completedSteps = steps.filter(step => step.state === 'success').length
  return Math.round((completedSteps / steps.length) * 100)
}

/**
 * Formats step duration for display
 */
export function formatStepDuration(step: TransactionStep): string {
  if (!step.timestamp) return ''
  
  const duration = Date.now() - step.timestamp
  const seconds = Math.floor(duration / 1000)
  
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

/**
 * Creates a summary of the transaction for display
 */
export function createTransactionSummary(
  steps: TransactionStep[],
  orderHash: string,
  fillAmount: string,
  outputAmount: string
) {
  const progress = getTransactionProgress(steps)
  const isComplete = isTransactionComplete(steps)
  const hasFailed = hasTransactionFailed(steps)
  const currentStep = getCurrentStep(steps)
  
  return {
    progress,
    isComplete,
    hasFailed,
    currentStep,
    status: hasFailed 
      ? 'failed' 
      : isComplete 
        ? 'success' 
        : 'pending',
    orderHash,
    fillAmount,
    outputAmount,
    steps
  }
}

/**
 * Validates transaction receipt and extracts relevant data
 */
export function validateTransactionReceipt(
  receipt: TransactionReceipt
): {
  isValid: boolean
  gasUsed?: bigint
  effectiveGasPrice?: bigint
  blockNumber?: bigint
  error?: string
} {
  try {
    if (receipt.status === 'reverted') {
      return {
        isValid: false,
        error: 'Transaction was reverted'
      }
    }
    
    return {
      isValid: true,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      blockNumber: receipt.blockNumber
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
} 