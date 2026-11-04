import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { Providers } from './providers'
import { themeScript } from '@/lib/theme'
import { CookieBanner, CookieSettingsButton } from '@/components/legal/cookie-banner'

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
    'Brückentage Rechner',
    'Schulferien Kalender',
    'Urlaubsplanung optimieren',
    'Feiertage Bundesländer',
    'Urlaub teilen',
    'Google Kalender Urlaub abonnieren',
    'Gleittage planen',
  ],
  authors: [{ name: 'Jan Jaden Schmidt', url: siteUrl }],
  creator: 'Jan Jaden Schmidt',
  alternates: {
    canonical: '/',
  },
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
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Urlaubsplaner',
      url: siteUrl,
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'All',
      inLanguage: 'de-DE',
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
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Wie hole ich mit Brückentagen das Maximum aus meinem Jahresurlaub heraus?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Klicke im Urlaubsplaner auf „Optimaler Plan“. Der Algorithmus kombiniert gesetzliche Feiertage, Wochenenden und auf Wunsch Schulferien deines Bundeslandes so, dass du mit möglichst wenigen Urlaubstagen maximale zusammenhängende Freizeit erhältst.',
          },
        },
        {
          '@type': 'Question',
          name: 'Kann ich meinen Urlaubsplan mit Partnern oder Kollegen teilen?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Ja! Über den Button „Teilen“ kannst du deinen Plan entweder zum Einblenden und Vergleichen freigeben oder einen Link erstellen, mit dem andere gemeinsam mit dir denselben Plan bearbeiten können.',
          },
        },
        {
          '@type': 'Question',
          name: 'Wie abonniere ich meinen Urlaubsplan im Google Kalender oder Apple Kalender?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Klicke auf „Kalender-Abo“, wähle aus, welche Einträge (Urlaub, Gleittage, Notizen, Feiertage, Schulferien) enthalten sein sollen, und nutze den direkten Button „In Google Kalender abonnieren“ oder „In Apple Kalender / Outlook öffnen“.',
          },
        },
      ],
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const copyrightYear = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
  }).format(new Date())

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
          {children}
          <footer className="border-t bg-muted/20 mt-8">
            <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 py-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <img src="/icon.svg" alt="" className="h-4 w-4" />
                <span>© {copyrightYear} Urlaubsplaner · Jan Jaden Schmidt</span>
              </div>
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
          </footer>
          <CookieBanner />
        </Providers>
      </body>
    </html>
  )
}
