import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { fetchHolidays, resolveSchoolGroup } from '@/lib/holiday-api'
import { localizedName } from '@/lib/holiday-regions'
import { countUniqueHolidayDays, isSpecialLocalHoliday } from '@/lib/holidays'
import {
  SEO_REGIONS,
  buildPlannerHref,
  getSeoPlanningYears,
  isValidSeoYear,
} from '@/lib/seo-regions'
import { SchulferienYearCalendar } from '@/components/calendar/schulferien-year-calendar'
import type { Holiday } from '@/types'
import { GraduationCap, Calendar, MapPin, ArrowRight } from 'lucide-react'

export const revalidate = 86400

const siteUrl = process.env.NEXTAUTH_URL || 'https://urlaubsplaner.me'

interface PageProps {
  params: Promise<{ year: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year: yearStr } = await params
  const year = Number(yearStr)
  if (!isValidSeoYear(year)) return { title: 'Nicht gefunden' }

  const title = `Schulferien ${year} Deutschland – Alle Bundesländer im Vergleich`
  const description = `Schulferien ${year} für alle 16 Bundesländer im direkten Vergleich: Sommerferien, Osterferien, Herbstferien & Weihnachtsferien ${year} plus Ferien-Heatmap.`

  return {
    title,
    description,
    alternates: {
      canonical: `/schulferien/${year}`,
    },
    openGraph: {
      title: `${title} · Urlaubsplaner`,
      description,
      url: `${siteUrl}/schulferien/${year}`,
      type: 'article',
    },
  }
}

function fmtRange(start: string, end: string): string {
  const s = parseISO(start)
  const e = parseISO(end)
  if (start === end) return format(s, 'dd.MM.yyyy', { locale: de })
  return `${format(s, 'dd.MM.', { locale: de })} – ${format(e, 'dd.MM.yyyy', { locale: de })}`
}

export default async function SchulferienYearPage({ params }: PageProps) {
  const { year: yearStr } = await params
  const year = Number(yearStr)
  if (!isValidSeoYear(year)) notFound()

  const germanRegions = SEO_REGIONS.filter(r => r.country === 'DE')
  const years = getSeoPlanningYears()

  let nationwidePublicHolidays: Holiday[] = []
  try {
    nationwidePublicHolidays = await fetchHolidays('DE', undefined, year, 'public')
  } catch {
    nationwidePublicHolidays = []
  }

  // Fetch school holidays for German states in parallel (cached by Next.js fetch cache)
  const stateSummaries = await Promise.all(
    germanRegions.map(async region => {
      try {
        const group = await resolveSchoolGroup(region.country, region.subdivision).catch(() => undefined)
        const list = region.subdivision
          ? await fetchHolidays(region.country, region.subdivision, year, 'school', group).catch(() => [] as Holiday[])
          : []
        // State-wide regular school schedule: filter island/local special exceptions
        const mainlandList = list.filter(h => !isSpecialLocalHoliday(h))
        const effectiveList = mainlandList.length ? mainlandList : list
        const totalCalendarDays = countUniqueHolidayDays(effectiveList, year)
        const summer = effectiveList.find(h => localizedName(h.name).toLowerCase().includes('sommer'))
        const easter = effectiveList.find(h => localizedName(h.name).toLowerCase().includes('oster') || localizedName(h.name).toLowerCase().includes('frühjahrs'))
        const autumn = effectiveList.find(h => localizedName(h.name).toLowerCase().includes('herbst'))
        return {
          region,
          periodsCount: effectiveList.length,
          totalCalendarDays,
          summer,
          easter,
          autumn,
          holidays: effectiveList,
        }
      } catch {
        return {
          region,
          periodsCount: 0,
          totalCalendarDays: 0,
          summer: undefined,
          easter: undefined,
          autumn: undefined,
          holidays: [],
        }
      }
    }),
  )

  const statesCalendarData = stateSummaries.map(s => ({
    slug: s.region.slug,
    name: s.region.name,
    subdivision: s.region.subdivision,
    schoolHolidays: s.holidays,
  }))

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-5xl space-y-8 py-8 text-sm">
        <nav aria-label="Brotkrumennavigation" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground print:hidden">
          <Link href="/" className="hover:text-foreground underline">Urlaubsplaner</Link>
          <span>/</span>
          <Link href="/schulferien" className="hover:text-foreground underline">Schulferien</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{year}</span>
        </nav>

        <section className="rounded-2xl border bg-gradient-to-br from-sky-500/10 via-card to-card p-6 sm:p-8 space-y-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              Alle 16 Bundesländer im Überblick
            </span>
            <div className="flex items-center gap-1.5">
              {years.map(y => (
                <Link
                  key={y}
                  href={`/schulferien/${y}`}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    y === year ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:border-primary'
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Schulferien {year} in Deutschland – Alle Termine &amp; Vergleich
          </h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            Wann hat welches Bundesland {year} Sommerferien, Osterferien oder Herbstferien? Vergleiche alle 16 Bundesländer auf einen Blick oder öffne die interaktive Ferien-Heatmap im Urlaubsplaner.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild>
              <Link href={buildPlannerHref({ year })}>
                <Calendar className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Schulferien {year} interaktiv im Kalender vergleichen
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/brueckentage/${year}`}>
                Zu den Brückentagen {year}
              </Link>
            </Button>
          </div>
        </section>

        {/* Graphical 12-Month Calendar (Printable & Embeddable) */}
        <SchulferienYearCalendar
          year={year}
          states={statesCalendarData}
          nationwidePublicHolidays={nationwidePublicHolidays}
        />

        {/* Overview Table of all 16 Bundesländer */}
        <section aria-labelledby="table-heading" className="space-y-3 print:hidden">
          <h2 id="table-heading" className="text-lg font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            Ferientermine {year} nach Bundesland
          </h2>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <th className="py-3 px-4">Bundesland</th>
                  <th className="py-3 px-4">Osterferien {year}</th>
                  <th className="py-3 px-4">Sommerferien {year}</th>
                  <th className="py-3 px-4">Herbstferien {year}</th>
                  <th className="py-3 px-4 text-right">Kalendertage</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stateSummaries.map(({ region, totalCalendarDays, easter, summer, autumn }) => (
                  <tr key={region.slug} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-semibold">
                      <Link href={`/schulferien/${year}/${region.slug}`} className="text-primary hover:underline flex items-center gap-1.5">
                        <span>{region.name}</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {easter ? fmtRange(easter.startDate, easter.endDate) : '—'}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {summer ? fmtRange(summer.startDate, summer.endDate) : '—'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {autumn ? fmtRange(autumn.startDate, autumn.endDate) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {totalCalendarDays > 0 ? `${totalCalendarDays} Tage` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
