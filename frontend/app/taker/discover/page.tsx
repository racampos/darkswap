'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { OrderBrowser } from '@/components/taker/OrderBrowser'
import { OrderSearch } from '@/components/taker/OrderSearch'
import { OrderFilters } from '@/components/taker/OrderFilters'
import { OrderDetails } from '@/components/taker/OrderDetails'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useOrderDiscovery, useOrderFilters } from '@/lib/hooks/useOrders'
import { useAccount } from 'wagmi'

function DiscoverPageContent() {
  const { address } = useAccount()
  const searchParams = useSearchParams()
  const selectedOrderId = searchParams.get('order')
  
  const [showDetails, setShowDetails] = useState(!!selectedOrderId)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(selectedOrderId)
  
  const { filters, updateFilter, clearFilters, hasActiveFilters } = useOrderFilters()
  const { data: orders = [], isLoading, error, refetch } = useOrderDiscovery({
    ...filters,
    network: filters.network || 'localhost', // Use filters.network or default to localhost
    limit: 20
  })

  // Create a type-compatible wrapper for updateFilter
  const handleFilterChange = <K extends keyof typeof filters>(key: K, value: typeof filters[K]) => {
    updateFilter(key, value)
  }

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrder(orderId)
    setShowDetails(true)
  }

  const handleCloseDetails = () => {
    setShowDetails(false)
    setSelectedOrder(null)
    // Update URL without the order parameter
    window.history.replaceState({}, '', '/taker/discover')
  }

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
              onSearchChange={(query) => updateFilter('searchQuery', query)}
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
      {showDetails && selectedOrder && (
        <OrderDetails
          orderId={selectedOrder}
          onClose={handleCloseDetails}
          onFillOrder={(orderId) => {
            // Navigate to order execution page (commit 7)
            window.location.href = `/taker/fill/${orderId}`
          }}
        />
      )}
    </div>
  )
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-muted-foreground">Loading order discovery...</p>
        </div>
      </div>
    }>
      <DiscoverPageContent />
    </Suspense>
  )
} 