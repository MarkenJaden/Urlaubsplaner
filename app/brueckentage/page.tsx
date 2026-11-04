import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { SEO_REGIONS, getSeoPlanningYears } from '@/lib/seo-regions'
import { Calendar, Sparkles, MapPin, ArrowRight } from 'lucide-react'

export const revalidate = 86400

const siteUrl = process.env.NEXTAUTH_URL || 'https://urlaubsplaner.me'

export const metadata: Metadata = {
  title: 'Brückentage, Feiertage & Schulferien – Optimal Urlaub planen',
  description:
    'Alle Brückentage, gesetzlichen Feiertage und Schulferien für alle 16 Bundesländer, Österreich und die Schweiz. Hole mit wenigen Urlaubstagen maximale freie Tage heraus.',
  alternates: {
    canonical: '/brueckentage',
  },
  openGraph: {
    title: 'Brückentage & Urlaubsplanung nach Bundesland – Urlaubsplaner',
    description:
      'Übersicht aller Brückentage, Feiertage und Schulferien für Deutschland, Österreich & die Schweiz mit direktem Brückentage-Optimierer.',
    url: `${siteUrl}/brueckentage`,
    type: 'website',
  },
}

export default function BrueckentageHubPage() {
  const years = getSeoPlanningYears()
  const primaryYear = years[1] ?? years[0]
  const germanRegions = SEO_REGIONS.filter(r => r.country === 'DE')
  const dachNeighbors = SEO_REGIONS.filter(r => r.country !== 'DE')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Urlaubsplaner', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Brückentage & Schulferien', item: `${siteUrl}/brueckentage` },
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
          <span className="text-foreground font-medium">Brückentage &amp; Schulferien</span>
        </nav>

        <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8 space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Brückentage-Ratgeber &amp; Ferienkalender
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Brückentage, Feiertage &amp; Schulferien optimal kombinieren
          </h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            Wähle dein Planungsjahr und dein Bundesland (oder Österreich &amp; die Schweiz), um sofort alle gesetzlichen Feiertage, Schulferien und die effizientesten Brückentage-Kombinationen zu sehen – oder starte direkt im kostenlosen interaktiven Jahreskalender.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild>
              <Link href="/">
                <Calendar className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Interaktiven Urlaubsplaner öffnen
              </Link>
            </Button>
            {years.map(y => (
              <Button key={y} variant="outline" asChild>
                <Link href={`/brueckentage/${y}`}>
                  Brückentage {y} ansehen
                </Link>
              </Button>
            ))}
          </div>
        </section>

        {/* Year Cards */}
        <section aria-labelledby="years-heading" className="space-y-4">
          <h2 id="years-heading" className="text-lg font-bold">
            Urlaubsplanung nach Jahr auswählen
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {years.map(y => (
              <Link
                key={y}
                href={`/brueckentage/${y}`}
                className="group rounded-xl border bg-card p-5 space-y-2 hover:border-primary transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold group-hover:text-primary transition-colors">
                    Brückentage {y}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Alle bundesweiten &amp; regionalen Feiertage {y}, Top-Urlaubsblöcke und Effizienz-Rechner.
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* German Federal States */}
        <section aria-labelledby="states-heading" className="space-y-4">
          <div>
            <h2 id="states-heading" className="text-lg font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
              Alle 16 Bundesländer in Deutschland
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Direkt zu den Feiertagen, Schulferien und Brückentagen deines Bundeslandes:
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {germanRegions.map(region => (
              <div key={region.slug} className="rounded-xl border bg-card p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/brueckentage/${primaryYear}/${region.slug}`}
                      className="font-semibold text-base hover:text-primary transition-colors"
                    >
                      {region.name}
                    </Link>
                    {region.shortName && (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {region.shortName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {region.highlight}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                  {years.map(y => (
                    <Link
                      key={y}
                      href={`/brueckentage/${y}/${region.slug}`}
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

        {/* Austria & Switzerland */}
        <section aria-labelledby="dach-heading" className="space-y-4">
          <h2 id="dach-heading" className="text-lg font-bold">
            Österreich &amp; Schweiz (Fenstertage &amp; Brückentage)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {dachNeighbors.map(region => (
              <div key={region.slug} className="rounded-xl border bg-card p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <Link
                    href={`/brueckentage/${primaryYear}/${region.slug}`}
                    className="font-semibold text-base hover:text-primary transition-colors"
                  >
                    {region.name}
                  </Link>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {region.highlight}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                  {years.map(y => (
                    <Link
                      key={y}
                      href={`/brueckentage/${y}/${region.slug}`}
                      className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
                    >
                      Brückentage {y}
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
