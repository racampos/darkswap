import { getDefaultWallets } from '@rainbow-me/rainbowkit'
import { configureChains, createConfig } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'
import { localhost } from './chains'

// Configure the chains we want to support
const { chains, publicClient } = configureChains(
  [localhost], // Use our custom localhost chain configuration
  [publicProvider()]
)

// Get default wallets for RainbowKit
const { connectors } = getDefaultWallets({
  appName: 'DarkSwap',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'demo-project-id',
  chains,
})

// Create wagmi config
export const wagmiConfig = createConfig({
  autoConnect: false, // Disable autoConnect to prevent hydration issues
  connectors,
  publicClient,
})

export { chains } 