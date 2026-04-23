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
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <span className="text-2xl">🏖️</span>
          <span>Urlaubsplaner</span>
        </Link>

        <nav className="flex items-center gap-2">
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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">
                <LogIn className="h-4 w-4 mr-1" />
                Anmelden
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
