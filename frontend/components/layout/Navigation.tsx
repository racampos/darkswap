'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  {
    title: 'Maker',
    href: '/maker',
    description: 'Create orders'
  },
  {
    title: 'Taker',
    href: '/taker',
    description: 'Fill orders'
  }
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex items-center space-x-6">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'text-sm font-medium transition-colors hover:text-primary',
            pathname?.startsWith(item.href)
              ? 'text-foreground'
              : 'text-muted-foreground'
          )}
        >
          {item.title}
        </Link>
      ))}
    </nav>
  )
} 