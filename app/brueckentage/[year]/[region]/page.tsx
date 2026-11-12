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
import { Calendar, Sparkles, MapPin, ArrowRight, GraduationCap, HelpCircle } from 'lucide-react'

export const revalidate = 86400

const siteUrl = process.env.NEXTAUTH_URL || 'https://urlaubsplaner.me'

interface PageProps {
  params: Promise<{ year: string; region: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year: yearStr, region: regionSlug } = await params
  const year = Number(yearStr)
  const region = getSeoRegionBySlug(regionSlug)
  if (!isValidSeoYear(year) || !region) {
    return { title: 'Nicht gefunden' }
  }

  const shortTag = region.shortName && region.country === 'DE' ? ` (${region.shortName})` : ''
  const title = `Brückentage ${year} ${region.name}${shortTag} – Feiertage & Schulferien`
  const description = `Alle Brückentage, gesetzlichen Feiertage und Schulferien ${year} ${region.preposition}: Mit wenigen Urlaubstagen maximale freie Tage herausholen und direkt online planen.`

  return {
    title,
    description,
    alternates: {
      canonical: `/brueckentage/${year}/${region.slug}`,
    },
    openGraph: {
      title: `${title} · Urlaubsplaner`,
      description,
      url: `${siteUrl}/brueckentage/${year}/${region.slug}`,
      type: 'article',
    },
  }
}

