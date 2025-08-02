'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface OrderSearchProps {
  onSearchChange: (query: string) => void
  placeholder?: string
  defaultValue?: string
}

export function OrderSearch({ 
  onSearchChange, 
  placeholder = "Search orders...",
  defaultValue = ""
}: OrderSearchProps) {
  const [searchQuery, setSearchQuery] = useState(defaultValue)
  const [debouncedQuery, setDebouncedQuery] = useState(defaultValue)
  
  // Use ref to always have the latest callback
  const onSearchChangeRef = useRef(onSearchChange)
  onSearchChangeRef.current = onSearchChange

  // Debounce search input to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Call onSearchChange when debounced query changes
  useEffect(() => {
    onSearchChangeRef.current(debouncedQuery)
  }, [debouncedQuery])

  const handleClear = () => {
    setSearchQuery('')
    onSearchChangeRef.current('')
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          
          {/* Search Icon */}
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Clear Button */}
          {searchQuery && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M18 6L6 18M6 6L18 18" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Advanced Search Button (Future Enhancement) */}
        <Button 
          variant="outline" 
          size="sm"
          className="hidden md:flex"
          disabled
        >
          Advanced
        </Button>
      </div>

      {/* Search Suggestions */}
      {searchQuery.length > 0 && (
        <div className="mt-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-2">
            <span>Search by:</span>
            <span className="bg-muted px-2 py-1 rounded">Token Symbol (WETH, USDC)</span>
            <span className="bg-muted px-2 py-1 rounded">Token Address (0x...)</span>
            <span className="bg-muted px-2 py-1 rounded">Order ID</span>
          </div>
        </div>
      )}
    </div>
  )
} 