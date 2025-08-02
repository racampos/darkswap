'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { type Hash } from 'viem'
import { type PublishedOrder } from '@/lib/api/types'

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  order: PublishedOrder | null
  fillAmount: string
  outputAmount: string
  txHash: Hash | null
  gasUsed?: string
  className?: string
}

export function SuccessModal({
  isOpen,
  onClose,
  order,
  fillAmount,
  outputAmount,
  txHash,
  gasUsed,
  className = ''
}: SuccessModalProps) {
  const [showDetails, setShowDetails] = useState(false)

  if (!isOpen || !order) return null

  const formatAmount = (amount: string, decimals: number, symbol: string) => {
    const value = (Number(amount) / Math.pow(10, decimals)).toFixed(6)
    return `${value} ${symbol}`
  }

  const shareOnTwitter = () => {
    const text = `Just completed a privacy-preserving swap on DarkSwap! 🚀\n\nTraded ${formatAmount(fillAmount, order.metadata.takerToken.decimals, order.metadata.takerToken.symbol)} for ${formatAmount(outputAmount, order.metadata.makerToken.decimals, order.metadata.makerToken.symbol)} using Zero-Knowledge proofs 🔒\n\n#DarkSwap #ZKProofs #DeFi #Privacy`
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <Card className={`relative w-full max-w-lg mx-4 border border-green-500/50 ${className}`}>
        <div className="p-6">
          {/* Celebration Header */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">
              Order Filled Successfully!
            </h2>
            <p className="text-muted-foreground">
              Your privacy-preserving swap has been completed
            </p>
          </div>

          {/* Trade Summary */}
          <div className="space-y-4 mb-6">
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">You Paid:</span>
                <div className="text-right">
                  <p className="font-semibold text-foreground">
                    {formatAmount(fillAmount, order.metadata.takerToken.decimals, order.metadata.takerToken.symbol)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-center my-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-green-400">↓</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">You Received:</span>
                <div className="text-right">
                  <p className="font-semibold text-green-400">
                    {formatAmount(outputAmount, order.metadata.makerToken.decimals, order.metadata.makerToken.symbol)}
                  </p>
                </div>
              </div>
            </div>

            {/* Rate Display */}
            <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border">
              <span className="text-sm text-muted-foreground">Exchange Rate:</span>
              <span className="text-sm font-medium text-foreground">
                1 {order.metadata.takerToken.symbol} = {order.metadata.rate?.toFixed(6) || 'N/A'} {order.metadata.makerToken.symbol}
              </span>
            </div>
          </div>

          {/* Transaction Details Toggle */}
          <Button
            variant="ghost"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full mb-4 text-muted-foreground hover:text-foreground"
          >
            {showDetails ? 'Hide' : 'Show'} Transaction Details
            <span className="ml-2">{showDetails ? '↑' : '↓'}</span>
          </Button>

          {/* Expandable Details */}
          {showDetails && (
            <div className="space-y-3 mb-6 p-4 bg-background/30 rounded-lg border border-border">
              {txHash && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Transaction:</span>
                  <a 
                    href={`https://etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 underline font-mono"
                  >
                    {txHash.slice(0, 10)}...{txHash.slice(-8)}
                  </a>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Order ID:</span>
                <span className="text-sm font-mono text-foreground">
                  {order.id.slice(0, 10)}...{order.id.slice(-8)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Maker:</span>
                <span className="text-sm font-mono text-foreground">
                  {order.order.maker.slice(0, 8)}...{order.order.maker.slice(-6)}
                </span>
              </div>
              
              {gasUsed && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Gas Used:</span>
                  <span className="text-sm text-foreground">
                    {gasUsed} ETH
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Privacy:</span>
                <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                  🔒 ZK Protected
                </Badge>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col space-y-3">
            <Button
              onClick={shareOnTwitter}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              🐦 Share on Twitter
            </Button>
            
            <div className="flex space-x-3">
              <Button
                variant="ghost"
                onClick={onClose}
                className="flex-1 text-muted-foreground hover:text-foreground"
              >
                Close
              </Button>
              <Button
                onClick={() => window.location.href = '/taker/history'}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
              >
                View History
              </Button>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="mt-6 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <p className="text-xs text-purple-400 text-center">
              🔒 This transaction was executed with Zero-Knowledge privacy protection,
              ensuring maker's secret parameters remained completely private.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
} 