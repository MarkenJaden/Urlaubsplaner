'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Settings, LogOut, LogIn } from 'lucide-react'

interface HeaderProps {
  isLoggedIn?: boolean
}

export function Header({ isLoggedIn }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2 text-base font-semibold sm:text-lg">
          <span className="text-2xl">🏖️</span>
          <span className="truncate">Urlaubsplaner</span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isLoggedIn ? (
            <>
              <Button variant="ghost" size="icon" asChild title="Einstellungen">
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: '/' })}
                title="Abmelden"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" className="px-2 sm:px-3" asChild>
              <Link href="/login">
                <LogIn className="h-4 w-4" />
                Anmelden
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
