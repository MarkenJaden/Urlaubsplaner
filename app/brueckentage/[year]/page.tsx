import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { fetchHolidays } from '@/lib/holiday-api'
import { detectBridgeDays } from '@/lib/bridge-days'
import { suggestVacation, DEFAULT_PREFERENCES } from '@/lib/vacation-suggester'
import { localizedName } from '@/lib/holiday-regions'
import { formatDays } from '@/lib/vacation-accounting'
import {
  SEO_REGIONS,
  buildPlannerHref,
  getSeoPlanningYears,
  isValidSeoYear,
} from '@/lib/seo-regions'
import type { Holiday } from '@/types'
import { Calendar, Sparkles, MapPin, ArrowRight, HelpCircle } from 'lucide-react'

export const revalidate = 86400

const siteUrl = process.env.NEXTAUTH_URL || 'https://urlaubsplaner.me'

interface PageProps {
  params: Promise<{ year: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year: yearStr } = await params
  const year = Number(yearStr)
  if (!isValidSeoYear(year)) {
    return { title: 'Nicht gefunden' }
  }

  const title = `Brückentage ${year}: Mit wenigen Urlaubstagen maximal frei machen`
  const description = `Alle Brückentage & gesetzlichen Feiertage ${year} im Überblick: Effiziente Urlaubsblöcke berechnen, Bundesländer vergleichen und direkt im kostenlosen Urlaubsplaner ${year} eintragen.`

  return {
    title,
    description,
    alternates: {
      canonical: `/brueckentage/${year}`,
    },
    openGraph: {
      title: `${title} · Urlaubsplaner`,
      description,
      url: `${siteUrl}/brueckentage/${year}`,
      type: 'article',
    },
  }
}

