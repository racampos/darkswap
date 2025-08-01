'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useMakerOrders } from '@/lib/hooks/useOrders'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatUnits } from 'viem'

export default function MakerOrdersPage() {
  const { address } = useAccount()
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  
  // Fetch real orders from the API
  const { data: orders = [], isLoading, error, refetch } = useMakerOrders(address)

  // Filter orders by status
  const filteredOrders = orders.filter(order => 
    selectedStatus === 'all' || order.status === selectedStatus
  )

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

  // Format token amounts for display
  const formatTokenAmount = (amount: string, decimals: number) => {
    try {
      return formatUnits(BigInt(amount), decimals)
    } catch {
      return amount
    }
  }

  // Calculate exchange rate
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

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔗</div>
          <h3 className="text-xl font-semibold mb-2 text-foreground">Wallet not connected</h3>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to view your orders.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-foreground">My Orders</h1>
          <p className="text-muted-foreground text-lg">
            View and manage your DarkSwap limit orders
          </p>
        </div>
        
        <Button onClick={() => window.location.href = '/maker/create'}>
          Create New Order
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-4 mb-6">
        {['all', 'active', 'filled', 'expired', 'cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
              selectedStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <h3 className="text-xl font-semibold mb-2 text-foreground">Loading your orders...</h3>
          <p className="text-muted-foreground">Fetching data from the network</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold mb-2 text-foreground">Failed to load orders</h3>
          <p className="text-muted-foreground mb-6">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {/* Orders List */}
      {!isLoading && !error && (
        <>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">No orders found</h3>
              <p className="text-muted-foreground mb-6">
                {selectedStatus === 'all' 
                  ? "You haven't created any orders yet."
                  : `No ${selectedStatus} orders found.`
                }
              </p>
              <Button onClick={() => window.location.href = '/maker/create'}>
                Create Your First Order
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const makerSymbol = order.metadata?.makerToken?.symbol || 'UNKNOWN'
                const takerSymbol = order.metadata?.takerToken?.symbol || 'UNKNOWN'
                const makerDecimals = order.metadata?.makerToken?.decimals || 18
                const takerDecimals = order.metadata?.takerToken?.decimals || 6
                
                const formattedMakingAmount = formatTokenAmount(order.order.makingAmount, makerDecimals)
                const formattedTakingAmount = formatTokenAmount(order.order.takingAmount, takerDecimals)
                const rate = calculateRate(formattedMakingAmount, formattedTakingAmount)
                
                return (
                  <div 
                    key={order.id}
                    className="border rounded-lg p-6 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-foreground">
                          {formattedMakingAmount} {makerSymbol} → {formattedTakingAmount} {takerSymbol}
                        </h3>
                        {getStatusBadge(order.status)}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        ID: {order.id}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-muted-foreground">Created</div>
                        <div className="text-foreground">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-muted-foreground">Expires</div>
                        <div className="text-foreground">Never expires</div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-muted-foreground">Rate</div>
                        <div className="text-foreground">
                          1 {makerSymbol} = {rate} {takerSymbol}
                        </div>
                      </div>

                      <div>
                        <div className="font-medium text-muted-foreground">Partial Fills</div>
                        <div className="text-foreground">Allowed</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <div className="text-sm text-muted-foreground">
                        🔒 Hidden constraints active
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        
                        {order.status === 'active' && (
                          <Button variant="outline" size="sm" className="text-red-400 border-red-500/30 hover:bg-red-500/10">
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
} 