'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

// API Health Check Hook
export function useAPIHealth() {
  return useQuery({
    queryKey: ['api', 'health'],
    queryFn: () => apiClient.healthCheck(),
    refetchInterval: 30000, // Check every 30 seconds
    retry: 3,
    staleTime: 10000, // Consider data fresh for 10 seconds
  })
}

// API Configuration Hook
export function useAPIConfig() {
  const queryClient = useQueryClient()

  const updateBaseURL = (newBaseURL: string) => {
    apiClient.setBaseURL(newBaseURL)
    // Invalidate all API queries when base URL changes
    queryClient.invalidateQueries({ queryKey: ['api'] })
  }

  const updateTimeout = (newTimeout: number) => {
    apiClient.setTimeout(newTimeout)
  }

  return {
    baseURL: apiClient.getBaseURL(),
    updateBaseURL,
    updateTimeout,
    invalidateAllQueries: () => queryClient.invalidateQueries({ queryKey: ['api'] }),
    refetchHealth: () => queryClient.refetchQueries({ queryKey: ['api', 'health'] }),
  }
}

// Connection Status Hook
export function useAPIConnection() {
  const healthQuery = useAPIHealth()

  const isConnected = healthQuery.data?.status === 'healthy'
  const isLoading = healthQuery.isLoading
  const hasError = healthQuery.isError
  const error = healthQuery.error

  return {
    isConnected,
    isLoading,
    hasError,
    error,
    health: healthQuery.data,
    refetch: () => {
      healthQuery.refetch()
    },
  }
}

// Generic API Error Handler Hook
export function useAPIErrorHandler() {
  const handleError = (error: unknown, context?: string) => {
    console.error('API Error:', { error, context })
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('timeout')) {
        return 'Request timed out. Please try again.'
      }
      
      if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        return 'Network error. Please check your connection.'
      }
      
      if (error.message.includes('400')) {
        return 'Invalid request. Please check your input.'
      }
      
      if (error.message.includes('404')) {
        return 'Resource not found.'
      }
      
      if (error.message.includes('500')) {
        return 'Server error. Please try again later.'
      }
      
      return error.message
    }
    
    return 'An unexpected error occurred.'
  }

  return { handleError }
} 
 
 
 
 