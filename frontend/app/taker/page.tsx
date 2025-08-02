'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useOrderDiscovery } from '@/lib/hooks/useOrders'
import { useAccount } from 'wagmi'

export default function TakerPage() {
  const { address } = useAccount()
  const [mounted, setMounted] = useState(false)
  const { data: recentOrders = [], isLoading } = useOrderDiscovery({
    network: 'localhost',
    limit: 10
  })

  // Prevent hydration mismatches
  useEffect(() => {
    setMounted(true)
  }, [])

  const activeOrdersCount = recentOrders.filter(order => order.status === 'active').length

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 text-foreground">
          Discover Privacy Orders
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          Browse and fill limit orders with hidden constraints. Makers reveal only what you need to know - 
          everything else stays private until execution.
        </p>
        
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" onClick={() => window.location.href = '/taker/discover'}>
            Browse Orders
          </Button>
          <Button variant="outline" size="lg" onClick={() => window.location.href = '/taker/history'}>
            Fill History
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Card className="p-6 text-center bg-card">
          <div className="text-3xl font-bold text-foreground mb-2">
            {!mounted ? '...' : isLoading ? '...' : activeOrdersCount}
          </div>
          <div className="text-muted-foreground">Active Orders</div>
        </Card>
        
        <Card className="p-6 text-center bg-card">
          <div className="text-3xl font-bold text-foreground mb-2">
            {!mounted ? '...' : isLoading ? '...' : recentOrders.length}
          </div>
          <div className="text-muted-foreground">Total Orders</div>
        </Card>
        
        <Card className="p-6 text-center bg-card">
          <div className="text-3xl font-bold text-foreground mb-2">
            {!mounted ? '...' : address ? '✓' : '○'}
          </div>
          <div className="text-muted-foreground">Wallet Status</div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <Card className="p-8 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground mb-2">
              🔍 Discover Orders
            </h3>
            <p className="text-muted-foreground">
              Browse available limit orders from makers. Filter by token pairs, amounts, 
              and price ranges to find the perfect match.
            </p>
          </div>
          <Button onClick={() => window.location.href = '/taker/discover'} className="w-full">
            Start Browsing
          </Button>
        </Card>

        <Card className="p-8 bg-gradient-to-br from-green-500/10 to-teal-500/10 border-green-500/20">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-foreground mb-2">
              📊 Fill History
            </h3>
            <p className="text-muted-foreground">
              View your past order fills, track execution status, and analyze your 
              trading performance across different market conditions.
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/taker/history'}
            className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10"
          >
            View History
          </Button>
        </Card>
      </div>

      {/* Recent Orders Preview */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-foreground">Recent Orders</h2>
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = '/taker/discover'}
            className="text-blue-400 hover:text-blue-300"
          >
            View All →
          </Button>
        </div>

        {!mounted || isLoading ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading orders...</div>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-4">No orders available yet</div>
            <Button onClick={() => window.location.href = '/maker/create'}>
              Create Your First Order
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentOrders.slice(0, 3).map(order => {
              // Parse token symbols safely
              const makerSymbol = order.metadata?.makerToken?.symbol || 'TOKEN'
              const takerSymbol = order.metadata?.takerToken?.symbol || 'TOKEN'
              
              return (
                <Card key={order.id} className="p-4 bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {order.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {order.id.slice(-8)}
                    </div>
                  </div>
                  
                  <div className="text-center mb-3">
                    <div className="text-lg font-semibold text-foreground">
                      {makerSymbol} → {takerSymbol}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Limit Order
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-2">
                      🔒 Hidden constraints active
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => window.location.href = `/taker/discover?order=${order.id}`}
                    >
                      View Details
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Help Section */}
      <Card className="p-6 bg-muted/30">
        <h3 className="text-lg font-semibold text-foreground mb-3">
          How Taker Orders Work
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium text-foreground mb-1">1. Discover</div>
            <div className="text-muted-foreground">
              Browse orders with public information. Hidden constraints remain private.
            </div>
          </div>
          <div>
            <div className="font-medium text-foreground mb-1">2. Request</div>
            <div className="text-muted-foreground">
              Submit a fill request. The maker's API checks your request against hidden constraints.
            </div>
          </div>
          <div>
            <div className="font-medium text-foreground mb-1">3. Execute</div>
            <div className="text-muted-foreground">
              If authorized, receive a ZK proof and execute the order on-chain.
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
} 