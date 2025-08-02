'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/Input'

interface AmountInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  maxDecimals?: number
  tokenSymbol?: string
  error?: string
  helperText?: string
}

export function AmountInput({
  label,
  value,
  onChange,
  placeholder = "0.0",
  disabled = false,
  maxDecimals = 18,
  tokenSymbol,
  error,
  helperText
}: AmountInputProps) {
  const [focused, setFocused] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value

    // Allow empty string
    if (inputValue === '') {
      onChange('')
      return
    }

    // Only allow numbers and one decimal point
    const regex = /^\d*\.?\d*$/
    if (!regex.test(inputValue)) {
      return
    }

    // Check decimal places
    const parts = inputValue.split('.')
    if (parts[1] && parts[1].length > maxDecimals) {
      return
    }

    // Prevent multiple leading zeros
    if (inputValue.length > 1 && inputValue[0] === '0' && inputValue[1] !== '.') {
      return
    }

    onChange(inputValue)
  }

  const formatDisplayValue = (val: string): string => {
    if (!val || focused) return val
    
    const num = parseFloat(val)
    if (isNaN(num)) return val
    
    // Format with appropriate decimals
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(maxDecimals, 6), // Show up to 6 decimals in display
    })
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
      
      <div className="relative">
        <Input
          type="text"
          value={focused ? value : formatDisplayValue(value)}
          onChange={handleInputChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-16 ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
        />
        
        {tokenSymbol && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-sm text-gray-500 font-medium">
              {tokenSymbol}
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  )
} 
 
 
 
 