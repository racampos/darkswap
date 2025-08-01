'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { COMMON_TOKENS } from '@/components/forms/CreateOrderSchema'

interface Token {
  address: string
  symbol: string
  decimals: number
}

interface TokenSelectorProps {
  label: string
  selectedToken: Token | null
  onTokenSelect: (token: Token) => void
  disabled?: boolean
  excludeTokens?: string[]
}

export function TokenSelector({ 
  label, 
  selectedToken, 
  onTokenSelect, 
  disabled = false,
  excludeTokens = []
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const availableTokens = Object.values(COMMON_TOKENS).filter(
    token => !excludeTokens.includes(token.address)
  )

  const handleTokenSelect = (token: Token) => {
    onTokenSelect(token)
    setIsOpen(false)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
      
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full justify-between"
        >
          {selectedToken ? (
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                {selectedToken.symbol.slice(0, 2)}
              </div>
              <span className="text-foreground">{selectedToken.symbol}</span>
              <span className="text-xs text-muted-foreground truncate">
                {selectedToken.address.slice(0, 6)}...{selectedToken.address.slice(-4)}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select token</span>
          )}
          <span className="ml-2 text-muted-foreground">▼</span>
        </Button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg">
            <div className="py-1">
              {availableTokens.map((token) => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => handleTokenSelect(token)}
                  className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center space-x-3"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {token.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{token.symbol}</div>
                    <div className="text-xs text-muted-foreground">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[5]" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
} 