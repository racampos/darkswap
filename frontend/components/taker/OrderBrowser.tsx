'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { type PublishedOrder } from '@/lib/api/types'

interface OrderBrowserProps {
  orders: PublishedOrder[]
  isLoading: boolean
  error: Error | null
  onOrderSelect: (orderId: string) => void
  onRefresh: () => void
}

type SortOption = 'newest' | 'oldest' | 'priceAsc' | 'priceDesc' | 'amountAsc' | 'amountDesc'

export function OrderBrowser({ orders, isLoading, error, onOrderSelect, onRefresh }: OrderBrowserProps) {
  const [sortBy, setSortBy] = useState<SortOption>('newest')

  // Sort orders based on selected option
  const sortedOrders = [...orders].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return (b.createdAt || 0) - (a.createdAt || 0)
      case 'oldest':
        return (a.createdAt || 0) - (b.createdAt || 0)
      case 'amountAsc':
        return parseFloat(a.order.makingAmount) - parseFloat(b.order.makingAmount)
      case 'amountDesc':
        return parseFloat(b.order.makingAmount) - parseFloat(a.order.makingAmount)
      case 'priceAsc':
      case 'priceDesc':
        // Calculate exchange rates for sorting
        const rateA = parseFloat(a.order.takingAmount) / parseFloat(a.order.makingAmount)
        const rateB = parseFloat(b.order.takingAmount) / parseFloat(b.order.makingAmount)
        return sortBy === 'priceAsc' ? rateA - rateB : rateB - rateA
      default:
        return 0
    }
  })

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
        return (taking / making).toFixed(4)
      }
    } catch {
      // Fallback calculation
    }
    return '0.0000'
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

  if (error) {
    return (
      <Card className="p-8 text-center bg-card">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load orders</h3>
        <p className="text-muted-foreground mb-6">
          {error.message || 'Unknown error occurred'}
        </p>
        <Button onClick={onRefresh} variant="outline">
          Try Again
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1 text-sm bg-muted border border-border rounded-md text-foreground"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="priceAsc">Price: Low to High</option>
            <option value="priceDesc">Price: High to Low</option>
            <option value="amountAsc">Amount: Low to High</option>
            <option value="amountDesc">Amount: High to Low</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="p-8 text-center bg-card">
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-muted-foreground">Loading orders...</p>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && sortedOrders.length === 0 && (
        <Card className="p-8 text-center bg-card">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No orders found</h3>
          <p className="text-muted-foreground mb-6">
            Try adjusting your filters or check back later for new orders.
          </p>
          <Button onClick={onRefresh} variant="outline">
            Refresh Orders
          </Button>
        </Card>
      )}

      {/* Orders Grid */}
      {!isLoading && sortedOrders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedOrders.map((order) => {
            const makerSymbol = order.metadata?.makerToken?.symbol || 'UNKNOWN'
            const takerSymbol = order.metadata?.takerToken?.symbol || 'UNKNOWN'
            const makerDecimals = order.metadata?.makerToken?.decimals || 18
            const takerDecimals = order.metadata?.takerToken?.decimals || 6
            
            const formattedMakingAmount = formatTokenAmount(order.order.makingAmount, makerDecimals)
            const formattedTakingAmount = formatTokenAmount(order.order.takingAmount, takerDecimals)
            const rate = calculateRate(formattedMakingAmount, formattedTakingAmount)
            
            return (
              <Card 
                key={order.id}
                className="p-4 bg-card hover:shadow-md transition-all cursor-pointer border hover:border-blue-500/30"
                onClick={() => onOrderSelect(order.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  {getStatusBadge(order.status)}
                  <div className="text-xs text-muted-foreground">
                    {order.id.slice(-8)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="text-center mb-2">
                    <div className="text-lg font-semibold text-foreground">
                      {formattedMakingAmount} {makerSymbol}
                    </div>
                    <div className="text-sm text-muted-foreground">↓</div>
                    <div className="text-lg font-semibold text-foreground">
                      {formattedTakingAmount} {takerSymbol}
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    Rate: 1 {makerSymbol} = {rate} {takerSymbol}
                  </div>
                </div>
                
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expires:</span>
                    <span>Never</span>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      🔒 Hidden constraints
                    </div>
                    <Button 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation()
                        onOrderSelect(order.id)
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
} 