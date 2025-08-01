'use client'

import { useEffect, useState } from 'react'
import { useAPIConnection } from '@/lib/hooks/useAPI'
import { useNetwork } from '@/lib/hooks/useNetwork'

export function APIStatus() {
  const [mounted, setMounted] = useState(false)
  const { isConnected, isLoading, hasError, health, refetch } = useAPIConnection()
  const { chainId, networkConfig, isSupported } = useNetwork()

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
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
    )
  }

  const getStatusBadge = () => {
    if (isLoading) {
      return (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border-blue-200">
          Checking...
        </span>
      )
    }

    if (hasError) {
      return (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800 border-red-200">
          API Offline
        </span>
      )
    }

    if (isConnected) {
      return (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 border-green-200">
          API Connected
        </span>
      )
    }

    return (
      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-800 border-gray-200">
        Unknown
      </span>
    )
  }

  const getNetworkBadge = () => {
    if (!isSupported) {
      return (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 border-yellow-200">
          Network: {chainId} (Unsupported)
        </span>
      )
    }

    return (
      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border-blue-200">
        Network: {networkConfig?.name || chainId}
      </span>
    )
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">System Status</span>
          <button
            onClick={refetch}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {getStatusBadge()}
          {getNetworkBadge()}
        </div>

        {hasError && (
          <div className="text-xs text-red-600">
            Unable to connect to DarkSwap API. Please ensure the backend service is running.
          </div>
        )}
      </div>
    </div>
  )
} 