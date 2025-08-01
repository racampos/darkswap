'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrderCreateForm } from '@/components/maker/OrderCreateForm'
import { Card } from '@/components/ui/Card'

export default function CreateOrderPage() {
  const router = useRouter()
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const handleSuccess = (orderId: string) => {
    setSuccessMessage(`Order created successfully! Order ID: ${orderId}`)
    setErrorMessage('')
    
    // Redirect to orders page after a short delay
    setTimeout(() => {
      router.push('/maker/orders')
    }, 2000)
  }

  const handleError = (error: string) => {
    setErrorMessage(error)
    setSuccessMessage('')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create Privacy Order</h1>
          <p className="text-muted-foreground">
            Create a privacy-preserving limit order with hidden constraints that protect you from MEV and frontrunning.
          </p>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center">
              <div className="text-green-600 text-xl mr-3">✅</div>
              <div>
                <h3 className="text-green-800 dark:text-green-200 font-medium">Success!</h3>
                <p className="text-green-700 dark:text-green-300">{successMessage}</p>
                <p className="text-green-600 dark:text-green-400 text-sm mt-1">Redirecting to your orders...</p>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <div className="text-red-600 text-xl mr-3">❌</div>
              <div>
                <h3 className="text-red-800 dark:text-red-200 font-medium">Error</h3>
                <p className="text-red-700 dark:text-red-300">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        <Card className="p-8">
          <OrderCreateForm 
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </Card>

        {/* Info Panel */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">How Privacy Orders Work</h3>
          <div className="space-y-2 text-blue-800 dark:text-blue-200">
            <p className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span><strong>Hidden Constraints:</strong> Your secret price and amount limits are cryptographically hidden from other traders</span>
            </p>
            <p className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span><strong>MEV Protection:</strong> Frontrunners can't see your true constraints, preventing sandwich attacks</span>
            </p>
            <p className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span><strong>Zero-Knowledge Proofs:</strong> When filled, the system proves your constraints were met without revealing them</span>
            </p>
            <p className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span><strong>Trustless:</strong> All verification happens on-chain through smart contracts</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 