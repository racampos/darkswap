'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useOrderDiscovery, useOrderFilters } from '@/lib/hooks/useOrders'
import { OrderBrowser } from '@/components/taker/OrderBrowser'
import { OrderSearch } from '@/components/taker/OrderSearch'
import { OrderFilters } from '@/components/taker/OrderFilters'
import { OrderDetails } from '@/components/taker/OrderDetails'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAccount } from 'wagmi'

export default function DiscoverPage() {
  const [mounted, setMounted] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  
  const { address } = useAccount()
  const searchParams = useSearchParams()
  
  const { filters, updateFilter, clearFilters, hasActiveFilters } = useOrderFilters()
  const { data: orders = [], isLoading, error, refetch } = useOrderDiscovery({
    ...filters,
    network: filters.network || 'localhost',
    limit: 20
  })

  // Prevent hydration mismatches
  useEffect(() => {
    setMounted(true)
    
    // Handle URL search params after mounting
    const orderParam = searchParams.get('order')
    if (orderParam) {
      setSelectedOrder(orderParam)
    }
  }, [searchParams])

  // Memoize the search handler to prevent infinite re-renders
  const handleSearchChange = useCallback((query: string) => {
    updateFilter('searchQuery', query)
  }, [updateFilter])

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrder(orderId)
  }

  const handleCloseDetails = () => {
    setSelectedOrder(null)
  }

  // Show loading state until mounted
  if (!mounted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-muted-foreground">Loading order discovery...</p>
        </div>
      </div>
    )
  }

  // Show wallet connection prompt if not connected
  if (!address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔗</div>
          <h3 className="text-xl font-semibold mb-2 text-foreground">Wallet not connected</h3>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to discover and fill orders.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-foreground">Discover Orders</h1>
          <p className="text-muted-foreground">
            Browse available limit orders with privacy-preserving constraints
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/taker'}
          >
            ← Back to Dashboard
          </Button>
          <Button onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6">
        <Card className="p-6 bg-card">
          <div className="space-y-4">
            <OrderSearch
              onSearchChange={handleSearchChange}
              placeholder="Search by token symbol, address, or order ID..."
            />
            
            <OrderFilters
              filters={filters as any}
              onFilterChange={updateFilter as any}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
        </Card>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            'Loading orders...'
          ) : (
            <>
              Found {orders.length} order{orders.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' matching your criteria'}
            </>
          )}
        </div>
        
        {hasActiveFilters && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Order Browser */}
      <OrderBrowser
        orders={orders}
        isLoading={isLoading}
        error={error}
        onOrderSelect={handleOrderSelect}
        onRefresh={refetch}
      />

      {/* Order Details Modal/Dialog */}
      {selectedOrder && (
        <OrderDetails
          orderId={selectedOrder}
          onClose={handleCloseDetails}
        />
      )}
    </div>
  )
} 