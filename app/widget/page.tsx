'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SEO_REGIONS, getSeoPlanningYears } from '@/lib/seo-regions'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Check, Copy, Code2, ExternalLink } from 'lucide-react'

export default function WidgetGeneratorPage() {
  const years = getSeoPlanningYears()
  const [year, setYear] = useState<number>(years[1] ?? years[0])
  const [regionSlug, setRegionSlug] = useState<string>('nordrhein-westfalen')
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://urlaubsplaner.me'
  const embedUrl = `${origin}/embed/brueckentage?year=${year}&region=${encodeURIComponent(regionSlug)}`
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="420" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden" loading="lazy" title="Brückentage-Rechner ${year} – urlaubsplaner.me"></iframe>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-4xl space-y-6 py-8 text-sm">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            Kostenloses Brückentage-Widget für Blogs, Intranets &amp; HR
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Brückentage-Rechner auf deiner Webseite einbetten
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Binde den werbefreien Brückentage- &amp; Feiertags-Überblick kostenlos per <code>&lt;iframe&gt;</code> in Reiseblogs, Betriebsrats-Seiten, HR-Intranets oder Lokalmedien ein.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 rounded-xl border bg-card p-4">
          <div className="space-y-1">
            <label htmlFor="widget-year" className="text-xs font-medium text-muted-foreground">
              Standard-Jahr
            </label>
            <select
              id="widget-year"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {years.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="widget-region" className="text-xs font-medium text-muted-foreground">
              Standard-Bundesland / Region
            </label>
            <select
              id="widget-region"
              value={regionSlug}
              onChange={e => setRegionSlug(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {SEO_REGIONS.map(r => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              HTML-Einbettungscode
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/embed/brueckentage?year=${year}&region=${regionSlug}`} target="_blank">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Vorschau in neuem Tab
                </Link>
              </Button>
              <Button size="sm" onClick={() => void handleCopy()}>
                {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                {copied ? 'Code kopiert!' : 'Embed-Code kopieren'}
              </Button>
            </div>
          </div>
          <pre tabIndex={0} className="overflow-x-auto rounded-xl border bg-muted/50 p-3.5 text-xs font-mono">
            <code>{iframeCode}</code>
          </pre>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Live-Vorschau des Widgets</h2>
          <iframe
            src={`/embed/brueckentage?year=${year}&region=${encodeURIComponent(regionSlug)}`}
            width="100%"
            height={420}
            className="rounded-xl border border-border bg-card shadow-xs"
            title={`Brückentage-Rechner ${year}`}
          />
        </div>
      </main>
    </div>
  )
}
