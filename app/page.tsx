import type { Metadata } from 'next'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { decodeSharePayload } from '@/lib/export'
import { getUserFromSession } from '@/lib/user'
import { isCountryCode, isRegionCode } from '@/lib/holiday-regions'
import { CalendarClient } from '@/components/calendar/calendar-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const resolved = searchParams ? await searchParams : {}
  const shareToken = typeof resolved.shareToken === 'string' ? resolved.shareToken.trim() : ''
  const shareSnapshot = typeof resolved.share === 'string' ? resolved.share.trim() : ''

  if (shareToken && /^[A-Za-z0-9_-]{20,64}$/.test(shareToken)) {
    let label = 'Geteilter Urlaubsplan'
    let permission: 'view' | 'edit' = 'view'
    try {
      if (shareToken.startsWith('g_')) {
        const setting = await prisma.systemSetting.findUnique({
          where: { key: `guest_share:${shareToken}` },
        })
        const rec = setting?.value as { label?: string; permission?: string } | null
        if (rec?.label) label = rec.label.slice(0, 50)
        if (rec?.permission === 'edit') permission = 'edit'
      } else {
        const share = await prisma.planShare.findUnique({
          where: { token: shareToken },
          select: { label: true, permission: true },
        })
        if (share?.label) label = share.label.slice(0, 50)
        if (share?.permission === 'edit') permission = 'edit'
      }
    } catch {
      // DB unavailable — still return a clean share preview card
    }

    const ogImage = `/api/og?mode=share&label=${encodeURIComponent(label)}&permission=${permission}`
    const title = `${label} – Gemeinsam im Urlaubsplaner ansehen`
    const description =
      permission === 'edit'
        ? `Öffne „${label}“, lege deinen eigenen Urlaubsplan daneben oder bearbeitet den Plan gemeinsam in Echtzeit.`
        : `Öffne „${label}“ im kostenlosen Urlaubsplaner und gleiche eure freien Tage live nebeneinander ab.`

    return {
      title,
      description,
      alternates: { canonical: '/' },
      robots: { index: false, follow: true },
      openGraph: {
        title,
        description,
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
    }
  }

  if (shareSnapshot) {
    const decoded = decodeSharePayload(shareSnapshot)
    const label = decoded?.label?.slice(0, 50) || 'Geteilter Urlaubsplan'
    const ogImage = `/api/og?mode=share&label=${encodeURIComponent(label)}&permission=view`
    const title = `${label} – Im Urlaubsplaner vergleichen`
    const description = `Lege deinen eigenen Urlaubsplan neben „${label}“ und finde sofort alle gemeinsamen freien Tage.`

    return {
      title,
      description,
      alternates: { canonical: '/' },
      robots: { index: false, follow: true },
      openGraph: {
        title,
        description,
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
    }
  }

  return {
    alternates: {
      canonical: '/',
    },
  }
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
