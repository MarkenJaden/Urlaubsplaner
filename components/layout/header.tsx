'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Settings, LogOut, LogIn, BarChart3 } from 'lucide-react'
import { useProfile } from '@/hooks/use-profile'
import { ThemeToggle } from './theme-toggle'

interface HeaderProps {
  isLoggedIn?: boolean
  isAdmin?: boolean
}

export function Header({ isLoggedIn, isAdmin }: HeaderProps) {
  const profile = useProfile(Boolean(isLoggedIn))
  const showAdmin = Boolean(isAdmin ?? profile.data?.isAdmin)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-[env(safe-area-inset-top,0px)] print:hidden">
      <div className="container flex min-h-14 items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold whitespace-nowrap sm:gap-2 sm:text-lg">
            <img src="/icon.svg" alt="" width={28} height={28} className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
            <span>Urlaubsplaner</span>
          </Link>
          <Link
            href="/brueckentage"
            className="hidden md:inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Brückentage &amp; Bundesländer
          </Link>
        </div>

        <nav className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <Link
            href="/brueckentage"
            className="hidden min-[420px]:inline-flex min-h-9 items-center rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors md:hidden"
            aria-label="Brückentage & Bundesländer"
          >
            Brückentage
          </Link>
          {isLoggedIn ? (
            <>
              {showAdmin && (
                <Button variant="ghost" size="icon" asChild aria-label="Admin-Dashboard">
                  <Link href="/admin">
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="icon" asChild aria-label="Einstellungen">
                <Link href="/settings">
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: '/' })}
                aria-label="Abmelden"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Button variant="ghost" size="sm" className="h-9 px-2 text-xs sm:px-3 sm:text-sm" asChild>
                <Link href="/login">
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>Anmelden</span>
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
