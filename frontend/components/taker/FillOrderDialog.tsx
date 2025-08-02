'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FillAmountInput } from './FillAmountInput'
import { AuthorizationStatus } from './AuthorizationStatus'
import { TransactionStatus } from './TransactionStatus'
import { SuccessModal } from './SuccessModal'
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog'
import { useFillOrder } from '@/lib/hooks/useFillOrder'
import { canFillOrder, normalizeOrderData } from '@/lib/utils/orderExecution'
import { type PublishedOrder } from '@/lib/api/types'
import { useAccount } from 'wagmi'

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
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  
  const {
    state,
    fillAmount,
    executionSummary,
    canFill,
    fillReason,
    error,
    isValidFillAmount,
    validationError,
    setOrder,
    setFillAmount,
    clearOrder,
    requestAuthorization,
    executeOrder,
    resetFlow,
    authorization,
    transaction
  } = useFillOrder()

  // Initialize order when dialog opens
  useEffect(() => {
    if (isOpen && order) {
      const normalizedOrder = normalizeOrderData(order)
      setOrder(normalizedOrder)
    }
  }, [isOpen, order, setOrder])

  // Show success modal when transaction completes
  useEffect(() => {
    if (transaction.state === 'success') {
      setShowSuccess(true)
    }
  }, [transaction.state])

  const handleClose = () => {
    clearOrder()
    resetFlow()
    setShowConfirmation(false)
    setShowSuccess(false)
    onClose()
  }

  const handleExecuteClick = () => {
    setShowConfirmation(true)
  }

  const handleConfirmedExecute = async () => {
    setShowConfirmation(false)
    await executeOrder()
  }

  const getOrderSummary = () => {
    if (!order) return null
    
    // Calculate rate if not provided in metadata
    let rate = order.metadata?.rate
    if (!rate && order.order.makingAmount && order.order.takingAmount) {
      try {
        const makingAmount = Number(order.order.makingAmount)
        const takingAmount = Number(order.order.takingAmount)
        if (makingAmount > 0 && takingAmount > 0) {
          rate = makingAmount / takingAmount
        }
      } catch (error) {
        console.warn('Failed to calculate rate:', error)
        rate = 0
      }
    }
    
    return {
      pair: `${order.metadata?.makerToken?.symbol || 'TOKEN'} / ${order.metadata?.takerToken?.symbol || 'TOKEN'}`,
      rate: rate || 0,
      maxAmount: order.order.takingAmount,
      maker: order.order.maker
    }
  }

  if (!isOpen || !order) return null

  const orderSummary = getOrderSummary()
  const eligibility = canFillOrder(order, address)

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
        
        {/* Dialog */}
        <Card className={`relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto ${className}`}>
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Fill Order</h2>
                <p className="text-sm text-muted-foreground">
                  {orderSummary?.pair} • Rate: {orderSummary?.rate?.toFixed(6) || 'N/A'}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  🔒 ZK Protected
                </Badge>
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </Button>
              </div>
            </div>

            {/* Eligibility Check */}
            {!eligibility.canFill && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">
                  <span className="font-medium">Cannot fill order:</span> {eligibility.reason}
                </p>
              </div>
            )}

            {/* Content */}
            <div className="space-y-6">
              {/* Step 1: Fill Amount */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">
                    1
                  </div>
                  <h3 className="font-medium text-foreground">Specify Fill Amount</h3>
                </div>
                
                <FillAmountInput
                  order={order}
                  value={fillAmount}
                  onChange={setFillAmount}
                  disabled={!eligibility.canFill || state === 'executing'}
                />
              </div>

              {/* Step 2: Authorization */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-full text-white text-sm flex items-center justify-center font-medium ${
                    authorization.isAuthorized ? 'bg-green-500' : 'bg-gray-500'
                  }`}>
                    2
                  </div>
                  <h3 className="font-medium text-foreground">ZK Authorization</h3>
                </div>
                
                <AuthorizationStatus
                  isAuthorizing={authorization.isAuthorizing}
                  isAuthorized={authorization.isAuthorized}
                  authorization={authorization.authorization}
                  error={authorization.error}
                  authorizationTime={authorization.authorizationTime}
                  onRequestAuthorization={requestAuthorization}
                  onClearAuthorization={authorization.clearAuthorization}
                  isAuthorizationValid={authorization.isAuthorizationValid}
                />
              </div>

              {/* Step 3: Transaction */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-full text-white text-sm flex items-center justify-center font-medium ${
                    transaction.state === 'success' ? 'bg-green-500' : 'bg-gray-500'
                  }`}>
                    3
                  </div>
                  <h3 className="font-medium text-foreground">Execute Transaction</h3>
                </div>
                
                <TransactionStatus
                  state={transaction.state}
                  steps={transaction.steps}
                  txHash={transaction.txHash}
                  error={transaction.error}
                  isLoading={transaction.isLoading}
                  currentStep={transaction.getCurrentStep()}
                  progress={transaction.getProgress()}
                  onReset={transaction.resetTransaction}
                />
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
            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={state === 'executing'}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              
              <div className="flex items-center space-x-3">
                {!authorization.isAuthorized && isValidFillAmount && eligibility.canFill && (
                  <Button
                    onClick={requestAuthorization}
                    disabled={authorization.isAuthorizing || !isValidFillAmount}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {authorization.isAuthorizing ? 'Requesting...' : 'Request Authorization'}
                  </Button>
                )}
                
                {authorization.isAuthorized && authorization.isAuthorizationValid() && (
                  <Button
                    onClick={handleExecuteClick}
                    disabled={transaction.isLoading || state === 'executing'}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {transaction.isLoading ? 'Executing...' : 'Execute Order'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmedExecute}
        title="Confirm Order Execution"
        description="Are you sure you want to execute this order? This action cannot be undone."
        confirmText="Execute Order"
        variant="default"
        isLoading={transaction.isLoading}
      >
        {executionSummary && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">You pay:</span>
              <span className="text-sm font-medium">
                {(Number(fillAmount) / Math.pow(10, order.metadata.takerToken.decimals)).toFixed(6)} {order.metadata.takerToken.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">You receive:</span>
              <span className="text-sm font-medium text-green-400">
                {(Number(executionSummary.output.outputAmount) / Math.pow(10, order.metadata.makerToken.decimals)).toFixed(6)} {order.metadata.makerToken.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Est. Gas:</span>
              <span className="text-sm font-medium">
                {executionSummary.gasCost.estimatedCostEth} ETH
              </span>
            </div>
          </div>
        )}
      </ConfirmationDialog>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccess}
        onClose={() => {
          setShowSuccess(false)
          handleClose()
        }}
        order={order}
        fillAmount={fillAmount}
        outputAmount={executionSummary?.output.outputAmount.toString() || '0'}
        txHash={transaction.txHash}
      />
    </>
  )
} 