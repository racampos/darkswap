'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

// Mock data for now - will be replaced with real API integration in future commits
const mockFillHistory = [
  {
    id: 'fill_1',
    orderId: 'order_mdt0z6lu_cflyr8',
    fillAmount: '0.5',
    executedPrice: '3500',
    txHash: '0x1234...abcd',
    status: 'success',
    timestamp: Date.now() - 3600000,
    makerToken: { symbol: 'WETH', decimals: 18 },
    takerToken: { symbol: 'USDC', decimals: 6 },
  },
  {
    id: 'fill_2',
    orderId: 'order_mdt15imm_7rkrl6',
    fillAmount: '0.8',
    executedPrice: '3567',
    txHash: '0x5678...efgh',
    status: 'success',
    timestamp: Date.now() - 7200000,
    makerToken: { symbol: 'WETH', decimals: 18 },
    takerToken: { symbol: 'USDC', decimals: 6 },
  },
]

export default function TakerHistoryPage() {
  const { address } = useAccount()
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d' | 'all'>('all')

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Success</Badge>
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Unknown</Badge>
    }
  }

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔗</div>
          <h3 className="text-xl font-semibold mb-2 text-foreground">Wallet not connected</h3>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to view your fill history.
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
          <h1 className="text-3xl font-bold mb-2 text-foreground">Fill History</h1>
          <p className="text-muted-foreground">
            Track your order fills and transaction history
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/taker'}
          >
            ← Back to Dashboard
          </Button>
          <Button onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6 text-center bg-card">
          <div className="text-2xl font-bold text-foreground mb-1">
            {mockFillHistory.length}
          </div>
          <div className="text-muted-foreground text-sm">Total Fills</div>
        </Card>
        
        <Card className="p-6 text-center bg-card">
          <div className="text-2xl font-bold text-foreground mb-1">
            {mockFillHistory.filter(f => f.status === 'success').length}
          </div>
          <div className="text-muted-foreground text-sm">Successful</div>
        </Card>
        
        <Card className="p-6 text-center bg-card">
          <div className="text-2xl font-bold text-foreground mb-1">
            $12,345
          </div>
          <div className="text-muted-foreground text-sm">Total Volume</div>
        </Card>
        
        <Card className="p-6 text-center bg-card">
          <div className="text-2xl font-bold text-foreground mb-1">
            $3.45
          </div>
          <div className="text-muted-foreground text-sm">Avg Gas Fee</div>
        </Card>
      </div>

      {/* Period Filter */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm text-muted-foreground">Period:</span>
        <div className="flex gap-2">
          {(['24h', '7d', '30d', 'all'] as const).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
            >
              {period === '24h' ? '24 Hours' :
               period === '7d' ? '7 Days' :
               period === '30d' ? '30 Days' : 'All Time'}
            </Button>
          ))}
        </div>
      </div>

      {/* History List */}
      {mockFillHistory.length === 0 ? (
        <Card className="p-8 text-center bg-card">
          <div className="text-4xl mb-4">📈</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No fill history</h3>
          <p className="text-muted-foreground mb-6">
            You haven't filled any orders yet. Start by discovering available orders!
          </p>
          <Button onClick={() => window.location.href = '/taker/discover'}>
            Discover Orders
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {mockFillHistory.map((fill) => (
            <Card key={fill.id} className="p-6 bg-card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="font-semibold text-foreground">
                      {fill.fillAmount} {fill.makerToken.symbol} → {(parseFloat(fill.fillAmount) * parseFloat(fill.executedPrice)).toFixed(2)} {fill.takerToken.symbol}
                    </div>
                    {getStatusBadge(fill.status)}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Order ID: {fill.orderId}</div>
                    <div>Executed at: {fill.executedPrice} {fill.takerToken.symbol} per {fill.makerToken.symbol}</div>
                    <div>
                      Transaction: 
                      <a 
                        href={`https://etherscan.io/tx/${fill.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-blue-400 hover:text-blue-300 font-mono"
                      >
                        {fill.txHash.slice(0, 10)}...{fill.txHash.slice(-8)}
                      </a>
                    </div>
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {new Date(fill.timestamp).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(fill.timestamp).toLocaleTimeString()}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`https://etherscan.io/tx/${fill.txHash}`, '_blank')}
                  >
                    View on Explorer
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Coming Soon Notice */}
      <Card className="p-6 bg-muted/30 mt-8">
        <h3 className="text-lg font-semibold text-foreground mb-3">
          📊 Advanced Analytics Coming Soon
        </h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Future features will include:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Detailed profit/loss analysis</li>
            <li>Gas cost optimization insights</li>
            <li>Performance metrics and benchmarks</li>
            <li>Export to CSV for accounting</li>
            <li>Real-time portfolio tracking</li>
          </ul>
        </div>
      </Card>
    </div>
  )
} 