import type { Metadata } from 'next'
import Link from 'next/link'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { fetchHolidays, resolveSchoolGroup } from '@/lib/holiday-api'
import { detectBridgeDays } from '@/lib/bridge-days'
import { localizedName } from '@/lib/holiday-regions'
import { PublicYearCalendar } from '@/components/calendar/public-year-calendar'
import {
  SEO_REGIONS,
  buildPlannerHref,
  getSeoPlanningYears,
  getSeoRegionBySlug,
  isValidSeoYear,
} from '@/lib/seo-regions'
import type { Holiday } from '@/types'
import { GraduationCap, ExternalLink } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Schulferien-Kalender Widget · Urlaubsplaner',
  robots: { index: false, follow: true },
}

interface EmbedPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val
}

export default async function EmbedSchulferienPage({ searchParams }: EmbedPageProps) {
  const params = searchParams ? await searchParams : {}
  const years = getSeoPlanningYears()
  const rawYear = Number(firstParam(params.year))
  const year = isValidSeoYear(rawYear) ? rawYear : (years[1] ?? years[0])
  const regionSlug = firstParam(params.region) ?? 'nordrhein-westfalen'
  const view = firstParam(params.view) === 'list' ? 'list' : 'calendar'
  const region = getSeoRegionBySlug(regionSlug) ?? SEO_REGIONS[0]

  let publicHolidays: Holiday[] = []
  let schoolHolidays: Holiday[] = []
  try {
    const schoolGroup = await resolveSchoolGroup(region.country, region.subdivision).catch(() => undefined)
    ;[publicHolidays, schoolHolidays] = await Promise.all([
      fetchHolidays(region.country, region.subdivision, year, 'public'),
      region.subdivision
        ? fetchHolidays(region.country, region.subdivision, year, 'school', schoolGroup).catch(() => [] as Holiday[])
        : Promise.resolve([] as Holiday[]),
    ])
  } catch {
    publicHolidays = []
    schoolHolidays = []
  }

  const bridgeDays = detectBridgeDays(year, publicHolidays)
  const plannerHref = buildPlannerHref({
    year,
    country: region.country,
    subdivision: region.subdivision,
  })

  if (view === 'calendar') {
    return (
      <div className="min-h-screen bg-card p-3 text-card-foreground text-xs">
        <PublicYearCalendar
          year={year}
          regionName={region.name}
          regionSlug={region.slug}
          mode="schulferien"
          publicHolidays={publicHolidays}
          schoolHolidays={schoolHolidays}
          bridgeDays={bridgeDays}
          plannerHref={plannerHref}
          isEmbed
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-card p-4 text-card-foreground flex flex-col justify-between gap-3 text-xs">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
          <div>
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              Schulferien &amp; Feiertage {year} · {region.name}
            </div>
            <h1 className="text-base font-bold text-foreground">
              Alle Ferientermine {year} {region.preposition}
            </h1>
          </div>
          <Link
            href={plannerHref}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <span>Im Jahreskalender planen</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="space-y-1.5">
          {schoolHolidays.map((h, i) => {
            const days = Math.max(1, differenceInCalendarDays(parseISO(h.endDate), parseISO(h.startDate)) + 1)
            return (
              <div
                key={h.id ?? i}
                className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
              >
                <div>
                  <p className="font-semibold text-foreground">{localizedName(h.name)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(parseISO(h.startDate), 'dd.MM.yyyy', { locale: de })} –{' '}
                    {format(parseISO(h.endDate), 'dd.MM.yyyy', { locale: de })}
                  </p>
                </div>
                <span className="inline-block rounded-full bg-sky-500/15 px-2.5 py-0.5 font-bold text-sky-700 dark:text-sky-300">
                  {days} Tage
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
        <span>Kostenlos &amp; werbefrei bereitgestellt von urlaubsplaner.me</span>
        <Link href="/widget" target="_blank" rel="noopener" className="underline hover:text-foreground">
          Widget einbetten
        </Link>
      </div>
    </div>
  )
}
