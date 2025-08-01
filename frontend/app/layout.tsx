import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DarkSwap - Privacy-Preserving DEX',
  description: 'Trade with hidden constraints using zero-knowledge proofs. The first DEX with privacy-preserving limit orders.',
  keywords: ['DeFi', 'DEX', 'Privacy', 'Zero-Knowledge', 'Limit Orders', 'Ethereum'],
  authors: [{ name: 'DarkSwap Team' }],
  creator: 'DarkSwap Team',
  publisher: 'DarkSwap',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://darkswap.io',
    title: 'DarkSwap - Privacy-Preserving DEX',
    description: 'Trade with hidden constraints using zero-knowledge proofs. The first DEX with privacy-preserving limit orders.',
    siteName: 'DarkSwap',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DarkSwap - Privacy-Preserving DEX',
    description: 'Trade with hidden constraints using zero-knowledge proofs.',
    creator: '@darkswap',
  },
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#0a0a0a', // Dark mode only
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <QueryProvider>
            <Web3Provider>
              <div className="relative flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">
                  {children}
                </main>
                <Footer />
              </div>
            </Web3Provider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 