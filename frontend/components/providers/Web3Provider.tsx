'use client'

import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { WagmiConfig } from 'wagmi'
import { useTheme } from 'next-themes'
import { wagmiConfig, chains } from '@/lib/config/wagmi'

import '@rainbow-me/rainbowkit/styles.css'

interface Web3ProviderProps {
  children: React.ReactNode
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const { theme } = useTheme()

  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider 
        chains={chains}
        theme={theme === 'dark' ? darkTheme() : lightTheme()}
        appInfo={{
          appName: 'DarkSwap',
          learnMoreUrl: 'https://github.com/your-username/darkswap',
        }}
      >
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  )
} 