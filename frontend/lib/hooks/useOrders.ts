'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type Address } from 'viem'
import { OrdersAPI } from '@/lib/api/orders'
import { 
  type PublishedOrder, 
  type AuthorizeFillResponse,
  type CreateOrderRequest 
} from '@/lib/api/types'
import { 
  type OrderStatus, 
  type OrderMetadata, 
  type SecretParameters, 
  type OrderData 
} from '@/types'

// Order Discovery Hook
export function useOrderDiscovery(filters?: {
  network?: string
  makerAsset?: Address
  takerAsset?: Address
  maker?: Address
  status?: OrderStatus
  limit?: number
}) {
  return useQuery({
    queryKey: ['orders', 'discover', filters],
    queryFn: () => OrdersAPI.discoverOrders(filters),
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000,
    retry: 2,
  })
}

// Active Trading Pair Orders Hook
export function useActiveTradingPairOrders(
  network: string,
  makerAsset?: Address,
  takerAsset?: Address,
  limit = 20
) {
  return useQuery({
    queryKey: ['orders', 'active', network, makerAsset, takerAsset, limit],
    queryFn: () => OrdersAPI.getActiveTradingPairOrders(network, makerAsset, takerAsset, limit),
    enabled: !!network,
    refetchInterval: 5000, // Refresh more frequently for active orders
    staleTime: 2000,
    retry: 2,
  })
}

// Single Order Hook
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['orders', 'single', orderId],
    queryFn: () => OrdersAPI.getOrderById(orderId),
    enabled: !!orderId,
    staleTime: 30000, // Single orders don't change often
    retry: 2,
  })
}

// Maker's Orders Hook
export function useMakerOrders(makerAddress?: Address, limit = 10) {
  return useQuery({
    queryKey: ['orders', 'maker', makerAddress, limit],
    queryFn: () => OrdersAPI.getOrdersByMaker(makerAddress!, limit),
    enabled: !!makerAddress,
    refetchInterval: 15000,
    staleTime: 10000,
    retry: 2,
  })
}

// Order Search Hook
export function useOrderSearch(searchParams: {
  network?: string
  makerAsset?: Address
  takerAsset?: Address
  maker?: Address
  status?: OrderStatus
  minAmount?: string
  maxAmount?: string
}) {
  return useQuery({
    queryKey: ['orders', 'search', searchParams],
    queryFn: () => OrdersAPI.searchOrders(searchParams),
    enabled: Object.values(searchParams).some(value => value !== undefined),
    staleTime: 10000,
    retry: 2,
  })
}

// Order Authorization Hook
export function useOrderAuthorization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      orderHash,
      fillAmount,
      takerAddress,
    }: {
      orderHash: string
      fillAmount: string
      takerAddress: Address
    }) => {
      return OrdersAPI.requestFillAuthorization(orderHash, fillAmount, takerAddress)
    },
    onSuccess: (data, variables) => {
      // Optionally invalidate order queries after successful authorization
      queryClient.invalidateQueries({ 
        queryKey: ['orders', 'single', variables.orderHash] 
      })
    },
  })
}

// Order Publishing Hook
export function useOrderPublishing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      order,
      signature,
      metadata,
      secrets,
      chainId = 1,
      extension,
    }: {
      order: OrderData
      signature: string
      metadata: OrderMetadata
      secrets: SecretParameters
      chainId?: number
      extension?: string
    }) => {
      return OrdersAPI.publishOrder(order, signature, metadata, secrets, chainId, extension)
    },
    onSuccess: (newOrder, variables) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      
      // Optionally add the new order to cache
      queryClient.setQueryData(['orders', 'single', newOrder.id], newOrder)
      
      // Update maker's orders list if we have the maker address
      if (variables.order.maker) {
        queryClient.invalidateQueries({ 
          queryKey: ['orders', 'maker', variables.order.maker] 
        })
      }
    },
  })
}

// Order Status Update Hook
export function useOrderStatusUpdate() {
  const queryClient = useQueryClient()

  const markFilled = useMutation({
    mutationFn: async ({ orderId, txHash }: { orderId: string; txHash: string }) => {
      return OrdersAPI.markOrderFilled(orderId, txHash)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['orders', 'single', variables.orderId] 
      })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const markCancelled = useMutation({
    mutationFn: async ({ orderId, txHash }: { orderId: string; txHash?: string }) => {
      return OrdersAPI.markOrderCancelled(orderId, txHash)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['orders', 'single', variables.orderId] 
      })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  return {
    markFilled,
    markCancelled,
  }
}

// Order Analytics Hook
export function useOrderAnalytics(orders: PublishedOrder[]) {
  const analytics = useMemo(() => {
    if (!orders.length) {
      return {
        totalOrders: 0,
        totalVolume: '0',
        averageOrderSize: '0',
        statusBreakdown: {},
        topTradingPairs: [],
      }
    }

    const statusBreakdown = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1
      return acc
    }, {} as Record<OrderStatus, number>)

    const totalVolume = orders.reduce((sum, order) => {
      return sum + BigInt(order.order.makingAmount)
    }, BigInt(0))

    const averageOrderSize = totalVolume / BigInt(orders.length)

    const tradingPairs = orders.reduce((acc, order) => {
      const pair = `${order.metadata.makerToken.symbol}/${order.metadata.takerToken.symbol}`
      acc[pair] = (acc[pair] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topTradingPairs = Object.entries(tradingPairs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([pair, count]) => ({ pair, count }))

    return {
      totalOrders: orders.length,
      totalVolume: totalVolume.toString(),
      averageOrderSize: averageOrderSize.toString(),
      statusBreakdown,
      topTradingPairs,
    }
  }, [orders])

  return analytics
}

// Order Filtering Hook
export function useOrderFilters() {
  const [filters, setFilters] = useState({
    network: '',
    status: undefined as OrderStatus | undefined,
    makerAsset: undefined as Address | undefined,
    takerAsset: undefined as Address | undefined,
    maker: undefined as Address | undefined,
    minAmount: '',
    maxAmount: '',
  })

  const updateFilter = <K extends keyof typeof filters>(
    key: K,
    value: typeof filters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      network: '',
      status: undefined,
      makerAsset: undefined,
      takerAsset: undefined,
      maker: undefined,
      minAmount: '',
      maxAmount: '',
    })
  }

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== ''
  )

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
  }
} 