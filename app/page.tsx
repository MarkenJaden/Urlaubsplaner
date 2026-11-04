import type { Metadata } from 'next'
import { auth } from '@/auth'
import { getUserFromSession } from '@/lib/user'
import { isCountryCode, isRegionCode } from '@/lib/holiday-regions'
import { CalendarClient } from '@/components/calendar/calendar-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
}

const homeFaqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Wie hole ich mit Brückentagen das Maximum aus meinem Jahresurlaub heraus?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Klicke im Urlaubsplaner auf „Planen“. Der Algorithmus kombiniert gesetzliche Feiertage, Wochenenden, Teilzeit-/4-Tage-Wochen und auf Wunsch Schulferien deines Bundeslandes so, dass du mit möglichst wenigen Urlaubstagen maximale zusammenhängende Freizeit erhältst.',
      },
    },
    {
      '@type': 'Question',
      name: 'Kann ich meinen Urlaubsplan mit Partnern oder Kollegen teilen?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ja! Über den Button „Teilen“ kannst du deinen Plan entweder zum Einblenden und Vergleichen freigeben oder einen Link erstellen, mit dem andere gemeinsam mit dir denselben Plan in Echtzeit bearbeiten können.',
      },
    },
    {
      '@type': 'Question',
      name: 'Wie abonniere ich mehrere Kalender-Feeds im Google Kalender oder Apple Kalender?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Klicke auf „Kalender-Abo“ oder öffne die Einstellungen, um beliebig viele getrennte Kalender-Feeds mit individuellen Filtern (Urlaub, Gleittage, Notizen, Feiertage, Schulferien, Brückentage) zu erstellen und per Direkt-Link in Google Kalender, Apple Kalender oder Outlook zu abonnieren.',
      },
    },
  ],
}

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [session, resolvedSearch] = await Promise.all([
    auth(),
    searchParams ? searchParams : Promise.resolve({} as Record<string, string | string[] | undefined>),
  ])

  // Wenn eingeloggt: Nutzerdaten laden für gespeicherte Einstellungen
  let userId: string | undefined
  let preferences: Record<string, unknown> = {}

  if (session?.user?.id) {
    try {
      const user = await getUserFromSession(session)
      userId = user.id
      preferences = user.preferences as Record<string, unknown>
    } catch {
      // DB nicht erreichbar o.ä. — trotzdem rendern
    }
  }

  const initialTodayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const rawYear = typeof resolvedSearch.year === 'string' ? Number(resolvedSearch.year) : undefined
  const initialYear = rawYear && Number.isInteger(rawYear) && rawYear >= 2020 && rawYear <= 2100 ? rawYear : undefined
  const rawCountry = typeof resolvedSearch.country === 'string' ? resolvedSearch.country.toUpperCase() : undefined
  const initialCountry = isCountryCode(rawCountry) ? rawCountry : undefined
  const rawSubdivision = typeof resolvedSearch.subdivision === 'string' ? resolvedSearch.subdivision.toUpperCase() : undefined
  const initialSubdivision = isRegionCode(rawSubdivision, initialCountry) ? rawSubdivision : undefined

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }}
      />
      <CalendarClient
        userId={userId}
        preferences={preferences}
        isLoggedIn={!!session?.user?.id}
        initialTodayKey={initialTodayKey}
        initialYear={initialYear}
        initialCountry={initialCountry}
        initialSubdivision={initialSubdivision}
      />
    </>
  )
}
