'use client'

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiConfig } from 'wagmi'
import { wagmiConfig, chains } from '@/lib/config/wagmi'

import '@rainbow-me/rainbowkit/styles.css'

interface Web3ProviderProps {
  children: React.ReactNode
}

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider 
        chains={chains}
        theme={darkTheme()}
        appInfo={{
          appName: 'DarkSwap',
        }}
      >
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  )
} 