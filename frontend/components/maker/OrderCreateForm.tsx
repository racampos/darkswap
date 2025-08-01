'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { TokenSelector } from './TokenSelector'
import { AmountInput } from './AmountInput'
import { SecretsForm } from './SecretsForm'
import { OrderPreview } from './OrderPreview'
import { 
  CreateOrderSchema, 
  type CreateOrderFormData, 
  getDefaultFormValues,
  generateRandomNonce 
} from '@/components/forms/CreateOrderSchema'

interface OrderCreateFormProps {
  onSubmit: (data: CreateOrderFormData) => void
  isLoading?: boolean
}

export function OrderCreateForm({ onSubmit, isLoading = false }: OrderCreateFormProps) {
  const [currentStep, setCurrentStep] = useState(0)
  
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
    if (making <= 0 || taking <= 0) return null
    return taking / making
  })()

  // Manual validation check as fallback when React Hook Form's isValid is incorrect
  const isFormActuallyValid = (() => {
    try {
      // Check if all required fields are present
      const hasRequiredFields = !!(
        watchedValues.makerAsset &&
        watchedValues.takerAsset &&
        watchedValues.makingAmount &&
        watchedValues.takingAmount &&
        watchedValues.secrets?.secretPrice &&
        watchedValues.secrets?.secretAmount &&
        watchedValues.secrets?.nonce &&
        // Only require expiration if order expires
        (watchedValues.doesNotExpire === true || watchedValues.expiration)
      )

      // Check if there are no errors
      const hasNoErrors = Object.keys(errors).length === 0

      // Try to validate with Zod schema
      const result = CreateOrderSchema.safeParse(watchedValues)
      
      return hasRequiredFields && hasNoErrors && result.success
    } catch {
      return false
    }
  })()

  const steps = [
    {
      title: 'Token Pair',
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
      title: 'Amounts & Pricing',
      description: 'Set your trade amounts',
      component: (
        <div className="space-y-6">
          <AmountInput
            label={`Amount to Sell (${watchedValues.makerAsset?.symbol || 'Token'})`}
            value={watchedValues.makingAmount || ''}
            onChange={(value) => setValue('makingAmount', value)}
            placeholder="0.0"
            tokenSymbol={watchedValues.makerAsset?.symbol}
            error={errors.makingAmount?.message}
            maxDecimals={watchedValues.makerAsset?.decimals || 18}
          />
          
          <AmountInput
            label={`Amount to Receive (${watchedValues.takerAsset?.symbol || 'Token'})`}
            value={watchedValues.takingAmount || ''}
            onChange={(value) => setValue('takingAmount', value)}
            placeholder="0.0"
            tokenSymbol={watchedValues.takerAsset?.symbol}
            error={errors.takingAmount?.message}
            maxDecimals={watchedValues.takerAsset?.decimals || 18}
          />

          {/* Show calculated exchange rate */}
          {exchangeRate && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-1">Exchange Rate</h4>
              <p className="text-sm text-blue-700">
                1 {watchedValues.makerAsset?.symbol} = {exchangeRate.toFixed(6)} {watchedValues.takerAsset?.symbol}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                This rate is publicly visible to takers
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

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              {...register('allowPartialFill')}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label className="text-sm font-medium">Allow partial fills</label>
          </div>
        </div>
      ),
    },
    {
      title: 'Hidden Constraints',
      description: 'Set your secret minimum requirements',
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
      description: 'Review your order and create it',
      component: (
        <div className="space-y-6">
          <OrderPreview 
            formData={watchedValues} 
            isValid={isFormActuallyValid}
            commitmentHash="0x..." // TODO: Calculate actual commitment hash
          />
          
          <Button
            type="submit"
            className="w-full"
            disabled={!isFormActuallyValid || isLoading}
          >
            {isLoading ? 'Creating Order...' : 'Create Order'}
          </Button>
          
          {/* Debug info for development */}
          {(!isValid || !isFormActuallyValid) && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              <details>
                <summary>Debug: Form validation status</summary>
                <div className="mt-2 space-y-1">
                  <div>React Hook Form isValid: {isValid ? 'true' : 'false'}</div>
                  <div>Manual validation: {isFormActuallyValid ? 'true' : 'false'}</div>
                  <div>Errors count: {Object.keys(errors).length}</div>
                  <pre className="text-xs bg-white p-2 mt-2 rounded border">
                    {JSON.stringify({
                      hasAllFields: {
                        makerAsset: !!watchedValues.makerAsset,
                        takerAsset: !!watchedValues.takerAsset,
                        makingAmount: !!watchedValues.makingAmount,
                        takingAmount: !!watchedValues.takingAmount,
                        secretPrice: !!watchedValues.secrets?.secretPrice,
                        secretAmount: !!watchedValues.secrets?.secretAmount,
                        nonce: !!watchedValues.secrets?.nonce,
                        doesNotExpire: !!watchedValues.doesNotExpire,
                        expiration: !!watchedValues.expiration,
                        expirationValid: watchedValues.doesNotExpire === true || !!watchedValues.expiration,
                      },
                      errors: errors
                    }, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}
        </div>
      ),
    },
  ]

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
      case 0:
        return watchedValues.makerAsset && watchedValues.takerAsset
      case 1:
        return (
          watchedValues.makingAmount &&
          watchedValues.takingAmount &&
          !errors.makingAmount &&
          !errors.takingAmount
        )
      case 2:
        return (
          watchedValues.secrets?.secretPrice &&
          watchedValues.secrets?.secretAmount &&
          !errors.secrets?.secretPrice &&
          !errors.secrets?.secretAmount
        )
      default:
        return true
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center flex-1">
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

      {/* Navigation Buttons */}
      {currentStep < steps.length - 1 && (
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          
          <Button
            type="button"
            onClick={nextStep}
            disabled={!canProceed()}
          >
            Next
          </Button>
        </div>
      )}
    </form>
  )
} 