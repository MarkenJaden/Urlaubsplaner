'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { Printer, Code2, Calendar, Check, Copy, Sparkles, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { localizedName } from '@/lib/holiday-regions'
import type { Holiday } from '@/types'
import type { BridgeDay } from '@/lib/bridge-days'
import type { VacationSuggestionBlock } from '@/lib/vacation-suggester'

interface PublicYearCalendarProps {
  year: number
  regionName: string
  regionSlug: string
  mode: 'schulferien' | 'brueckentage'
  publicHolidays: Holiday[]
  schoolHolidays: Holiday[]
  bridgeDays?: BridgeDay[]
  optimalBlocks?: VacationSuggestionBlock[]
  plannerHref: string
  isEmbed?: boolean
}

type HighlightFilter = 'all' | 'school' | 'bridges'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function PublicYearCalendar({
  year,
  regionName,
  regionSlug,
  mode,
  publicHolidays,
  schoolHolidays,
  bridgeDays = [],
  optimalBlocks = [],
  plannerHref,
  isEmbed = false,
}: PublicYearCalendarProps) {
  const [filter, setFilter] = useState<HighlightFilter>(
    mode === 'schulferien' ? 'all' : 'all',
  )
  const [showEmbedBox, setShowEmbedBox] = useState(false)
  const [copiedEmbed, setCopiedEmbed] = useState(false)

  const publicHolidayMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of publicHolidays) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(h.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(h.endDate)) continue
      const name = localizedName(h.name)
      for (const d of eachDayOfInterval({ start: parseISO(h.startDate), end: parseISO(h.endDate) })) {
        map.set(format(d, 'yyyy-MM-dd'), name)
      }
    }
    return map
  }, [publicHolidays])

  const schoolHolidayMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of schoolHolidays) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(h.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(h.endDate)) continue
      const name = localizedName(h.name)
      for (const d of eachDayOfInterval({ start: parseISO(h.startDate), end: parseISO(h.endDate) })) {
        map.set(format(d, 'yyyy-MM-dd'), name)
      }
    }
    return map
  }, [schoolHolidays])

  const bridgeMap = useMemo(() => {
    const map = new Map<string, BridgeDay>()
    for (const b of bridgeDays) {
      map.set(b.date, b)
    }
    return map
  }, [bridgeDays])

  const optimalVacationDates = useMemo(() => {
    const map = new Map<string, string>()
    for (const block of optimalBlocks) {
      for (const d of block.vacationDays) {
        map.set(d, `${block.label} (${block.cost} UT → ${block.freeDaysGained}T frei)`)
      }
    }
    return map
  }, [optimalBlocks])

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, m) => startOfMonth(new Date(year, m, 1))),
    [year],
  )

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://urlaubsplaner.me'
  const embedPath = mode === 'schulferien' ? '/embed/schulferien' : '/embed/brueckentage'
  const embedUrl = `${origin}${embedPath}?year=${year}&region=${encodeURIComponent(regionSlug)}&view=calendar`
  const iframeSnippet = `<iframe src="${embedUrl}" width="100%" height="760" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden" loading="lazy" title="${mode === 'schulferien' ? 'Schulferien-Kalender' : 'Brückentage-Kalender'} ${year} ${regionName} – urlaubsplaner.me"></iframe>`

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(iframeSnippet)
      setCopiedEmbed(true)
      window.setTimeout(() => setCopiedEmbed(false), 2000)
    } catch {
      // ignore
    }
  }

  const showSchool = filter === 'all' || filter === 'school'
  const showBridges = filter === 'all' || filter === 'bridges'

  return (
    <section
      aria-label={`Grafischer Jahreskalender ${year} für ${regionName}`}
      className="rounded-2xl border bg-card p-4 sm:p-6 space-y-4 print:border-0 print:p-0 print:shadow-none"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            {mode === 'schulferien' ? (
              <GraduationCap className="h-5 w-5 text-sky-600" aria-hidden="true" />
            ) : (
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            )}
            <span>
              Grafischer {mode === 'schulferien' ? 'Schulferien- & Feiertags-Kalender' : 'Brückentage- & Ferien-Kalender'} {year} – {regionName}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Alle 12 Monate im Überblick – farblich markiert zum Ansehen, Ausdrucken (A4) oder Einbetten.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Alle
            </button>
            <button
              type="button"
              onClick={() => setFilter('school')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === 'school'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Ferien &amp; Feiertage
            </button>
            <button
              type="button"
              onClick={() => setFilter('bridges')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === 'bridges'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Brückentage &amp; Tipps
            </button>
          </div>

          {!isEmbed && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5" />
                Kalender drucken / PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setShowEmbedBox(v => !v)}
              >
                <Code2 className="h-3.5 w-3.5" />
                Einbetten
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Inline Embed Code Generator Drawer */}
      {showEmbedBox && !isEmbed && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2 text-xs print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-foreground">
              Diesen grafischen Kalender kostenlos auf deiner Webseite / im Intranet einbetten:
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                <Link href={`/widget?mode=${mode}&view=calendar&year=${year}&region=${regionSlug}`}>
                  Im Widget-Konfigurator anpassen
                </Link>
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => void handleCopyEmbed()}>
                {copiedEmbed ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedEmbed ? 'Kopiert!' : 'HTML-Code kopieren'}
              </Button>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-lg border bg-background p-2.5 font-mono text-[11px]">
            <code>{iframeSnippet}</code>
          </pre>
        </div>
      )}

      {/* Color Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-emerald-500/35 ring-1 ring-inset ring-emerald-600" />
            <span>Gesetzlicher Feiertag</span>
          </span>
          {showSchool && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-sky-500/25 border-b-2 border-b-sky-500 ring-1 ring-inset ring-sky-400/50" />
              <span>Schulferien ({regionName})</span>
            </span>
          )}
          {showBridges && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-orange-500/35 ring-1 ring-inset ring-orange-500 font-bold" />
                <span>1-Tages-Brückentag</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-blue-600" />
                <span>Empfohlener Urlaubsblock</span>
              </span>
            </>
          )}
        </div>
        {!isEmbed && (
          <Link href={plannerHref} className="text-primary underline font-medium print:hidden">
            Im eigenen Urlaubsplaner öffnen &amp; anpassen →
          </Link>
        )}
      </div>

      {/* 12-Month Calendar Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-4 print:gap-2">
        {months.map(monthStart => {
          const days = eachDayOfInterval({
            start: monthStart,
            end: endOfMonth(monthStart),
          })
          const mondayOffset = (monthStart.getDay() + 6) % 7
          const monthLabel = format(monthStart, 'MMMM', { locale: de })

          // Collect month highlights for the footer of each month card
          const monthPubList: Array<{ date: string; name: string }> = []
          const monthSchoolNames = new Set<string>()
          for (const d of days) {
            const k = format(d, 'yyyy-MM-dd')
            const pub = publicHolidayMap.get(k)
            if (pub) monthPubList.push({ date: format(d, 'dd.MM.'), name: pub })
            const sch = schoolHolidayMap.get(k)
            if (sch) monthSchoolNames.add(sch)
          }

          return (
            <div
              key={monthStart.toISOString()}
              className="flex flex-col justify-between rounded-xl border bg-background/70 p-2.5 shadow-2xs print:p-1.5"
            >
              <div>
                <div className="mb-1.5 flex items-center justify-between border-b pb-1">
                  <h3 className="text-xs font-bold capitalize text-foreground">
                    {monthLabel} {year}
                  </h3>
                  {monthSchoolNames.size > 0 && showSchool && (
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 dark:text-sky-300 truncate max-w-[9rem]">
                      {[...monthSchoolNames].join(', ')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted-foreground mb-1">
                  {WEEKDAYS.map(w => (
                    <span key={w}>{w}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
                  {Array.from({ length: mondayOffset }).map((_, i) => (
                    <span key={`empty-${i}`} className="h-6" />
                  ))}
                  {days.map(d => {
                    const k = format(d, 'yyyy-MM-dd')
                    const dow = d.getDay()
                    const isWeekend = dow === 0 || dow === 6
                    const pubName = publicHolidayMap.get(k)
                    const schoolName = showSchool ? schoolHolidayMap.get(k) : undefined
                    const bridge = showBridges ? bridgeMap.get(k) : undefined
                    const optTip = showBridges ? optimalVacationDates.get(k) : undefined

                    let cellStyle = isWeekend
                      ? 'bg-muted/50 text-muted-foreground/75'
                      : 'text-foreground hover:bg-muted/40'

                    if (pubName) {
                      cellStyle =
                        'bg-emerald-500/30 text-emerald-950 dark:text-emerald-100 ring-1 ring-inset ring-emerald-600/70 font-bold'
                    } else if (bridge) {
                      cellStyle =
                        'bg-orange-500/30 text-orange-950 dark:text-orange-100 ring-1 ring-inset ring-orange-500 font-bold'
                    } else if (optTip) {
                      cellStyle = 'bg-blue-600/85 text-white font-semibold'
                    } else if (schoolName) {
                      cellStyle = isWeekend
                        ? 'bg-sky-500/15 text-sky-900/80 dark:text-sky-200/80 border-b-2 border-b-sky-500/60'
                        : 'bg-sky-500/25 text-sky-950 dark:text-sky-100 border-b-2 border-b-sky-500 font-medium'
                    }

                    // Show school holiday underline even when a day is also a public holiday or bridge day
                    const hasExtraSchoolUnderline =
                      Boolean(schoolName) && Boolean(pubName || bridge || optTip)

                    const titleParts = [format(d, 'dd.MM.yyyy (EEEE)', { locale: de })]
                    if (pubName) titleParts.push(`🎉 Feiertag: ${pubName}`)
                    if (schoolName) titleParts.push(`🏫 Schulferien: ${schoolName}`)
                    if (bridge) titleParts.push(`🌉 Brückentag: 1 UT → ${bridge.freeDaysGained} Tage frei`)
                    if (optTip) titleParts.push(`✨ Tipp: ${optTip}`)

                    return (
                      <div
                        key={k}
                        title={titleParts.join(' · ')}
                        className={`flex h-6 items-center justify-center rounded-xs leading-none transition-colors ${cellStyle} ${
                          hasExtraSchoolUnderline ? 'border-b-2 border-b-sky-500' : ''
                        }`}
                      >
                        {d.getDate()}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Compact Month Footer */}
              {monthPubList.length > 0 && (
                <div className="mt-2 border-t pt-1 space-y-0.5 text-[10px] text-muted-foreground">
                  {monthPubList.slice(0, 3).map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-1 truncate">
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                        {p.date}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isEmbed && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-[11px] text-muted-foreground">
          <span>
            Kostenloser Kalender von <strong>urlaubsplaner.me</strong>
          </span>
          <Link
            href={plannerHref}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 font-semibold text-primary underline"
          >
            <Calendar className="h-3.5 w-3.5" />
            Eigenen Urlaub interaktiv planen →
          </Link>
        </div>
      )}
    </section>
  )
}
