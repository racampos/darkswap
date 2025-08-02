'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { TokenSelector } from './TokenSelector'
import { AmountInput } from './AmountInput'
import { SecretsForm } from './SecretsForm'
import { OrderPreview } from './OrderPreview'
import { useCreateOrder } from '@/lib/hooks/useCreateOrder'
import { useOrderSigning } from '@/lib/hooks/useOrderSigning'
import { usePublishOrder } from '@/lib/hooks/usePublishOrder'
import { parseTokenAmount } from '@/lib/utils/formatting'
import { 
  CreateOrderSchema, 
  type CreateOrderFormData, 
  getDefaultFormValues,
  generateRandomNonce 
} from '@/components/forms/CreateOrderSchema'

interface OrderCreateFormProps {
  onSuccess?: (orderId: string) => void
  onError?: (error: string) => void
}

export function OrderCreateForm({ onSuccess, onError }: OrderCreateFormProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>('')
  
  // Hooks for order workflow
  const createOrder = useCreateOrder()
  const signOrder = useOrderSigning()
  const publishOrder = usePublishOrder()
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<CreateOrderFormData>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: getDefaultFormValues(),
    mode: 'onChange',
  })

  // Watch form values for real-time updates
  const watchedValues = watch()

  // Initialize nonce if not set
  if (!watchedValues.secrets?.nonce) {
    setValue('secrets.nonce', generateRandomNonce())
  }

  // Calculate implied exchange rate for display
  const exchangeRate = (() => {
    if (!watchedValues.makingAmount || !watchedValues.takingAmount) return null
    const making = parseFloat(watchedValues.makingAmount)
    const taking = parseFloat(watchedValues.takingAmount)
    if (making === 0) return null
    return taking / making
  })()

  // Manual validation check for form completeness
  const isFormActuallyValid = (() => {
    try {
      CreateOrderSchema.parse(watchedValues)
      return true
    } catch {
      return false
    }
  })()

  // Define form steps
  const steps = [
    {
      title: 'Trading Pair',
      description: 'Select the tokens you want to trade',
      component: (
        <div className="space-y-6">
          <TokenSelector
            label="Token You're Selling (Maker Asset)"
            selectedToken={watchedValues.makerAsset || null}
            onTokenSelect={(token) => setValue('makerAsset', token)}
            excludeTokens={watchedValues.takerAsset ? [watchedValues.takerAsset.address] : []}
          />
          
          <TokenSelector
            label="Token You Want (Taker Asset)"
            selectedToken={watchedValues.takerAsset || null}
            onTokenSelect={(token) => setValue('takerAsset', token)}
            excludeTokens={watchedValues.makerAsset ? [watchedValues.makerAsset.address] : []}
          />
        </div>
      ),
    },
    {
      title: 'Amounts',
      description: 'Set your trading amounts and exchange rate',
      component: (
        <div className="space-y-6">
          <AmountInput
            label="You're offering"
            value={watchedValues.makingAmount || ''}
            onChange={(value) => setValue('makingAmount', value)}
            tokenSymbol={watchedValues.makerAsset?.symbol}
            error={errors.makingAmount?.message}
            maxDecimals={watchedValues.makerAsset?.decimals || 18}
          />
          
          <AmountInput
            label="You want to receive"
            value={watchedValues.takingAmount || ''}
            onChange={(value) => setValue('takingAmount', value)}
            tokenSymbol={watchedValues.takerAsset?.symbol}
            error={errors.takingAmount?.message}
            maxDecimals={watchedValues.takerAsset?.decimals || 18}
          />
          
          {exchangeRate && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Exchange Rate</p>
              <p className="text-lg font-medium text-foreground">
                1 {watchedValues.makerAsset?.symbol} = {exchangeRate.toFixed(2)} {watchedValues.takerAsset?.symbol}
              </p>
            </div>
          )}
          
          {/* Expiration Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                {...register('doesNotExpire')}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label className="text-sm font-medium">Order does not expire</label>
            </div>

            {!watchedValues.doesNotExpire && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Expiration Date</label>
                <input
                  type="datetime-local"
                  {...register('expiration', {
                    setValueAs: (value) => value ? Math.floor(new Date(value).getTime() / 1000) : undefined,
                  })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                />
                {errors.expiration && (
                  <p className="text-sm text-red-600">{errors.expiration.message}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Privacy Settings',
      description: 'Configure your hidden constraints for privacy protection',
      component: (
        <SecretsForm
          secretPrice={watchedValues.secrets?.secretPrice || ''}
          secretAmount={watchedValues.secrets?.secretAmount || ''}
          nonce={watchedValues.secrets?.nonce}
          onSecretPriceChange={(value) => setValue('secrets.secretPrice', value)}
          onSecretAmountChange={(value) => setValue('secrets.secretAmount', value)}
          onNonceChange={(value) => setValue('secrets.nonce', value)}
          takerTokenSymbol={watchedValues.takerAsset?.symbol}
          makerTokenSymbol={watchedValues.makerAsset?.symbol}
          errors={{
            secretPrice: errors.secrets?.secretPrice?.message,
            secretAmount: errors.secrets?.secretAmount?.message,
            nonce: errors.secrets?.nonce?.message,
          }}
        />
      ),
    },
    {
      title: 'Review & Create',
      description: 'Review your order details and create your privacy-preserving order',
      component: (
        <div className="space-y-6">
          <OrderPreview 
            formData={watchedValues} 
            isValid={isFormActuallyValid}
          />
          
          {/* Processing status */}
          {isProcessing && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="text-blue-600 font-medium">{processingStep}</span>
              </div>
            </div>
          )}
          
          {/* Error display */}
          {(createOrder.error || signOrder.error || publishOrder.error) && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-red-600 font-medium">
                {createOrder.error || signOrder.error || publishOrder.error}
              </p>
            </div>
          )}
        </div>
      ),
    },
  ]

  // Step navigation functions
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Trading Pair
        return watchedValues.makerAsset && watchedValues.takerAsset && 
               watchedValues.makerAsset !== watchedValues.takerAsset
      case 1: // Amounts
        return watchedValues.makingAmount && watchedValues.takingAmount &&
               parseFloat(watchedValues.makingAmount) > 0 && parseFloat(watchedValues.takingAmount) > 0
      case 2: // Privacy Settings
        return watchedValues.secrets?.secretPrice && watchedValues.secrets?.secretAmount && 
               watchedValues.secrets?.nonce
      default:
        return true
    }
  }

  // Handle complete order creation workflow
  const handleCreateOrder = async (data: CreateOrderFormData) => {
    // Only proceed if we're on the final step and user explicitly clicked Create Order
    if (currentStep !== 3) {
      console.log('Preventing premature form submission, current step:', currentStep)
      return
    }

    if (!createOrder.isConnected) {
      onError?.('Please connect your wallet first')
      return
    }

    setIsProcessing(true)
    
    try {
      // Step 1: Create commitment order
      setProcessingStep('Creating commitment order...')
      const order = await createOrder.createOrder({
        makerAsset: data.makerAsset?.symbol as 'WETH' | 'USDC',
        takerAsset: data.takerAsset?.symbol as 'WETH' | 'USDC',
        makingAmount: parseTokenAmount(data.makingAmount, data.makerAsset?.decimals || 18).toString(),
        takingAmount: parseTokenAmount(data.takingAmount, data.takerAsset?.decimals || 18).toString(),
        secretPrice: parseTokenAmount(data.secrets.secretPrice, data.takerAsset?.decimals || 18).toString(),
        secretAmount: parseTokenAmount(data.secrets.secretAmount, data.takerAsset?.decimals || 18).toString(),
        expiry: data.doesNotExpire ? 0 : Math.floor(new Date(data.expiration || '').getTime() / 1000),
        nonce: BigInt(data.secrets.nonce || 0),
      })

      if (!order) {
        throw new Error('Failed to create order')
      }

      // Step 2: Sign the order
      setProcessingStep('Requesting signature from wallet...')
      const signingResult = await signOrder.signOrder(order.order)
      
      if (!signingResult) {
        throw new Error('Failed to sign order')
      }

      // Step 3: Publish the order
      setProcessingStep('Publishing order to network...')
      const publishedOrder = await publishOrder.publishOrder({
        order,
        signature: signingResult.signature,
        orderHash: signingResult.orderHash,
      })

      if (!publishedOrder) {
        throw new Error('Failed to publish order')
      }

      setProcessingStep('Order created successfully!')
      
      // Success - call the success callback with the order ID
      onSuccess?.(publishedOrder.id || 'unknown')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      onError?.(errorMessage)
    } finally {
      setIsProcessing(false)
      setProcessingStep('')
    }
  }

  // Handle Create Order button click explicitly
  const handleCreateOrderClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault() // Prevent any default behavior
    console.log('Create Order button explicitly clicked')
    
    // Manually trigger form validation and submission
    const isValid = await handleSubmit(handleCreateOrder)()
  }

  return (
    <form onSubmit={handleSubmit(handleCreateOrder)} className="space-y-8">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              {/* Step Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index + 1}
              </div>
              
              {/* Connecting Line */}
              {index < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-4 ${
                    index < currentStep ? 'bg-blue-600' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-4">
          <h2 className="text-xl font-semibold text-foreground">{steps[currentStep].title}</h2>
          <p className="text-muted-foreground">{steps[currentStep].description}</p>
        </div>
      </div>

      {/* Current Step Content */}
      <div className="mb-8">
        {steps[currentStep].component}
      </div>

      {/* Error Messages from Hooks */}
      {(createOrder.error || signOrder.error || publishOrder.error) && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start">
            <div className="text-red-600 text-xl mr-3">❌</div>
            <div className="flex-1">
              <h3 className="text-red-800 dark:text-red-200 font-medium mb-2">Error Details</h3>
              {createOrder.error && (
                <p className="text-red-700 dark:text-red-300 text-sm mb-1">
                  <strong>Order Creation:</strong> {createOrder.error}
                </p>
              )}
              {signOrder.error && (
                <p className="text-red-700 dark:text-red-300 text-sm mb-1">
                  <strong>Signing:</strong> {signOrder.error}
                </p>
              )}
              {publishOrder.error && (
                <p className="text-red-700 dark:text-red-300 text-sm mb-1">
                  <strong>Publishing:</strong> {publishOrder.error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        {currentStep > 0 ? (
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setCurrentStep(currentStep - 1)}
            disabled={isProcessing}
          >
            Previous
          </Button>
        ) : (
          <div></div>
        )}

        {currentStep < 3 ? (
          <Button 
            type="button" 
            onClick={nextStep}
            disabled={!canProceed() || isProcessing}
          >
            Next
          </Button>
        ) : (
          <Button 
            type="button"
            disabled={!isFormActuallyValid || isProcessing || !createOrder.isConnected}
            className="min-w-[140px]"
            onClick={handleCreateOrderClick}
          >
            {isProcessing ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>{processingStep || 'Creating...'}</span>
              </div>
            ) : (
              'Create Order'
            )}
          </Button>
        )}
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs space-y-2">
          <p><strong>Form Valid:</strong> {isFormActuallyValid ? 'Yes' : 'No'}</p>
          <p><strong>Wallet Connected:</strong> {createOrder.isConnected ? 'Yes' : 'No'}</p>
          <p><strong>Can Proceed:</strong> {canProceed() ? 'Yes' : 'No'}</p>
          <p><strong>Processing:</strong> {isProcessing ? 'Yes' : 'No'}</p>
          <p><strong>Current Step:</strong> {currentStep}</p>
          <p><strong>Form Errors:</strong> {Object.keys(errors).length > 0 ? JSON.stringify(errors, null, 2) : 'None'}</p>
          {createOrder.error && <p><strong>Create Order Error:</strong> {createOrder.error}</p>}
          {signOrder.error && <p><strong>Sign Order Error:</strong> {signOrder.error}</p>}
          {publishOrder.error && <p><strong>Publish Order Error:</strong> {publishOrder.error}</p>}
          {processingStep && <p><strong>Processing Step:</strong> {processingStep}</p>}
        </div>
      )}
    </form>
  )
} 