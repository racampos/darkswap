'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { type PublishedOrder } from '@/lib/api/types'
import { validateFillAmount, calculateOutputAmount } from '@/lib/utils/orderExecution'

interface FillAmountInputProps {
  order: PublishedOrder
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function FillAmountInput({
  order,
  value,
  onChange,
  disabled = false,
  className = ''
}: FillAmountInputProps) {
  const [inputValue, setInputValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const validation = validateFillAmount(order, inputValue)
  const output = calculateOutputAmount(order, inputValue)
  const maxAmount = BigInt(order.order.takingAmount)
  const maxAmountFormatted = (Number(maxAmount) / Math.pow(10, order.metadata.takerToken.decimals)).toFixed(4)

  const handleInputChange = (newValue: string) => {
    // Remove any non-numeric characters except decimal point
    const cleanValue = newValue.replace(/[^0-9.]/g, '')
    
    // Prevent multiple decimal points
    const parts = cleanValue.split('.')
    const finalValue = parts.length > 2 
      ? `${parts[0]}.${parts.slice(1).join('')}`
      : cleanValue

    setInputValue(finalValue)
    
    // Convert to wei for validation and storage
    if (finalValue) {
      try {
        const weiValue = BigInt(Math.floor(Number(finalValue) * Math.pow(10, order.metadata.takerToken.decimals)))
        onChange(weiValue.toString())
      } catch {
        onChange('0')
      }
    } else {
      onChange('0')
    }
  }

  const handleMaxClick = () => {
    setInputValue(maxAmountFormatted)
    onChange(maxAmount.toString())
  }

  const handleQuickAmount = (percentage: number) => {
    const amount = (Number(maxAmount) * percentage / 100)
    const formatted = (amount / Math.pow(10, order.metadata.takerToken.decimals)).toFixed(4)
    setInputValue(formatted)
    onChange(Math.floor(amount).toString())
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Token Info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground">Fill Amount</h3>
          <p className="text-sm text-muted-foreground">
            Specify how much {order.metadata.takerToken.symbol} to trade
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Max: {maxAmountFormatted} {order.metadata.takerToken.symbol}
        </Badge>
      </div>

      {/* Input Field */}
      <div className="relative">
        <Input
          type="text"
          placeholder="0.0"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          className={`pr-20 text-lg ${
            validation.isValid 
              ? 'border-green-500/50 focus:border-green-500' 
              : validation.error && inputValue 
                ? 'border-red-500/50 focus:border-red-500'
                : ''
          }`}
        />
        
        {/* Token Symbol */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <span className="text-sm font-medium text-muted-foreground">
            {order.metadata.takerToken.symbol}
          </span>
        </div>
      </div>

      {/* Quick Amount Buttons */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground">Quick:</span>
        {[25, 50, 75, 100].map((percentage) => (
          <Button
            key={percentage}
            variant="ghost"
            size="sm"
            onClick={() => handleQuickAmount(percentage)}
            disabled={disabled}
            className="text-xs px-2 py-1 h-auto"
          >
            {percentage}%
          </Button>
        ))}
      </div>

      {/* Validation & Output */}
      {inputValue && (
        <div className="space-y-2">
          {/* Validation Error */}
          {validation.error && (
            <p className="text-sm text-red-400 flex items-center space-x-1">
              <span>⚠️</span>
              <span>{validation.error}</span>
            </p>
          )}

          {/* Output Estimate */}
          {validation.isValid && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">You will receive:</span>
                <div className="text-right">
                  <p className="font-medium text-green-400">
                    {(Number(output.outputAmount) / Math.pow(10, order.metadata.makerToken.decimals)).toFixed(6)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.metadata.makerToken.symbol}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-green-500/20">
                <span className="text-xs text-muted-foreground">Exchange Rate:</span>
                <span className="text-xs text-green-400">
                  1 {order.metadata.takerToken.symbol} = {(output.rate || 0).toFixed(6)} {order.metadata.makerToken.symbol}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Balance Check (placeholder) */}
      <div className="text-xs text-muted-foreground">
        💡 Tip: Make sure you have sufficient {order.metadata.takerToken.symbol} balance and token allowance
      </div>
    </div>
  )
} 