import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function MakerDashboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Maker Dashboard</h1>
        <p className="text-gray-600 text-lg">
          Create and manage your DarkSwap limit orders with zero-knowledge privacy
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xl font-bold mr-4">
              +
            </div>
            <div>
              <h3 className="text-xl font-semibold">Create New Order</h3>
              <p className="text-gray-600">Set up a new limit order with hidden constraints</p>
            </div>
          </div>
          <Link href="/maker/create">
            <Button className="w-full">
              Create Order
            </Button>
          </Link>
        </Card>

        <Card className="p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-white text-xl font-bold mr-4">
              📋
            </div>
            <div>
              <h3 className="text-xl font-semibold">My Orders</h3>
              <p className="text-gray-600">View and manage your existing orders</p>
            </div>
          </div>
          <Link href="/maker/orders">
            <Button variant="outline" className="w-full">
              View Orders
            </Button>
          </Link>
        </Card>
      </div>

      {/* Features Overview */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-6">How DarkSwap Works</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Private Constraints</h3>
              <p className="text-gray-600 text-sm">
                Set hidden minimum price and amount requirements using zero-knowledge proofs
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">MEV Protection</h3>
              <p className="text-gray-600 text-sm">
                Hide your true intentions from MEV bots and frontrunners
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Better Execution</h3>
              <p className="text-gray-600 text-sm">
                Get better prices by hiding your minimum acceptable terms
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Getting Started */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3 mt-0.5">
              1
            </div>
            <div>
              <h4 className="font-medium">Connect Your Wallet</h4>
              <p className="text-gray-600 text-sm">Connect your Web3 wallet to start creating orders</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3 mt-0.5">
              2
            </div>
            <div>
              <h4 className="font-medium">Set Public and Private Terms</h4>
              <p className="text-gray-600 text-sm">Define your public limit order and hidden minimum requirements</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3 mt-0.5">
              3
            </div>
            <div>
              <h4 className="font-medium">Publish Your Order</h4>
              <p className="text-gray-600 text-sm">Your order is published off-chain for takers to discover</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3 mt-0.5">
              4
            </div>
            <div>
              <h4 className="font-medium">Authorize Fills</h4>
              <p className="text-gray-600 text-sm">Takers request fills through your REST service, which provides ZK proofs for valid fills</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
} 