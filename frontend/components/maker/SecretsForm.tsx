'use client'

import { AmountInput } from './AmountInput'
import { generateRandomNonce } from '@/components/forms/CreateOrderSchema'

interface SecretsFormProps {
  secretPrice: string
  secretAmount: string
  nonce?: number
  onSecretPriceChange: (value: string) => void
  onSecretAmountChange: (value: string) => void
  onNonceChange: (value: number) => void
  takerTokenSymbol?: string
  makerTokenSymbol?: string
  errors?: {
    secretPrice?: string
    secretAmount?: string
    nonce?: string
  }
  disabled?: boolean
}

export function SecretsForm({
  secretPrice,
  secretAmount,
  nonce,
  onSecretPriceChange,
  onSecretAmountChange,
  onNonceChange,
  takerTokenSymbol,
  makerTokenSymbol,
  errors,
  disabled = false
}: SecretsFormProps) {
  const handleNonceRegenerate = () => {
    onNonceChange(generateRandomNonce())
  }

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          🔒 Hidden Constraints
        </h3>
        <p className="text-sm text-blue-700">
          These constraints are hidden from takers using zero-knowledge proofs. 
          Takers will only learn if their offer meets your requirements after submitting.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AmountInput
          label={`Secret Minimum Price (${takerTokenSymbol || 'Token'})`}
          value={secretPrice}
          onChange={onSecretPriceChange}
          placeholder="0.0"
          disabled={disabled}
          tokenSymbol={takerTokenSymbol}
          error={errors?.secretPrice}
          helperText="Minimum price you're willing to accept per token"
          maxDecimals={18}
        />

        <AmountInput
          label={`Secret Minimum Amount (${makerTokenSymbol || 'Token'})`}
          value={secretAmount}
          onChange={onSecretAmountChange}
          placeholder="0.0"
          disabled={disabled}
          tokenSymbol={makerTokenSymbol}
          error={errors?.secretAmount}
          helperText="Minimum amount that must be filled"
          maxDecimals={18}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">
          Privacy Nonce
        </label>
        
        <div className="flex items-center space-x-3">
          <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono text-gray-900">
            {nonce || 'Not set'}
          </div>
          <button
            type="button"
            onClick={handleNonceRegenerate}
            disabled={disabled}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🎲 New
          </button>
        </div>
        
        {errors?.nonce && (
          <p className="text-sm text-red-600">{errors.nonce}</p>
        )}
        
        <p className="text-xs text-gray-500">
          Random number used to ensure commitment uniqueness. Click "New" to generate a fresh nonce.
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-yellow-600">⚠️</span>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-yellow-800">
              Keep Your Secrets Safe
            </h4>
            <div className="mt-2 text-sm text-yellow-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Secret constraints are cryptographically hidden in your order</li>
                <li>Only you know the actual minimum price and amount</li>
                <li>Takers can only discover if they meet requirements by submitting fills</li>
                <li>Never share these values publicly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 