export default async function BrueckentageRegionPage({ params }: PageProps) {
  const { year: yearStr, region: regionSlug } = await params
  const year = Number(yearStr)
  const region = getSeoRegionBySlug(regionSlug)
  if (!isValidSeoYear(year) || !region) {
    notFound()
  }

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
  const optimalBlocks =
    publicHolidays.length > 0
      ? suggestVacation(
          year,
          publicHolidays,
          schoolHolidays,
          new Set(),
          28,
          new Set(),
          {
            ...DEFAULT_PREFERENCES,
            goal: 'max_efficiency',
            optimizeForEfficiency: true,
            planFromToday: false,
            planStartMode: 'year_start',
          },
          false
        )
      : []

  const totalCost = optimalBlocks.reduce((sum, b) => sum + b.cost, 0)
  const totalFree = optimalBlocks.reduce((sum, b) => sum + b.freeDaysGained, 0)
  const weekdayHolidaysCount = publicHolidays.filter(h => {
    const d = parseISO(h.startDate).getDay()
    return d !== 0 && d !== 6
  }).length

  const plannerHref = buildPlannerHref({
    year,
    country: region.country,
    subdivision: region.subdivision,
  })
  const years = getSeoPlanningYears()
  const otherRegions = SEO_REGIONS.filter(r => r.slug !== region.slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Urlaubsplaner', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Brückentage', item: `${siteUrl}/brueckentage` },
          { '@type': 'ListItem', position: 3, name: `${year}`, item: `${siteUrl}/brueckentage/${year}` },
          {
            '@type': 'ListItem',
            position: 4,
            name: region.name,
            item: `${siteUrl}/brueckentage/${year}/${region.slug}`,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `Wie viele gesetzliche Feiertage gibt es ${year} ${region.preposition}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                publicHolidays.length > 0
                  ? `${year} gibt es ${region.preposition} insgesamt ${publicHolidays.length} gesetzliche Feiertage, davon fallen ${weekdayHolidaysCount} auf einen Werktag (Montag bis Freitag).`
                  : `Alle aktuellen gesetzlichen Feiertage ${year} ${region.preposition} findest du direkt im interaktiven Urlaubsplaner.`,
            },
          },
          {
            '@type': 'Question',
            name: `Welche Brückentage lohnen sich ${year} ${region.preposition} besonders?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                optimalBlocks.length > 0
                  ? `Mit einem Budget von ${formatDays(totalCost)} Urlaubstagen erreichst du ${year} ${region.preposition} durch geschickte Kombination mit Wochenenden und Feiertagen bis zu ${totalFree} freie Tage.`
                  : `${region.highlight}`,
            },
          },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="container max-w-5xl space-y-8 py-8 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Brotkrumennavigation" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground underline">
              Urlaubsplaner
            </Link>
            <span>/</span>
            <Link href="/brueckentage" className="hover:text-foreground underline">
              Brückentage
            </Link>
            <span>/</span>
            <Link href={`/brueckentage/${year}`} className="hover:text-foreground underline">
              {year}
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{region.name}</span>
          </nav>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Jahr:</span>
            {years.map(y => (
              <Link
                key={y}
                href={`/brueckentage/${y}/${region.slug}`}
                className={`rounded-md border px-2.5 py-1 font-medium transition-colors ${
                  y === year
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:border-primary'
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>

        {/* Hero */}
        <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8 space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {region.name} · Urlaubsplanung {year}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Brückentage, Feiertage &amp; Schulferien {year} {region.preposition}
          </h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            {region.highlight} Öffne deinen Plan für {region.name} direkt im interaktiven Jahreskalender, vergleiche Schulferien per Heatmap oder abonniere deinen Urlaub im Google- und Apple-Kalender.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild>
              <Link href={plannerHref}>
                <Calendar className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {region.name} {year} im Kalender planen →
              </Link>
            </Button>
            {schoolHolidays.length > 0 && (
              <Button variant="outline" asChild>
                <a href="#schulferien">Zu den Schulferien {year}</a>
              </Button>
            )}
          </div>
        </section>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <span className="text-xs text-muted-foreground">Gesetzliche Feiertage</span>
            <p className="mt-1 text-2xl font-bold">{publicHolidays.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Davon {weekdayHolidaysCount} an Mo–Fr
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <span className="text-xs text-muted-foreground">1-Tages-Brückentage</span>
            <p className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">
              {bridgeDays.length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Einzelne Brückentage {year}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <span className="text-xs text-muted-foreground">Maximale Ausbeute (28 UT)</span>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalFree > 0 ? `${totalFree} Tage frei` : 'Interaktiv'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalCost > 0 ? `Aus ${formatDays(totalCost)} Urlaubstagen` : 'Im Kalender berechnen'}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <span className="text-xs text-muted-foreground">Schulferien-Zeiträume</span>
            <p className="mt-1 text-2xl font-bold text-sky-600 dark:text-sky-400">
              {schoolHolidays.length > 0 ? schoolHolidays.length : '–'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {schoolHolidays.length > 0 ? `Ferienblöcke ${year} erfasst` : 'Nach Bundesland/Kanton im Planer'}
            </p>
          </div>
        </div>

        {/* Graphical 12-Month Calendar (Printable & Embeddable) */}
        <PublicYearCalendar
          year={year}
          regionName={region.name}
          regionSlug={region.slug}
          mode="brueckentage"
          publicHolidays={publicHolidays}
          schoolHolidays={schoolHolidays}
          bridgeDays={bridgeDays}
          optimalBlocks={optimalBlocks}
          plannerHref={plannerHref}
        />

        {/* Optimal Multi-Day Vacation Blocks */}
        {optimalBlocks.length > 0 && (
          <section aria-labelledby="region-blocks-heading" className="rounded-xl border bg-card p-5 space-y-4 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="region-blocks-heading" className="text-lg font-bold">
                  Optimaler Urlaubsplan {year} {region.preposition}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Smarte Kombination aller Feiertage {region.preposition} bei einer 5-Tage-Woche (Mo–Fr):
                </p>
              </div>
              <Button size="sm" asChild>
                <Link href={plannerHref}>Im Kalender übernehmen →</Link>
              </Button>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby="region-blocks-heading"
              className="overflow-x-auto rounded-lg border"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground border-b">
                  <tr>
                    <th scope="col" className="p-3">Freier Zeitraum</th>
                    <th scope="col" className="p-3">Feiertage &amp; Anlass</th>
                    <th scope="col" className="p-3">Urlaubstage</th>
                    <th scope="col" className="p-3">Freie Tage gesamt</th>
                    <th scope="col" className="p-3">Effizienz</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {optimalBlocks.map((block, i) => (
                    <tr key={block.id ?? i} className="hover:bg-muted/20">
                      <th scope="row" className="p-3 font-semibold whitespace-nowrap text-left">
                        {format(parseISO(block.startDate), 'dd.MM.', { locale: de })} –{' '}
                        {format(parseISO(block.endDate), 'dd.MM.yyyy', { locale: de })}
                      </th>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{block.label}</div>
                        {block.holidaysIncluded.length > 0 && (
                          <div className="text-[11px] text-muted-foreground">
                            {block.holidaysIncluded.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap font-medium">
                        {formatDays(block.cost)} UT
                      </td>
                      <td className="p-3 whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                        {block.freeDaysGained} Tage frei
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {block.efficiency.toFixed(1)}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Single Day Bridges */}
        {bridgeDays.length > 0 && (
          <section aria-labelledby="region-bridges-heading" className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 id="region-bridges-heading" className="text-lg font-bold">
                Einzelne Brückentage {year} {region.preposition}
              </h2>
              <p className="text-xs text-muted-foreground">
                Perfekt für verlängerte Wochenenden mit nur 1 Tag Urlaubseinsatz:
              </p>
            </div>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="region-bridges-heading"
              className="overflow-x-auto rounded-lg border"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground border-b">
                  <tr>
                    <th scope="col" className="p-3">Datum (Brückentag)</th>
                    <th scope="col" className="p-3">Verbindet</th>
                    <th scope="col" className="p-3">Freie Tage am Stück</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bridgeDays.map(b => (
                    <tr key={b.date} className="hover:bg-muted/20">
                      <th scope="row" className="p-3 font-semibold whitespace-nowrap text-left">
                        {format(parseISO(b.date), 'EEEE, dd.MM.yyyy', { locale: de })}
                      </th>
                      <td className="p-3 text-muted-foreground">
                        {b.connectsBeforeName} ↔ {b.connectsAfterName}
                      </td>
                      <td className="p-3 whitespace-nowrap font-semibold text-orange-600 dark:text-orange-400">
                        1 Urlaubstag → {b.freeDaysGained} Tage frei
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Public Holidays Table */}
        {publicHolidays.length > 0 && (
          <section aria-labelledby="region-holidays-heading" className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 id="region-holidays-heading" className="text-lg font-bold">
                Gesetzliche Feiertage {year} {region.preposition}
              </h2>
              <p className="text-xs text-muted-foreground">
                Alle offiziellen Feiertage {year} inklusive Wochentag:
              </p>
            </div>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="region-holidays-heading"
              className="overflow-x-auto rounded-lg border"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground border-b">
                  <tr>
                    <th scope="col" className="p-3">Datum</th>
                    <th scope="col" className="p-3">Wochentag</th>
                    <th scope="col" className="p-3">Feiertag</th>
                    <th scope="col" className="p-3">Hinweis</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {publicHolidays.map((h, i) => {
                    const d = parseISO(h.startDate)
                    const dow = d.getDay()
                    const isWeekend = dow === 0 || dow === 6
                    const isThuOrTue = dow === 2 || dow === 4
                    const isMonOrFri = dow === 1 || dow === 5
                    return (
                      <tr key={`${h.startDate}-${i}`} className="hover:bg-muted/20">
                        <td className="p-3 whitespace-nowrap font-mono">
                          {format(d, 'dd.MM.yyyy')}
                        </td>
                        <td className={`p-3 whitespace-nowrap ${isWeekend ? 'text-muted-foreground' : 'font-medium text-emerald-600 dark:text-emerald-400'}`}>
                          {format(d, 'EEEE', { locale: de })}
                        </td>
                        <th scope="row" className="p-3 font-semibold text-left">
                          {localizedName(h.name)}
                        </th>
                        <td className="p-3 text-muted-foreground">
                          {isThuOrTue
                            ? 'Top-Brückentag möglich (4 Tage frei mit 1 UT)'
                            : isMonOrFri
                              ? 'Langes Wochenende (3 Tage frei ohne UT)'
                              : isWeekend
                                ? 'Fällt auf das Wochenende'
                                : 'Wochenmitte – ideal für 5-Tage-Block'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* School Holidays Table */}
        {schoolHolidays.length > 0 && (
          <section id="schulferien" aria-labelledby="region-school-heading" className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 id="region-school-heading" className="text-lg font-bold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-sky-600" aria-hidden="true" />
                Schulferien {year} {region.preposition}
              </h2>
              <p className="text-xs text-muted-foreground">
                Alle Ferientermine {year} für Familien – oder zum gezielten Vermeiden der Hauptreisezeiten per Ferien-Heatmap:
              </p>
            </div>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="region-school-heading"
              className="overflow-x-auto rounded-lg border"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground border-b">
                  <tr>
                    <th scope="col" className="p-3">Ferien</th>
                    <th scope="col" className="p-3">Zeitraum</th>
                    <th scope="col" className="p-3">Kalendertage</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {schoolHolidays.map((sh, i) => {
                    const s = parseISO(sh.startDate)
                    const e = parseISO(sh.endDate)
                    const days = differenceInCalendarDays(e, s) + 1
                    return (
                      <tr key={`${sh.startDate}-${i}`} className="hover:bg-muted/20">
                        <th scope="row" className="p-3 font-semibold text-left">
                          {localizedName(sh.name)}
                        </th>
                        <td className="p-3 whitespace-nowrap font-mono">
                          {format(s, 'dd.MM.yyyy')} – {format(e, 'dd.MM.yyyy')}
                        </td>
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {days} {days === 1 ? 'Tag' : 'Tage'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section aria-labelledby="region-faq-heading" className="space-y-3">
          <h2 id="region-faq-heading" className="text-lg font-bold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            Häufige Fragen zu Brückentagen {year} {region.preposition}
          </h2>
          <details name="region-faq" open className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer font-semibold">
              Wie kann ich meinen Urlaubsplan für {region.name} in Google Kalender oder Outlook abonnieren?
            </summary>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Öffne den <Link href={plannerHref} className="text-primary underline">Urlaubsplaner für {region.name}</Link>, trage deine gewünschten Urlaubstage ein und klicke oben auf „Kalender-Abo“. Du kannst sogar mehrere separate Kalender-Feeds mit eigenen Filtern (z. B. ein Feed für die Arbeit ohne private Notizen und ein Feed privat mit Feiertagen &amp; Schulferien) erstellen.
            </p>
          </details>
          <details name="region-faq" className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer font-semibold">
              Kann ich Schulferien anderer Bundesländer mit {region.name} vergleichen?
            </summary>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Ja! Aktiviere im Kalender den Schalter „Heatmap“, um auf einen Blick zu sehen, an welchen Tagen besonders wenige oder besonders viele Bundesländer gleichzeitig Schulferien haben.
            </p>
          </details>
        </section>

        {/* Internal Links to Other Federal States */}
        <section aria-labelledby="other-regions-heading" className="space-y-3 pt-2 border-t">
          <h2 id="other-regions-heading" className="text-base font-bold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
            Weitere Bundesländer &amp; Nachbarländer {year}
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherRegions.map(r => (
              <Link
                key={r.slug}
                href={`/brueckentage/${year}/${r.slug}`}
                className="inline-flex items-center gap-1 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
              >
                <span>{r.name}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
