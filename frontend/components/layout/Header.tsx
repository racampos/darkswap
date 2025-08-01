'use client'

// import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { Navigation } from './Navigation'
// import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">DS</span>
            </div>
            <span className="font-bold text-xl">DarkSwap</span>
          </Link>
          <Navigation />
        </div>
        
        <div className="flex items-center space-x-4">
          {/* <ThemeToggle /> */}
          <div className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">
            Connect Wallet (Coming Soon)
          </div>
          {/* <ConnectButton /> */}
        </div>
      </div>
    </header>
  )
} 