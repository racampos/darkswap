'use client'

import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { useOrder } from '@/lib/hooks/useOrders'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FillOrderDialog } from './FillOrderDialog'
import { canFillOrder } from '@/lib/utils/orderExecution'
import { useAccount } from 'wagmi'

interface OrderDetailsProps {
  orderId: string
  onClose: () => void
}

export function OrderDetails({ orderId, onClose }: OrderDetailsProps) {
  const { address } = useAccount()
  const { data: order, isLoading, error } = useOrder(orderId)
  const [showFillDialog, setShowFillDialog] = useState(false)

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const formatTokenAmount = (amount: string, decimals: number) => {
    try {
      return formatUnits(BigInt(amount), decimals)
    } catch {
      return amount
    }
  }

  const calculateRate = (makingAmount: string, takingAmount: string) => {
    try {
      const making = parseFloat(makingAmount)
      const taking = parseFloat(takingAmount)
      if (making > 0) {
        return (taking / making).toFixed(6)
      }
    } catch {
      // Fallback calculation
    }
    return '0.000000'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
      case 'filled':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Filled</Badge>
      case 'expired':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Expired</Badge>
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelled</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Unknown</Badge>
    }
  }

  if (!order && !isLoading && !error) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Order Details</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M18 6L6 18M6 6L18 18" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading && (
            <div className="text-center py-8">
              <div className="text-2xl mb-2">⏳</div>
              <p className="text-muted-foreground">Loading order details...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load order</h3>
              <p className="text-muted-foreground">
                {error.message || 'Unknown error occurred'}
              </p>
            </div>
          )}

          {order && (
            <>
              {/* Order Overview */}
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-4">
                  {getStatusBadge(order.status)}
                  <span className="text-sm text-muted-foreground">#{order.id.slice(-8)}</span>
                </div>

                <div className="space-y-2">
                  <div className="text-3xl font-bold text-foreground">
                    {formatTokenAmount(order.order.makingAmount, order.metadata?.makerToken?.decimals || 18)} {order.metadata?.makerToken?.symbol || 'UNKNOWN'}
                  </div>
                  <div className="text-lg text-muted-foreground">↓</div>
                  <div className="text-3xl font-bold text-foreground">
                    {formatTokenAmount(order.order.takingAmount, order.metadata?.takerToken?.decimals || 6)} {order.metadata?.takerToken?.symbol || 'UNKNOWN'}
                  </div>
                </div>

                <div className="text-muted-foreground">
                  Rate: 1 {order.metadata?.makerToken?.symbol} = {calculateRate(
                    formatTokenAmount(order.order.makingAmount, order.metadata?.makerToken?.decimals || 18),
                    formatTokenAmount(order.order.takingAmount, order.metadata?.takerToken?.decimals || 6)
                  )} {order.metadata?.takerToken?.symbol}
                </div>
              </div>

              {/* Order Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">Order Information</h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order ID:</span>
                      <span className="text-foreground font-mono">{order.id}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Maker:</span>
                      <span className="text-foreground font-mono">
                        {order.order.maker.slice(0, 6)}...{order.order.maker.slice(-4)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span className="text-foreground">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires:</span>
                      <span className="text-foreground">Never</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Network:</span>
                      <span className="text-foreground">{order.metadata?.network || 'localhost'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">Token Details</h3>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-muted-foreground mb-1">Maker Asset (Selling)</div>
                      <div className="text-foreground">{order.metadata?.makerToken?.symbol || 'UNKNOWN'}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {order.order.makerAsset}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-muted-foreground mb-1">Taker Asset (Buying)</div>
                      <div className="text-foreground">{order.metadata?.takerToken?.symbol || 'UNKNOWN'}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {order.order.takerAsset}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy Features */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Privacy Features</h3>
                
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="text-lg">🔒</div>
                    <div className="text-foreground font-medium">Hidden Constraints Active</div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>This order includes hidden constraints that protect the maker from MEV and front-running:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Secret minimum price threshold</li>
                      <li>Secret minimum fill amount</li>
                      <li>Cryptographic nonce for uniqueness</li>
                    </ul>
                    <p className="mt-2">
                      Your fill request will be verified against these hidden constraints using zero-knowledge proofs.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
                
                {order.status === 'active' && (
                  <Button
                    onClick={() => {
                      setShowFillDialog(true)
                    }}
                    className="flex-1"
                  >
                    Fill This Order
                  </Button>
                )}
                
                {order.status !== 'active' && (
                  <Button
                    disabled
                    className="flex-1"
                  >
                    Order Not Available
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      {showFillDialog && order && (
        <FillOrderDialog
          isOpen={showFillDialog}
          onClose={() => setShowFillDialog(false)}
          order={order}
        />
      )}
    </div>
  )
} 