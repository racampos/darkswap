'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { OrderStatus } from '@/types'
import { type Address } from 'viem'

interface FilterState {
  network: string
  status?: typeof OrderStatus[keyof typeof OrderStatus] | undefined
  makerAsset?: Address | undefined
  takerAsset?: Address | undefined
  maker?: Address | undefined
  minAmount: string
  maxAmount: string
  searchQuery: string
}

interface OrderFiltersProps {
  filters: FilterState
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

const statusOptions: { value: typeof OrderStatus[keyof typeof OrderStatus]; label: string; color: string }[] = [
  { value: OrderStatus.ACTIVE, label: 'Active', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: OrderStatus.FILLED, label: 'Filled', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: OrderStatus.EXPIRED, label: 'Expired', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  { value: OrderStatus.CANCELLED, label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
]

const tokenOptions = [
  { value: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', label: 'WETH' },
  { value: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', label: 'USDC' },
]

export function OrderFilters({ filters, onFilterChange, onClearFilters, hasActiveFilters }: OrderFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.status) count++
    if (filters.makerAsset) count++
    if (filters.takerAsset) count++
    if (filters.minAmount) count++
    if (filters.maxAmount) count++
    return count
  }

  const activeCount = getActiveFilterCount()

  return (
    <div className="space-y-4">
      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          >
            <path 
              d="M6 9L12 15L18 9" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          Filters
          {activeCount > 0 && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              {activeCount}
            </Badge>
          )}
        </Button>

        {hasActiveFilters && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClearFilters}
            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="p-4 bg-muted/30 rounded-lg space-y-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!filters.status ? "default" : "outline"}
                size="sm"
                onClick={() => onFilterChange('status', undefined)}
              >
                All
              </Button>
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={filters.status === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onFilterChange('status', option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Token Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Maker Asset (Selling)
              </label>
              <select
                value={filters.makerAsset || ''}
                onChange={(e) => onFilterChange('makerAsset', e.target.value ? e.target.value as Address : undefined)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground"
              >
                <option value="">All tokens</option>
                {tokenOptions.map((token) => (
                  <option key={token.value} value={token.value}>
                    {token.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Taker Asset (Buying)
              </label>
              <select
                value={filters.takerAsset || ''}
                onChange={(e) => onFilterChange('takerAsset', e.target.value ? e.target.value as Address : undefined)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground"
              >
                <option value="">All tokens</option>
                {tokenOptions.map((token) => (
                  <option key={token.value} value={token.value}>
                    {token.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount Range */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Amount Range
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Min amount"
                  value={filters.minAmount}
                  onChange={(e) => onFilterChange('minAmount', e.target.value)}
                  className="pr-16"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                  Min
                </div>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Max amount"
                  value={filters.maxAmount}
                  onChange={(e) => onFilterChange('maxAmount', e.target.value)}
                  className="pr-16"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                  Max
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Advanced
            </label>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Maker address (0x...)"
                value={filters.maker || ''}
                onChange={(e) => onFilterChange('maker', e.target.value ? e.target.value as Address : undefined)}
              />
            </div>
          </div>

          {/* Apply/Reset Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              {activeCount} filter{activeCount !== 1 ? 's' : ''} applied
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onClearFilters}
                disabled={!hasActiveFilters}
              >
                Reset
              </Button>
              <Button 
                size="sm" 
                onClick={() => setIsExpanded(false)}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {!isExpanded && hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <Badge 
              className="bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-pointer"
              onClick={() => onFilterChange('status', undefined)}
            >
              Status: {filters.status} ×
            </Badge>
          )}
          {filters.makerAsset && (
            <Badge 
              className="bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-pointer"
              onClick={() => onFilterChange('makerAsset', undefined)}
            >
              Selling: {tokenOptions.find(t => t.value === filters.makerAsset)?.label || 'Unknown'} ×
            </Badge>
          )}
          {filters.takerAsset && (
            <Badge 
              className="bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-pointer"
              onClick={() => onFilterChange('takerAsset', undefined)}
            >
              Buying: {tokenOptions.find(t => t.value === filters.takerAsset)?.label || 'Unknown'} ×
            </Badge>
          )}
          {filters.minAmount && (
            <Badge 
              className="bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-pointer"
              onClick={() => onFilterChange('minAmount', '')}
            >
              Min: {filters.minAmount} ×
            </Badge>
          )}
          {filters.maxAmount && (
            <Badge 
              className="bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-pointer"
              onClick={() => onFilterChange('maxAmount', '')}
            >
              Max: {filters.maxAmount} ×
            </Badge>
          )}
        </div>
      )}
    </div>
  )
} 