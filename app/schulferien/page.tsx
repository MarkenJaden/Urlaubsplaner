import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { SEO_REGIONS, getSeoPlanningYears } from '@/lib/seo-regions'
import { GraduationCap, Calendar, MapPin, ArrowRight } from 'lucide-react'

export const revalidate = 86400

const siteUrl = process.env.NEXTAUTH_URL || 'https://urlaubsplaner.me'

export const metadata: Metadata = {
  title: 'Schulferien Kalender & Ferien-Vergleich aller Bundesländer',
  description:
    'Alle Schulferien-Termine für alle 16 Bundesländer, Ferien-Überschneidungen, Nebensaison-Check und familienfreundliche Brückentage auf einen Blick.',
  alternates: {
    canonical: '/schulferien',
  },
  openGraph: {
    title: 'Schulferien Kalender & Bundesländer-Vergleich · Urlaubsplaner',
    description:
      'Wann hat welches Bundesland Schulferien? Alle Ferientermine, Ferientage-Zähler und optimale Familien-Urlaubswochen.',
    url: `${siteUrl}/schulferien`,
    type: 'website',
  },
}

export default function SchulferienHubPage() {
  const years = getSeoPlanningYears()
  const primaryYear = years[1] ?? years[0]
  const germanRegions = SEO_REGIONS.filter(r => r.country === 'DE')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Urlaubsplaner', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Schulferien', item: `${siteUrl}/schulferien` },
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
        <nav aria-label="Brotkrumennavigation" className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground underline">
            Urlaubsplaner
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Schulferien</span>
        </nav>

        <section className="rounded-2xl border bg-gradient-to-br from-sky-500/10 via-card to-card p-6 sm:p-8 space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
            Schulferien-Kalender &amp; Bundesländer-Vergleich
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Schulferien nach Bundesland &amp; Jahr vergleichen
          </h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            Sieh auf einen Blick, wann welches Bundesland Oster-, Pfingst-, Sommer-, Herbst- oder Weihnachtsferien hat, wie viele Ferientage anfallen und wann die besten Nebensaison-Zeiträume komplett ohne Schulferien liegen.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild>
              <Link href="/">
                <Calendar className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Mit Schulferien-Heatmap im Kalender planen
              </Link>
            </Button>
            {years.map(y => (
              <Button key={y} variant="outline" asChild>
                <Link href={`/schulferien/${y}`}>
                  Schulferien {y}
                </Link>
              </Button>
            ))}
          </div>
        </section>

        <section aria-labelledby="schulferien-years-heading" className="space-y-4">
          <h2 id="schulferien-years-heading" className="text-lg font-bold">
            Schulferien-Jahresübersicht wählen
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {years.map(y => (
              <Link
                key={y}
                href={`/schulferien/${y}`}
                className="group rounded-xl border bg-card p-5 space-y-2 hover:border-primary transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold group-hover:text-primary transition-colors">
                    Schulferien {y}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Alle Schulferien {y} im Bundesländer-Vergleich, Sommerferien-Korridor &amp; Familien-Brückentage.
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="schulferien-states-heading" className="space-y-4">
          <h2 id="schulferien-states-heading" className="text-lg font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            Schulferien nach Bundesland ({primaryYear})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {germanRegions.map(region => (
              <div key={region.slug} className="rounded-xl border bg-card p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/schulferien/${primaryYear}/${region.slug}`}
                      className="font-semibold text-base hover:text-primary transition-colors"
                    >
                      Schulferien {region.name}
                    </Link>
                    {region.shortName && (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {region.shortName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Alle Ferientermine &amp; optimale Familien-Urlaubstage {region.preposition}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                  {years.map(y => (
                    <Link
                      key={y}
                      href={`/schulferien/${y}/${region.slug}`}
                      className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
                    >
                      {y}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
