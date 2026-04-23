'use client'

import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LogOut, Settings, CalendarDays } from 'lucide-react'
import Link from 'next/link'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <CalendarDays className="h-5 w-5 text-primary" />
          <span>Urlaubsplaner</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="ghost" size="icon" title="Einstellungen">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>

          {session?.user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block">
                {session.user.name ?? session.user.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Abmelden"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
