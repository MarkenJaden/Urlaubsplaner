'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CookieBanner, CookieSettingsButton } from '@/components/legal/cookie-banner'
import { AnalyticsHeartbeat } from '@/components/analytics/analytics-heartbeat'

interface SiteChromeProps {
  children: React.ReactNode
  copyrightYear: string | number
  years: number[]
}

/**
 * Wraps application pages with analytics heartbeat, global footer, and cookie banner.
 * External `/embed/*` routes stay completely cookieless and chrome-free for GDPR compliance.
 */
export function SiteChrome({ children, copyrightYear, years }: SiteChromeProps) {
  const pathname = usePathname()
  const isEmbed = pathname?.startsWith('/embed/') ?? false

  if (isEmbed) {
    return <>{children}</>
  }

  return (
    <>
      <AnalyticsHeartbeat />
      {children}
      <footer className="border-t bg-muted/20 mt-8 print:hidden">
        <div className="container flex flex-col gap-4 py-6 text-xs text-muted-foreground">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src="/icon.svg" alt="" width={16} height={16} className="h-4 w-4" />
              <span>© {copyrightYear} Urlaubsplaner · Jan Jaden Schmidt</span>
            </div>
            <nav aria-label="Ratgeber und Brückentage" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              <Link href="/brueckentage" className="hover:text-foreground underline transition-colors">
                Brückentage-Ratgeber
              </Link>
              {years.slice(0, 2).map(y => (
                <Link
                  key={y}
                  href={`/brueckentage/${y}`}
                  className="hover:text-foreground underline transition-colors"
                >
                  Brückentage {y}
                </Link>
              ))}
              <Link href="/schulferien" className="hover:text-foreground underline transition-colors">
                Schulferien-Kalender
              </Link>
              <Link href="/widget" className="hover:text-foreground underline transition-colors">
                Widget einbetten
              </Link>
            </nav>
            <nav aria-label="Rechtliches und Kontakt" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <a
                href="https://github.com/MarkenJaden/Urlaubsplaner"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Urlaubsplaner auf GitHub (Open Source)"
                title="Open Source auf GitHub – Mitwirken & Quellcode ansehen"
                className="inline-flex items-center gap-1.5 underline hover:text-foreground transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 fill-current"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
                </svg>
                <span>GitHub (Open Source)</span>
              </a>
              <Link href="/impressum" className="underline hover:text-foreground transition-colors">
                Impressum
              </Link>
              <Link href="/datenschutz" className="underline hover:text-foreground transition-colors">
                Datenschutzerklärung
              </Link>
              <Link href="/kontakt" className="underline hover:text-foreground transition-colors">
                Kontakt
              </Link>
              <CookieSettingsButton />
            </nav>
          </div>
        </div>
      </footer>
      <CookieBanner />
    </>
  )
}
