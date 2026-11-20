import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { themeScript } from '@/lib/theme'
import { SiteChrome } from '@/components/layout/site-chrome'
import { getSeoPlanningYears } from '@/lib/seo-regions'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })

const siteUrl = process.env.NEXTAUTH_URL || 'https://urlaubsplaner.me'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

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
          <SiteChrome copyrightYear={copyrightYear} years={years}>
            {children}
          </SiteChrome>
        </Providers>
      </body>
    </html>
  )
}
