import Link from 'next/link'
import { APIStatus } from '@/components/ui/APIStatus'
import { ClientOnly } from '@/lib/utils/clientOnly'

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-16 space-y-16">
      {/* API Status Section */}
      <section className="max-w-md mx-auto">
        <ClientOnly fallback={
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">System Status</span>
                <button className="text-xs text-blue-600 hover:text-blue-800">
                  Refresh
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border-blue-200">
                  Loading...
                </span>
              </div>
            </div>
          </div>
        }>
          <APIStatus />
        </ClientOnly>
      </section>

      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-4">
            Privacy-Preserving DEX
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Trade with{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Hidden Constraints
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            DarkSwap enables limit orders with secret price and amount constraints, 
            enforced cryptographically without revealing them on-chain.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/maker"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8"
          >
            Create Orders →
          </Link>
          <Link 
            href="/taker"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8"
          >
            Browse Orders
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-1.5">
            <div className="w-8 h-8 bg-blue-500 rounded mb-2"></div>
            <h3 className="text-lg font-semibold leading-none tracking-tight">Privacy First</h3>
          </div>
          <div className="pt-4">
            <p className="text-sm text-muted-foreground">
              Your trading constraints remain completely private using zero-knowledge proofs.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-1.5">
            <div className="w-8 h-8 bg-yellow-500 rounded mb-2"></div>
            <h3 className="text-lg font-semibold leading-none tracking-tight">Gas Efficient</h3>
          </div>
          <div className="pt-4">
            <p className="text-sm text-muted-foreground">
              Built on 1inch Limit Order Protocol for optimal gas costs and execution.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-1.5">
            <div className="w-8 h-8 bg-green-500 rounded mb-2"></div>
            <h3 className="text-lg font-semibold leading-none tracking-tight">Transparent</h3>
          </div>
          <div className="pt-4">
            <p className="text-sm text-muted-foreground">
              Orders are publicly discoverable while keeping your constraints secret.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-1.5">
            <div className="w-8 h-8 bg-red-500 rounded mb-2"></div>
            <h3 className="text-lg font-semibold leading-none tracking-tight">Trustless</h3>
          </div>
          <div className="pt-4">
            <p className="text-sm text-muted-foreground">
              No intermediaries. Smart contracts enforce all rules automatically.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
          <p className="text-muted-foreground mt-2">
            Three simple steps to privacy-preserving trading
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              1
            </div>
            <h3 className="text-xl font-semibold">Create Order</h3>
            <p className="text-muted-foreground">
              Set your public limits and hidden constraints. The commitment is generated and the order is published to an off-chain order book.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              2
            </div>
            <h3 className="text-xl font-semibold">Taker Discovery</h3>
            <p className="text-muted-foreground">
              Takers discover your order and request authorization to fill with their desired amount.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              3
            </div>
            <h3 className="text-xl font-semibold">ZK Verification</h3>
            <p className="text-muted-foreground">
              If constraints are met, a ZK proof is generated and the order executes on-chain.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Start Trading Privately?</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Connect your wallet and experience the future of privacy-preserving DeFi.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/maker"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8"
          >
            I want to make orders
          </Link>
          <Link
            href="/taker"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8"
          >
            I want to fill orders
          </Link>
        </div>
      </section>
    </div>
  )
} 