'use client'

import { useState, useEffect } from 'react'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiConfig } from 'wagmi'
import { wagmiConfig, chains } from '@/lib/config/wagmi'

import '@rainbow-me/rainbowkit/styles.css'

interface Web3ProviderProps {
  children: React.ReactNode
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Always provide WagmiConfig context, but only add RainbowKit after mounting
  return (
    <WagmiConfig config={wagmiConfig}>
      {mounted ? (
        <RainbowKitProvider 
          chains={chains}
          theme={darkTheme()}
          appInfo={{
            appName: 'DarkSwap',
          }}
        >
          {children}
        </RainbowKitProvider>
      ) : (
        children
      )}
    </WagmiConfig>
  )
} 