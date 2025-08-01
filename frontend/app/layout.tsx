import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DarkSwap - Privacy-Preserving DEX',
  description: 'Trade with zero-knowledge privacy protection against MEV and frontrunning',
  metadataBase: new URL('http://localhost:3000'),
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ThemeProvider>
          <QueryProvider>
            <Web3Provider>
              <div className="min-h-screen bg-background text-foreground">
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