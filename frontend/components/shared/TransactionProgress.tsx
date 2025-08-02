'use client'

import { type TransactionStep } from '@/lib/utils/transactionTracking'
import { Badge } from '@/components/ui/Badge'

interface TransactionProgressProps {
  steps: TransactionStep[]
  currentStep?: TransactionStep | null
  className?: string
}

export function TransactionProgress({ 
  steps, 
  currentStep, 
  className = '' 
}: TransactionProgressProps) {
  const getStepIcon = (step: TransactionStep) => {
    switch (step.state) {
      case 'success':
        return '✅'
      case 'loading':
        return '⏳'
      case 'error':
        return '❌'
      default:
        return '⚪'
    }
  }

  const getStepColor = (step: TransactionStep) => {
    switch (step.state) {
      case 'success':
        return 'text-green-400'
      case 'loading':
        return 'text-blue-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Transaction Progress</h3>
        <Badge variant="outline" className="text-xs">
          {steps.filter(s => s.state === 'success').length} / {steps.length} Complete
        </Badge>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-all ${
              step.state === 'loading' 
                ? 'border-blue-500/50 bg-blue-500/10' 
                : step.state === 'success'
                  ? 'border-green-500/30 bg-green-500/5'
                  : step.state === 'error'
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-border bg-background'
            }`}
          >
            {/* Step Number & Icon */}
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full border border-border bg-background flex items-center justify-center text-xs font-medium">
                {index + 1}
              </div>
              <span className="text-lg">{getStepIcon(step)}</span>
            </div>

            {/* Step Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className={`font-medium ${getStepColor(step)}`}>
                  {step.title}
                </h4>
                {step.state === 'loading' && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-150"></div>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground mt-1">
                {step.description}
              </p>

              {step.error && (
                <p className="text-sm text-red-400 mt-2 font-medium">
                  Error: {step.error}
                </p>
              )}

              {step.txHash && (
                <div className="mt-2">
                  <a 
                    href={`https://etherscan.io/tx/${step.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    View on Etherscan: {step.txHash.slice(0, 10)}...{step.txHash.slice(-8)}
                  </a>
                </div>
              )}

              {step.timestamp && step.state === 'success' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Completed at {new Date(step.timestamp).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-muted-foreground">Overall Progress</span>
          <span className="text-sm font-medium text-foreground">
            {Math.round((steps.filter(s => s.state === 'success').length / steps.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ 
              width: `${(steps.filter(s => s.state === 'success').length / steps.length) * 100}%` 
            }}
          />
        </div>
      </div>
    </div>
  )
} 