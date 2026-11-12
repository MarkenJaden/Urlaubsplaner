import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { PublicYearCalendar } from '@/components/calendar/public-year-calendar'
import { fetchHolidays, resolveSchoolGroup } from '@/lib/holiday-api'
import { detectBridgeDays } from '@/lib/bridge-days'
import { suggestVacation, DEFAULT_PREFERENCES } from '@/lib/vacation-suggester'
import { localizedName } from '@/lib/holiday-regions'
import { formatDays } from '@/lib/vacation-accounting'
import {
  SEO_REGIONS,
  buildPlannerHref,
  getSeoPlanningYears,
  getSeoRegionBySlug,
  isValidSeoYear,
} from '@/lib/seo-regions'
import type { Holiday } from '@/types'
import { GraduationCap, Calendar, Sparkles, ArrowRight } from 'lucide-react'

export const revalidate = 86400

const siteUrl = process.env.NEXTAUTH_URL || 'https://urlaubsplaner.me'

interface PageProps {
  params: Promise<{ year: string; region: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year: yearStr, region: regionSlug } = await params
  const year = Number(yearStr)
  const region = getSeoRegionBySlug(regionSlug)
  if (!isValidSeoYear(year) || !region) return { title: 'Nicht gefunden' }

  const shortTag = region.shortName && region.country === 'DE' ? ` (${region.shortName})` : ''
  const title = `Schulferien ${year} ${region.name}${shortTag} – Alle Ferientermine & Familien-Urlaubsplaner`
  const description = `Alle Schulferien ${year} ${region.preposition} (Osterferien, Sommerferien, Herbstferien, Weihnachtsferien) inklusive Feiertags-Kombinationen für Familien.`

  return {
    title,
    description,
    alternates: {
      canonical: `/schulferien/${year}/${region.slug}`,
    },
    openGraph: {
      title: `${title} · Urlaubsplaner`,
      description,
      url: `${siteUrl}/schulferien/${year}/${region.slug}`,
      type: 'article',
    },
  }
}

export default async function SchulferienRegionPage({ params }: PageProps) {
  const { year: yearStr, region: regionSlug } = await params
  const year = Number(yearStr)
  const region = getSeoRegionBySlug(regionSlug)
  if (!isValidSeoYear(year) || !region) notFound()

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
  const familyBlocks =
    publicHolidays.length > 0
      ? suggestVacation(
          year,
          publicHolidays,
          schoolHolidays,
          new Set(),
          30,
          new Set(),
          {
            ...DEFAULT_PREFERENCES,
            schoolStrategy: 'prefer',
            preferSchoolHolidays: true,
            planFromToday: false,
            planStartMode: 'year_start',
          },
          false,
        )
      : []

  const totalSchoolDays = schoolHolidays.reduce(
    (sum, h) => sum + Math.max(1, differenceInCalendarDays(parseISO(h.endDate), parseISO(h.startDate)) + 1),
    0,
  )
  const plannerHref = buildPlannerHref({
    year,
    country: region.country,
    subdivision: region.subdivision,
  })
  const years = getSeoPlanningYears()
  const otherRegions = SEO_REGIONS.filter(r => r.slug !== region.slug && r.country === 'DE')

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-5xl space-y-8 py-8 text-sm">
        <nav aria-label="Brotkrumennavigation" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground underline">Urlaubsplaner</Link>
          <span>/</span>
          <Link href="/schulferien" className="hover:text-foreground underline">Schulferien</Link>
          <span>/</span>
          <Link href={`/schulferien/${year}`} className="hover:text-foreground underline">{year}</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{region.name}</span>
        </nav>

        <section className="rounded-2xl border bg-gradient-to-br from-sky-500/10 via-card to-card p-6 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              Schulferien &amp; Familien-Urlaubsplanung {year}
            </span>
            <div className="flex items-center gap-1.5">
              {years.map(y => (
                <Link
                  key={y}
                  href={`/schulferien/${y}/${region.slug}`}
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
            Schulferien {year} {region.preposition}: Alle Termine &amp; optimale Urlaubstage
          </h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            Übersicht aller Schulferien {year} {region.preposition} ({totalSchoolDays} Kalendertage in {schoolHolidays.length} Ferienabschnitten) – kombiniert mit den gesetzlichen Feiertagen für maximale gemeinsame Familienzeit.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild>
              <Link href={plannerHref}>
                <Calendar className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {region.name} {year} im interaktiven Kalender öffnen
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/brueckentage/${year}/${region.slug}`}>
                Brückentage {year} {region.name}
              </Link>
            </Button>
          </div>
        </section>

        {/* Graphical 12-Month Calendar (Printable & Embeddable) */}
        <PublicYearCalendar
          year={year}
          regionName={region.name}
          regionSlug={region.slug}
          mode="schulferien"
          publicHolidays={publicHolidays}
          schoolHolidays={schoolHolidays}
          bridgeDays={bridgeDays}
          optimalBlocks={familyBlocks.slice(0, 6)}
          plannerHref={plannerHref}
        />

        {/* School Holiday Table */}
        <section aria-labelledby="ferien-table-heading" className="space-y-3 print:hidden">
          <h2 id="ferien-table-heading" className="text-lg font-bold">
            Alle Schulferien-Zeiträume {year} {region.preposition}
          </h2>
          {schoolHolidays.length === 0 ? (
            <p className="rounded-xl border bg-card p-4 text-muted-foreground">
              Für {region.name} ({year}) liegen aktuell noch keine offiziellen Schulferien-Daten vor.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                    <th className="py-3 px-4">Ferien</th>
                    <th className="py-3 px-4">Erster Ferientag</th>
                    <th className="py-3 px-4">Letzter Ferientag</th>
                    <th className="py-3 px-4 text-right">Dauer (Kalendertage)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {schoolHolidays.map(h => {
                    const days = Math.max(1, differenceInCalendarDays(parseISO(h.endDate), parseISO(h.startDate)) + 1)
                    return (
                      <tr key={h.id} className="hover:bg-muted/20">
                        <td className="py-3 px-4 font-semibold">{localizedName(h.name)}</td>
                        <td className="py-3 px-4">{format(parseISO(h.startDate), 'dd.MM.yyyy (EEEE)', { locale: de })}</td>
                        <td className="py-3 px-4">{format(parseISO(h.endDate), 'dd.MM.yyyy (EEEE)', { locale: de })}</td>
                        <td className="py-3 px-4 text-right font-semibold">{days} Tage</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Family Optimizer Suggestions */}
        {familyBlocks.length > 0 && (
          <section aria-labelledby="family-blocks-heading" className="space-y-3">
            <h2 id="family-blocks-heading" className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
              Optimale Urlaubsblöcke {year} in den Schulferien ({region.name})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {familyBlocks.slice(0, 6).map((block, i) => (
                <div key={i} className="rounded-xl border bg-card p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{block.label}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {formatDays(block.cost)} UT → {block.freeDaysGained} Tage frei
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Zeitraum: {format(parseISO(block.startDate), 'dd.MM.yyyy')} – {format(parseISO(block.endDate), 'dd.MM.yyyy')} ({block.efficiency.toFixed(1)}× Effizienz)
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cross-Links to other states */}
        <section aria-labelledby="other-states-heading" className="space-y-3 border-t pt-6">
          <h2 id="other-states-heading" className="text-base font-bold">
            Schulferien {year} in weiteren Bundesländern vergleichen
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherRegions.map(r => (
              <Link
                key={r.slug}
                href={`/schulferien/${year}/${r.slug}`}
                className="inline-flex items-center gap-1 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
              >
                <span>{r.name}</span>
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
