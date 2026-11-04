import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { Providers } from './providers'
import { themeScript } from '@/lib/theme'
import { CookieBanner, CookieSettingsButton } from '@/components/legal/cookie-banner'
import { AnalyticsHeartbeat } from '@/components/analytics/analytics-heartbeat'
import { getSeoPlanningYears } from '@/lib/seo-regions'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })

const siteUrl = process.env.NEXTAUTH_URL || 'https://urlaubsplaner.me'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Urlaubsplaner – Brückentage, Schulferien & Optimale Urlaubsplanung',
    template: '%s · Urlaubsplaner',
  },
  description:
    'Kostenloser Online-Urlaubsplaner für Deutschland, Österreich & die Schweiz: Maximale freie Tage durch smarte Brückentage-Optimierung, Schulferien-Heatmap aller Bundesländer, gemeinsam planen & Google-Kalender-Abo.',
  keywords: [
    'Urlaubsplaner',
    'Brückentage',
    'Brückentage Rechner',
    'Schulferien Kalender',
    'Urlaubsplanung optimieren',
    'Feiertage Bundesländer',
    'Urlaubstage verdoppeln',
    'Urlaub teilen',
    'Google Kalender Urlaub abonnieren',
    'Gleittage planen',
    'Fenstertage Österreich',
  ],
  authors: [{ name: 'Jan Jaden Schmidt', url: siteUrl }],
  creator: 'Jan Jaden Schmidt',
  publisher: 'Jan Jaden Schmidt',
  category: 'productivity',
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: siteUrl,
    siteName: 'Urlaubsplaner',
    title: 'Urlaubsplaner – Maximale freie Tage mit Brückentagen & Schulferien',
    description:
      'Plane deinen Jahresurlaub smart: Automatischer Brückentage-Optimierer, Schulferien-Heatmap, Urlaub teilen und direkt in Google Kalender oder Outlook abonnieren.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Urlaubsplaner – Brückentage, Schulferien & Optimale Urlaubsplanung',
    description:
      'Kostenloser Urlaubsplaner mit Brückentage-Algorithmus, Schulferien-Vergleich und Kalender-Abo.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'Urlaubsplaner',
      url: siteUrl,
      inLanguage: 'de-DE',
    },
    {
      '@type': 'WebApplication',
      name: 'Urlaubsplaner',
      url: siteUrl,
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'All',
      inLanguage: 'de-DE',
      isAccessibleForFree: true,
      description:
        'Smarter Online-Urlaubsplaner mit automatischer Brückentage-Optimierung, Schulferien-Heatmap für alle Bundesländer, Teilen-Funktion und Google-Kalender-Abonnement.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
      },
      author: {
        '@type': 'Person',
        name: 'Jan Jaden Schmidt',
      },
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const years = getSeoPlanningYears()
  const copyrightYear = String(years[0])

  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <AnalyticsHeartbeat />
          {children}
          <footer className="border-t bg-muted/20 mt-8">
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
                </nav>
                <nav aria-label="Rechtliches und Kontakt" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
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
        </Providers>
      </body>
    </html>
  )
}
