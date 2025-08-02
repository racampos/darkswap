'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FillAmountInput } from './FillAmountInput'
import { AuthorizationStatus } from './AuthorizationStatus'
import { SuccessModal } from './SuccessModal'
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog'
import { useFillOrder } from '@/lib/hooks/useFillOrder'
import { canFillOrder, normalizeOrderData } from '@/lib/utils/orderExecution'
import { type PublishedOrder } from '@/lib/api/types'
import { useAccount } from 'wagmi'
import { Hash } from 'viem'

interface FillOrderDialogProps {
  isOpen: boolean
  onClose: () => void
  order: PublishedOrder | null
  className?: string
}

export function FillOrderDialog({
  isOpen,
  onClose,
  order,
  className = ''
}: FillOrderDialogProps) {
  const { address } = useAccount()
  const {
    state: orderState,
    order: currentOrder,
    fillAmount,
    executionSummary,
    error,
    canFill,
    fillReason,
    validationError,
    isValidFillAmount,
    setOrder,
    setFillAmount,
    clearOrder,
    requestAuthorization,
    executeOrder,
    resetFlow,
    authorization,
    transaction
  } = useFillOrder()

  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Set order when dialog opens
  useEffect(() => {
    if (isOpen && order && order.id !== currentOrder?.id) {
      setOrder(order)
    }
  }, [isOpen, order, currentOrder?.id, setOrder])

  // Handle success state
  useEffect(() => {
    if (orderState === 'success' && !showSuccess) {
      setShowSuccess(true)
    }
  }, [orderState, showSuccess])

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      clearOrder()
      setShowSuccess(false)
      setShowConfirmation(false)
    }
  }, [isOpen, clearOrder])

  const handleClose = () => {
    onClose()
    clearOrder()
  }

  const handleFillAmountChange = (amount: string) => {
    setFillAmount(amount)
  }

  const handleConfirmAuthorization = () => {
    setShowConfirmation(false)
    requestAuthorization()
  }

  const handleExecute = () => {
    executeOrder()
  }

  // Helper function to format amounts for display
  const getFormattedFillAmount = () => {
    if (!fillAmount || fillAmount === '0') return '0'
    try {
      const fillAmountWei = BigInt(fillAmount)
      const takerDecimals = normalizedOrder.metadata.takerToken?.decimals || 6
      return (Number(fillAmountWei) / Math.pow(10, takerDecimals)).toFixed(4)
    } catch {
      return '0'
    }
  }

  const getFormattedOutputAmount = () => {
    if (!executionSummary?.output?.outputAmount) return 'N/A'
    try {
      const makerDecimals = normalizedOrder.metadata.makerToken?.decimals || 18
      const outputWei = executionSummary.output.outputAmount
      return (Number(outputWei) / Math.pow(10, makerDecimals)).toFixed(6)
    } catch {
      return 'N/A'
    }
  }

  if (!isOpen || !order) return null

  const normalizedOrder = normalizeOrderData(order)
  const eligibility = canFillOrder(order, address)

  const getStepStatus = (step: number) => {
    if (step === 1) {
      // Fill amount validation
      return isValidFillAmount && !validationError ? 'complete' : 'pending'
    } else if (step === 2) {
      // Authorization
      if (authorization.error) return 'error'
      if (authorization.isAuthorized) return 'complete'
      if (authorization.isAuthorizing) return 'loading'
      return 'pending'
    } else if (step === 3) {
      // Transaction
      if (transaction.transactionState.error) return 'error'
      if (transaction.transactionState.step === 'confirmed') return 'complete'
      if (transaction.isLoading) return 'loading'
      return 'pending'
    }
    return 'pending'
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'complete': return '✅'
      case 'loading': return '⏳'
      case 'error': return '❌'
      default: return '○'
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto ${className}`}>
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Fill Order</h2>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Order Summary */}
            <div className="p-4 bg-background/50 rounded-lg border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Trading Pair</span>
                <span className="font-medium text-foreground">
                  {normalizedOrder.metadata.makerToken?.symbol || 'TOKEN'} → {normalizedOrder.metadata.takerToken?.symbol || 'TOKEN'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rate</span>
                <span className="font-medium text-foreground">
                  {executionSummary?.rate?.toFixed(6) || 'N/A'} {normalizedOrder.metadata.takerToken?.symbol || 'TOKEN'}/{normalizedOrder.metadata.makerToken?.symbol || 'TOKEN'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Available</span>
                <span className="font-medium text-foreground">
                  {(Number(normalizedOrder.order.makingAmount) / Math.pow(10, normalizedOrder.metadata.makerToken?.decimals || 18)).toFixed(6)} {normalizedOrder.metadata.makerToken?.symbol || 'TOKEN'}
                </span>
              </div>
            </div>

            {/* Eligibility Check */}
            {!canFill && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">
                  <span className="font-medium">Cannot fill order:</span> {fillReason}
                </p>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-6">
              {/* Step 1: Fill Amount */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-full text-white text-sm flex items-center justify-center font-medium ${
                    getStepStatus(1) === 'complete' ? 'bg-green-500' : 'bg-gray-500'
                  }`}>
                    1
                  </div>
                  <h3 className="font-medium text-foreground">Set Fill Amount</h3>
                  <span className="text-lg">{getStepIcon(getStepStatus(1))}</span>
                </div>
                
                <FillAmountInput
                  order={normalizedOrder}
                  value={fillAmount}
                  onChange={handleFillAmountChange}
                  disabled={!canFill}
                />

                {validationError && (
                  <p className="text-sm text-red-400">
                    {validationError}
                  </p>
                )}
              </div>

              {/* Step 2: Authorization */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-full text-white text-sm flex items-center justify-center font-medium ${
                    getStepStatus(2) === 'complete' ? 'bg-green-500' : 'bg-gray-500'
                  }`}>
                    2
                  </div>
                  <h3 className="font-medium text-foreground">Request Authorization</h3>
                  <span className="text-lg">{getStepIcon(getStepStatus(2))}</span>
                </div>
                
                <AuthorizationStatus
                  isAuthorizing={authorization.isAuthorizing}
                  isAuthorized={authorization.isAuthorized}
                  authorization={authorization.authorization}
                  error={authorization.error}
                  authorizationTime={null}
                  onRequestAuthorization={() => setShowConfirmation(true)}
                  onClearAuthorization={authorization.clearAuthorization}
                  isAuthorizationValid={authorization.isAuthorizationValid}
                />

                {!authorization.isAuthorized && !authorization.isAuthorizing && (
                  <Button
                    onClick={() => setShowConfirmation(true)}
                    disabled={!isValidFillAmount || !canFill}
                    className="w-full"
                  >
                    Request Authorization
                  </Button>
                )}

                {authorization.isAuthorized && !transaction.isLoading && (
                  <Button
                    onClick={handleExecute}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Execute Order
                  </Button>
                )}
              </div>

              {/* Step 3: Transaction */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-full text-white text-sm flex items-center justify-center font-medium ${
                    getStepStatus(3) === 'complete' ? 'bg-green-500' : 'bg-gray-500'
                  }`}>
                    3
                  </div>
                  <h3 className="font-medium text-foreground">Execute Transaction</h3>
                  <span className="text-lg">{getStepIcon(getStepStatus(3))}</span>
                </div>
                
                {/* Simple Transaction Status Display */}
                {(transaction.isLoading || transaction.transactionState.step !== 'preparing' || transaction.transactionState.error) && (
                  <div className="p-4 bg-background/50 rounded-lg border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant="outline" className={
                        transaction.transactionState.step === 'confirmed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                        transaction.transactionState.step === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }>
                        {transaction.transactionState.step === 'preparing' && '⚪ Ready'}
                        {transaction.transactionState.step === 'waiting_approval' && '🔄 Waiting for Approval'}
                        {transaction.transactionState.step === 'confirming' && '⏳ Confirming'}
                        {transaction.transactionState.step === 'confirmed' && '✅ Success'}
                        {transaction.transactionState.step === 'failed' && '❌ Failed'}
                      </Badge>
                    </div>
                    
                    {transaction.transactionState.hash && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Transaction Hash:</span>
                        <a 
                          href={`https://etherscan.io/tx/${transaction.transactionState.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 underline font-mono"
                        >
                          {transaction.transactionState.hash.slice(0, 10)}...{transaction.transactionState.hash.slice(-8)}
                        </a>
                      </div>
                    )}
                    
                    {transaction.transactionState.error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-400">
                          <span className="font-medium">Error:</span> {transaction.transactionState.error}
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Progress</span>
                        <span className="text-sm font-medium text-foreground">
                          {transaction.getProgress()}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            transaction.transactionState.step === 'confirmed' 
                              ? 'bg-green-500' 
                              : transaction.transactionState.step === 'failed' 
                                ? 'bg-red-500'
                                : 'bg-blue-500'
                          }`}
                          style={{ width: `${transaction.getProgress()}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Global Error */}
            {error && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">
                  <span className="font-medium">Error:</span> {error}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={resetFlow}
                disabled={authorization.isAuthorizing || transaction.isLoading}
              >
                Reset
              </Button>
              
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={authorization.isAuthorizing || transaction.isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmAuthorization}
        title="Request Authorization"
        description={`Are you sure you want to request authorization to fill ${getFormattedFillAmount()} ${normalizedOrder.metadata.takerToken?.symbol || 'TOKEN'} for ${getFormattedOutputAmount()} ${normalizedOrder.metadata.makerToken?.symbol || 'TOKEN'}?`}
        confirmText="Request Authorization"
        cancelText="Cancel"
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccess}
        onClose={() => {
          setShowSuccess(false)
          handleClose()
        }}
        order={normalizedOrder}
        fillAmount={fillAmount}
        outputAmount={getFormattedOutputAmount()}
        txHash={(transaction.transactionState.hash as Hash) || null}
      />
    </>
  )
} 