export default async function BrueckentageYearPage({ params }: PageProps) {
  const { year: yearStr } = await params
  const year = Number(yearStr)
  if (!isValidSeoYear(year)) {
    notFound()
  }

  let publicHolidays: Holiday[] = []
  try {
    publicHolidays = await fetchHolidays('DE', undefined, year, 'public')
  } catch {
    publicHolidays = []
  }

  // Nationwide holidays (nationwide === true or no subdivisions restriction)
  const nationwideHolidays = publicHolidays.filter(h => h.nationwide !== false)
  const baseHolidays = nationwideHolidays.length > 0 ? nationwideHolidays : publicHolidays

  const bridgeDays = detectBridgeDays(year, baseHolidays)
  const optimalBlocks =
    baseHolidays.length > 0
      ? suggestVacation(
          year,
          baseHolidays,
          [],
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
  const years = getSeoPlanningYears()
  const germanRegions = SEO_REGIONS.filter(r => r.country === 'DE')
  const dachRegions = SEO_REGIONS.filter(r => r.country !== 'DE')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Urlaubsplaner', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Brückentage', item: `${siteUrl}/brueckentage` },
          { '@type': 'ListItem', position: 3, name: `Brückentage ${year}`, item: `${siteUrl}/brueckentage/${year}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `Wie viele Brückentage gibt es ${year} in Deutschland?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                bridgeDays.length > 0
                  ? `Allein durch die bundesweiten Feiertage entstehen ${year} mindestens ${bridgeDays.length} klassische 1-Tages-Brückentage. Je nach Bundesland kommen durch Fronleichnam, Reformationstag, Allerheiligen, Heilige Drei Könige oder Mariä Himmelfahrt noch weitere Brückentage hinzu.`
                  : `Die genaue Anzahl der Brückentage ${year} hängt von deinem Bundesland ab. Wähle dein Bundesland im Urlaubsplaner aus, um alle regionalen Feiertage automatisch einzubeziehen.`,
            },
          },
          {
            '@type': 'Question',
            name: `Wie hole ich ${year} die meisten freien Tage aus 28 bis 30 Urlaubstagen heraus?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                totalFree > 0
                  ? `Indem du deine Urlaubstage rund um Ostern, die Maifeiertage, Christi Himmelfahrt, Pfingsten und Weihnachten legst, kannst du ${year} aus ${formatDays(totalCost)} Urlaubstagen bis zu ${totalFree} freie Tage herausholen.`
                  : `Kombiniere gesetzliche Feiertage unter der Woche mit angrenzenden Wochenenden im automatischen Brückentage-Optimierer auf urlaubsplaner.me.`,
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
          <nav aria-label="Brotkrumennavigation" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground underline">
              Urlaubsplaner
            </Link>
            <span>/</span>
            <Link href="/brueckentage" className="hover:text-foreground underline">
              Brückentage
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{year}</span>
          </nav>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Jahr wechseln:</span>
            {years.map(y => (
              <Link
                key={y}
                href={`/brueckentage/${y}`}
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
            Optimale Urlaubsplanung {year}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Brückentage {year} in Deutschland – Maximal frei mit wenigen Urlaubstagen
          </h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            Plane deinen Jahresurlaub {year} clever rund um die gesetzlichen Feiertage. Unten findest du alle bundesweiten Brückentage, die besten mehrtägigen Urlaubsfenster sowie die Detailübersichten für alle 16 Bundesländer, Österreich und die Schweiz.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild>
              <Link href={buildPlannerHref({ year, country: 'DE' })}>
                <Calendar className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Urlaub {year} jetzt interaktiv planen
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="#bundeslaender">Bundesland auswählen</a>
            </Button>
          </div>
        </section>

        {/* KPI Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <span className="text-xs text-muted-foreground">Bundesweite Feiertage {year}</span>
            <p className="mt-1 text-2xl font-bold">{baseHolidays.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Plus bis zu 4 weitere je nach Bundesland
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <span className="text-xs text-muted-foreground">1-Tages-Brückentage (bundesweit)</span>
            <p className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">
              {bridgeDays.length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Je 1 Urlaubstag verbindet Feiertag &amp; Wochenende
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <span className="text-xs text-muted-foreground">Optimales 28-Tage-Potenzial</span>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalFree > 0 ? `${totalFree} Tage frei` : 'Interaktiv berechnen'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalCost > 0 ? `Mit ${formatDays(totalCost)} eingesetzten Urlaubstagen` : 'Im Brückentage-Optimierer'}
            </p>
          </div>
        </div>

        {/* Optimal Multi-Day Vacation Blocks */}
        {optimalBlocks.length > 0 && (
          <section aria-labelledby="optimal-blocks-heading" className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="optimal-blocks-heading" className="text-lg font-bold">
                  Die besten Urlaubsblöcke {year} (Effizienz-Empfehlung)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Berechnet für eine klassische 5-Tage-Woche (Mo–Fr) mit bundesweiten Feiertagen:
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href={buildPlannerHref({ year, country: 'DE' })}>
                  Auf eigene Arbeitstage anpassen →
                </Link>
              </Button>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby="optimal-blocks-heading"
              className="overflow-x-auto rounded-lg border"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground border-b">
                  <tr>
                    <th scope="col" className="p-3">Zeitraum</th>
                    <th scope="col" className="p-3">Anlass / Feiertage</th>
                    <th scope="col" className="p-3">Urlaubstage</th>
                    <th scope="col" className="p-3">Freie Tage am Stück</th>
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
                            Enthält: {block.holidaysIncluded.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap font-medium">
                        {formatDays(block.cost)} Tage
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

        {/* Single Bridge Days Table */}
        {bridgeDays.length > 0 && (
          <section aria-labelledby="single-bridges-heading" className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 id="single-bridges-heading" className="text-lg font-bold">
                Klassische 1-Tages-Brückentage {year}
              </h2>
              <p className="text-xs text-muted-foreground">
                Einzelne Arbeitstage direkt zwischen einem gesetzlichen Feiertag und dem Wochenende:
              </p>
            </div>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="single-bridges-heading"
              className="overflow-x-auto rounded-lg border"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground border-b">
                  <tr>
                    <th scope="col" className="p-3">Brückentag (Urlaub nehmen)</th>
                    <th scope="col" className="p-3">Verbindet</th>
                    <th scope="col" className="p-3">Ausbeute</th>
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

        {/* Nationwide Public Holidays */}
        {publicHolidays.length > 0 && (
          <section aria-labelledby="holidays-heading" className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 id="holidays-heading" className="text-lg font-bold">
                Gesetzliche Feiertage {year} in Deutschland
              </h2>
              <p className="text-xs text-muted-foreground">
                Übersicht der Wochentage aller gesetzlichen Feiertage {year}:
              </p>
            </div>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="holidays-heading"
              className="overflow-x-auto rounded-lg border"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground border-b">
                  <tr>
                    <th scope="col" className="p-3">Datum</th>
                    <th scope="col" className="p-3">Wochentag</th>
                    <th scope="col" className="p-3">Feiertag</th>
                    <th scope="col" className="p-3">Geltungsbereich</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {publicHolidays.map((h, i) => {
                    const d = parseISO(h.startDate)
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
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
                          {h.nationwide !== false ? 'Bundesweit' : 'Regional (siehe Bundesland)'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Regional Links for this Year */}
        <section id="bundeslaender" aria-labelledby="states-year-heading" className="space-y-4">
          <div>
            <h2 id="states-year-heading" className="text-lg font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
              Brückentage &amp; Schulferien {year} nach Bundesland
            </h2>
            <p className="text-xs text-muted-foreground">
              Wähle dein Bundesland für alle regionalen Feiertage (z. B. Fronleichnam, Reformationstag, Allerheiligen) und exakten Schulferien {year}:
            </p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {germanRegions.map(r => (
              <Link
                key={r.slug}
                href={`/brueckentage/${year}/${r.slug}`}
                className="group flex items-center justify-between rounded-xl border bg-card px-3.5 py-3 hover:border-primary transition-colors"
              >
                <span className="font-medium group-hover:text-primary transition-colors">
                  {r.name}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
              </Link>
            ))}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 pt-2">
            {dachRegions.map(r => (
              <Link
                key={r.slug}
                href={`/brueckentage/${year}/${r.slug}`}
                className="group flex items-center justify-between rounded-xl border bg-card px-3.5 py-3 hover:border-primary transition-colors"
              >
                <span className="font-medium group-hover:text-primary transition-colors">
                  {r.name} – Fenstertage &amp; Feiertage {year}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-year-heading" className="space-y-3">
          <h2 id="faq-year-heading" className="text-lg font-bold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            Häufige Fragen zur Urlaubsplanung {year}
          </h2>
          <details name="year-faq" open className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer font-semibold">
              Zählen Heiligabend (24.12.) und Silvester (31.12.) {year} als halbe Urlaubstage?
            </summary>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              In vielen Tarifverträgen und Unternehmen kosten der 24. Dezember und der 31. Dezember jeweils nur einen halben Urlaubstag (0,5 Tage), sofern sie auf einen Werktag fallen. Im <Link href={buildPlannerHref({ year })} className="text-primary underline">interaktiven Urlaubsplaner</Link> kannst du diese 0,5-Tage-Regel mit einem Klick ein- oder ausschalten.
            </p>
          </details>
          <details name="year-faq" className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer font-semibold">
              Wie plane ich Brückentage {year} bei einer 4-Tage-Woche oder Teilzeit?
            </summary>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Im Urlaubsplaner kannst du deine individuellen Arbeitstage (z. B. Montag bis Donnerstag) frei festlegen. Der Brückentage-Optimierer berechnet dann ausschließlich Tage als Urlaub, an denen du regulär arbeiten müsstest.
            </p>
          </details>
        </section>
      </main>
    </div>
  )
}
