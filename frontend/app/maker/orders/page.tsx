'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

// Mock order data - will be replaced with real API integration in Commit 4
const mockOrders = [
  {
    id: 'order-1',
    makerAsset: { symbol: 'WETH', address: '0x...C756Cc2' },
    takerAsset: { symbol: 'USDC', address: '0x...06eb48' },
    makingAmount: '1.5',
    takingAmount: '3000',
    limitPrice: '2000',
    status: 'active',
    expiration: new Date(Date.now() + 86400000),
    createdAt: new Date(Date.now() - 3600000),
  },
  {
    id: 'order-2',
    makerAsset: { symbol: 'WETH', address: '0x...C756Cc2' },
    takerAsset: { symbol: 'USDC', address: '0x...06eb48' },
    makingAmount: '0.8',
    takingAmount: '1600',
    limitPrice: '2000',
    status: 'filled',
    expiration: new Date(Date.now() + 86400000),
    createdAt: new Date(Date.now() - 7200000),
  },
]

export default function MakerOrdersPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  const filteredOrders = mockOrders.filter(order => 
    selectedStatus === 'all' || order.status === selectedStatus
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case 'filled':
        return <Badge className="bg-blue-100 text-blue-800">Filled</Badge>
      case 'expired':
        return <Badge className="bg-gray-100 text-gray-800">Expired</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">My Orders</h1>
          <p className="text-gray-600 text-lg">
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
            className={`px-4 py-2 rounded-lg font-medium capitalize ${
              selectedStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold mb-2">No orders found</h3>
          <p className="text-gray-600 mb-6">
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
          {filteredOrders.map((order) => (
            <div 
              key={order.id}
              className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold">
                    {order.makingAmount} {order.makerAsset.symbol} → {order.takingAmount} {order.takerAsset.symbol}
                  </h3>
                  {getStatusBadge(order.status)}
                </div>
                
                <div className="text-sm text-gray-500">
                  ID: {order.id}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-700">Limit Price</div>
                  <div>{order.limitPrice} {order.takerAsset.symbol}</div>
                </div>
                
                <div>
                  <div className="font-medium text-gray-700">Created</div>
                  <div>{order.createdAt.toLocaleDateString()}</div>
                </div>
                
                <div>
                  <div className="font-medium text-gray-700">Expires</div>
                  <div>{order.expiration.toLocaleDateString()}</div>
                </div>
                
                <div>
                  <div className="font-medium text-gray-700">Rate</div>
                  <div>
                    1 {order.makerAsset.symbol} = {(parseFloat(order.takingAmount) / parseFloat(order.makingAmount)).toFixed(2)} {order.takerAsset.symbol}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  🔒 Hidden constraints active
                </div>
                
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                  
                  {order.status === 'active' && (
                    <Button variant="outline" size="sm" className="text-red-600 border-red-600 hover:bg-red-50">
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 