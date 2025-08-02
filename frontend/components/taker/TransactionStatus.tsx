'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TransactionProgress } from '@/components/shared/TransactionProgress'
import { TransactionState, type TransactionStep } from '@/lib/utils/transactionTracking'
import { type Hash } from 'viem'

interface TransactionStatusProps {
  state: TransactionState
  steps: TransactionStep[]
  txHash: Hash | null
  error: string | null
  isLoading: boolean
  currentStep: TransactionStep | null
  progress: number
  onReset: () => void
  className?: string
}

export function TransactionStatus({
  state,
  steps,
  txHash,
  error,
  isLoading,
  currentStep,
  progress,
  onReset,
  className = ''
}: TransactionStatusProps) {
  const getStateBadge = () => {
    switch (state) {
      case TransactionState.IDLE:
        return (
          <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            ⚪ Ready
          </Badge>
        )
      case TransactionState.EXECUTING:
        return (
          <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            🔄 Executing
          </Badge>
        )
      case TransactionState.CONFIRMING:
        return (
          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            ⏳ Confirming
          </Badge>
        )
      case TransactionState.SUCCESS:
        return (
          <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
            ✅ Success
          </Badge>
        )
      case TransactionState.FAILED:
        return (
          <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
            ❌ Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            ⚪ {state}
          </Badge>
        )
    }
  }

  const getStateMessage = () => {
    switch (state) {
      case TransactionState.IDLE:
        return "Ready to execute transaction"
      case TransactionState.EXECUTING:
        return "Submitting transaction to blockchain..."
      case TransactionState.CONFIRMING:
        return "Waiting for blockchain confirmation..."
      case TransactionState.SUCCESS:
        return "Transaction completed successfully!"
      case TransactionState.FAILED:
        return "Transaction execution failed"
      default:
        return `Transaction is ${state}`
    }
  }

  return (
    <Card className={`${className}`}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">Transaction Status</h3>
          {getStateBadge()}
        </div>

        {/* State Message */}
        <p className="text-sm text-muted-foreground">
          {getStateMessage()}
        </p>

        {/* Current Step Highlight */}
        {currentStep && state !== TransactionState.IDLE && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-blue-400">🔄</span>
              <div>
                <p className="text-sm font-medium text-blue-400">
                  {currentStep.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentStep.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Hash */}
        {txHash && (
          <div className="p-3 bg-background/50 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Transaction Hash:</span>
              <a 
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 underline font-mono"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </a>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">
              <span className="font-medium">Error:</span> {error}
            </p>
          </div>
        )}

        {/* Progress Bar (when not idle) */}
        {state !== TransactionState.IDLE && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Progress</span>
              <span className="text-sm font-medium text-foreground">
                {progress}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  state === TransactionState.SUCCESS 
                    ? 'bg-green-500' 
                    : state === TransactionState.FAILED 
                      ? 'bg-red-500'
                      : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Detailed Progress */}
        {(state !== TransactionState.IDLE || steps.some(s => s.state !== 'pending')) && (
          <TransactionProgress 
            steps={steps} 
            currentStep={currentStep}
            className="mt-4"
          />
        )}

        {/* Actions */}
        {(state === TransactionState.SUCCESS || state === TransactionState.FAILED) && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              onClick={onReset}
              className="text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm text-blue-400">Processing...</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
} 