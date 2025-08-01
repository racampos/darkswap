'use client'

import { useState } from 'react'
import { OrderCreateForm } from '@/components/maker/OrderCreateForm'
import type { CreateOrderFormData } from '@/components/forms/CreateOrderSchema'

export default function CreateOrderPage() {
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateOrder = async (data: CreateOrderFormData) => {
    setIsCreating(true)
    
    try {
      console.log('Creating order with data:', data)
      
      // TODO: Integrate with actual order creation API
      // This will be implemented in Commit 4
      
      // Simulate order creation
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      alert('Order created successfully! (This is a placeholder)')
      
    } catch (error) {
      console.error('Failed to create order:', error)
      alert('Failed to create order. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Create New Order</h1>
        <p className="text-gray-600 text-lg">
          Set up your limit order with hidden constraints using zero-knowledge proofs
        </p>
      </div>

      <OrderCreateForm 
        onSubmit={handleCreateOrder}
        isLoading={isCreating}
      />
    </div>
  )
} 