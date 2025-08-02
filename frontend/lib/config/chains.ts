import { Chain } from 'viem'

export const localhost = {
  id: 1, // Match mainnet chainId for 1inch contract compatibility
  name: 'DarkSwap Local (Forked Mainnet)',
  network: 'localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['http://127.0.0.1:8545'] },
    default: { http: ['http://127.0.0.1:8545'] },
  },
  blockExplorers: {
    etherscan: { name: 'Etherscan', url: 'https://etherscan.io' },
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
  testnet: true,
} as const satisfies Chain

export const supportedChains = [localhost] as const

export const defaultChain = localhost 