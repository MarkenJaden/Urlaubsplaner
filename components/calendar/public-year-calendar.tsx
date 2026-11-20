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
import {
  Printer,
  Code2,
  Calendar,
  Check,
  Copy,
  Sparkles,
  GraduationCap,
  Flame,
  StickyNote,
  CalendarHeart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { localizedName } from '@/lib/holiday-regions'
import type { Holiday } from '@/types'
import type { BridgeDay } from '@/lib/bridge-days'
import type { VacationSuggestionBlock } from '@/lib/vacation-suggester'

export interface PublicPersonalEntry {
  date: string
  type: 'vacation' | 'gleittag' | 'special' | 'note'
  title?: string | null
}

export interface PublicSharedDayItem {
  label: string
  color: string
  type: string
  title?: string | null
}

export interface PublicPersonalStats {
  vacationDays: number
  gleittagDays: number
  specialDays: number
  noteCount: number
  budgetTotal?: number
}

interface PublicYearCalendarProps {
  year: number
  regionName: string
  regionSlug: string
  mode: 'schulferien' | 'brueckentage' | 'heatmap' | 'personal'
  title?: string
  subtitle?: string
  publicHolidays: Holiday[]
  schoolHolidays?: Holiday[]
  bridgeDays?: BridgeDay[]
  optimalBlocks?: VacationSuggestionBlock[]
  heatmapData?: Record<string, number>
  heatmapTotalStates?: number
  personalEntries?: PublicPersonalEntry[]
  personalSharedByDate?: Record<string, PublicSharedDayItem[]>
  personalStats?: PublicPersonalStats
  showLegend?: boolean
  showHeader?: boolean
  showFilterBar?: boolean
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
  title,
  subtitle,
  publicHolidays,
  schoolHolidays = [],
  bridgeDays = [],
  optimalBlocks = [],
  heatmapData = {},
  heatmapTotalStates = 16,
  personalEntries = [],
  personalSharedByDate = {},
  personalStats,
  showLegend = true,
  showHeader = true,
  showFilterBar,
  plannerHref,
  isEmbed = false,
}: PublicYearCalendarProps) {
  const [filter, setFilter] = useState<HighlightFilter>('all')
  const [showEmbedBox, setShowEmbedBox] = useState(false)
  const [copiedEmbed, setCopiedEmbed] = useState(false)

  const displayFilterBar =
    showFilterBar ?? (mode === 'schulferien' || mode === 'brueckentage')

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

  const personalMaps = useMemo(() => {
    const vacation = new Map<string, string | null>()
    const gleittag = new Map<string, string | null>()
    const special = new Map<string, string | null>()
    const note = new Map<string, string | null>()

    for (const entry of personalEntries) {
      const dateKey = entry.date.slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
      const label = entry.title ?? null
      if (entry.type === 'vacation') vacation.set(dateKey, label)
      else if (entry.type === 'gleittag') gleittag.set(dateKey, label)
      else if (entry.type === 'special') special.set(dateKey, label)
      else if (entry.type === 'note') note.set(dateKey, label)
    }

    return { vacation, gleittag, special, note }
  }, [personalEntries])

  const sharedLegendPeople = useMemo(() => {
    const map = new Map<string, { label: string; color: string; hasNote: boolean; hasLeave: boolean }>()
    for (const items of Object.values(personalSharedByDate)) {
      for (const item of items) {
        const existing = map.get(item.label) ?? {
          label: item.label,
          color: item.color,
          hasNote: false,
          hasLeave: false,
        }
        if (item.type === 'note') existing.hasNote = true
        else existing.hasLeave = true
        map.set(item.label, existing)
      }
    }
    return [...map.values()]
  }, [personalSharedByDate])

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, m) => startOfMonth(new Date(year, m, 1))),
    [year],
  )

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://urlaubsplaner.me'
  const embedPath =
    mode === 'schulferien'
      ? '/embed/schulferien'
      : mode === 'heatmap'
        ? '/embed/widget'
        : '/embed/brueckentage'
  const embedUrl =
    mode === 'heatmap'
      ? `${origin}${embedPath}?year=${year}&region=${encodeURIComponent(regionSlug)}&mode=heatmap`
      : `${origin}${embedPath}?year=${year}&region=${encodeURIComponent(regionSlug)}&view=calendar`
  const iframeSnippet = `<iframe src="${embedUrl}" width="100%" height="760" style="border:1px solid #e2e8f0;border-radius:12px" loading="lazy" title="${mode === 'schulferien' ? 'Schulferien-Kalender' : mode === 'heatmap' ? 'Schulferien-Heatmap' : 'Brückentage-Kalender'} ${year} ${regionName} – urlaubsplaner.me"></iframe>`

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(iframeSnippet)
      setCopiedEmbed(true)
      window.setTimeout(() => setCopiedEmbed(false), 2000)
    } catch {
      // ignore
    }
  }

  const showSchool =
    mode === 'personal'
      ? schoolHolidays.length > 0
      : filter === 'all' || filter === 'school'
  const showBridges =
    mode === 'personal'
      ? bridgeDays.length > 0 || optimalBlocks.length > 0
      : filter === 'all' || filter === 'bridges'

  const defaultHeading =
    mode === 'schulferien'
      ? `Grafischer Schulferien- & Feiertags-Kalender ${year} – ${regionName}`
      : mode === 'heatmap'
        ? `Schulferien-Heatmap Deutschland ${year}`
        : mode === 'personal'
          ? `Mein Urlaubsplan ${year} (${regionName})`
          : `Grafischer Brückentage- & Ferien-Kalender ${year} – ${regionName}`

  const defaultSubtitle =
    mode === 'heatmap'
      ? `Bundesweite Feriendichte über alle ${heatmapTotalStates} Bundesländer – je intensiver die Farbe, desto mehr Länder haben Schulferien.`
      : mode === 'personal'
        ? 'Persönliche Urlaubsplanung – kompakt als schreibgeschützter Jahresüberblick.'
        : 'Alle 12 Monate im Überblick – farblich markiert zum Ansehen, Ausdrucken (A4) oder Einbetten.'

  const HeaderIcon =
    mode === 'schulferien'
      ? GraduationCap
      : mode === 'heatmap'
        ? Flame
        : mode === 'personal'
          ? CalendarHeart
          : Sparkles

  const headerIconColor =
    mode === 'schulferien'
      ? 'text-sky-600'
      : mode === 'heatmap'
        ? 'text-orange-600'
        : mode === 'personal'
          ? 'text-blue-600'
          : 'text-primary'

  return (
    <section
      aria-label={title || defaultHeading}
      className="rounded-2xl border bg-card p-3 sm:p-5 space-y-4 print:border-0 print:p-0 print:shadow-none"
    >
      {/* Header & Controls */}
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <HeaderIcon className={`h-5 w-5 ${headerIconColor}`} aria-hidden="true" />
              <span>{title || defaultHeading}</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              {subtitle || defaultSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {displayFilterBar && (
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
            )}

            {!isEmbed && mode !== 'personal' && (
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
      )}

      {/* Personal Stats Strip */}
      {mode === 'personal' && personalStats && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg border bg-blue-500/10 px-2.5 py-1 font-semibold text-blue-700 dark:text-blue-300">
            Urlaub: {personalStats.vacationDays}
            {personalStats.budgetTotal ? ` / ${personalStats.budgetTotal} Tage` : ' Tage'}
          </span>
          {personalStats.gleittagDays > 0 && (
            <span className="rounded-lg border bg-teal-500/10 px-2.5 py-1 font-semibold text-teal-700 dark:text-teal-300">
              Gleittage: {personalStats.gleittagDays}
            </span>
          )}
          {personalStats.specialDays > 0 && (
            <span className="rounded-lg border bg-purple-500/10 px-2.5 py-1 font-semibold text-purple-700 dark:text-purple-300">
              Sonderurlaub: {personalStats.specialDays}
            </span>
          )}
          {personalStats.noteCount > 0 && (
            <span className="rounded-lg border bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-700 dark:text-amber-300">
              Notizen: {personalStats.noteCount}
            </span>
          )}
        </div>
      )}

      {/* Inline Embed Code Generator Drawer */}
      {showEmbedBox && !isEmbed && mode !== 'personal' && (
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
      {showLegend && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            {mode === 'personal' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-blue-600" />
                  <span>Urlaub</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-teal-600" />
                  <span>Gleittag</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-purple-600" />
                  <span>Sonderurlaub</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-amber-500 bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    <StickyNote className="h-2.5 w-2.5" aria-hidden="true" />
                  </span>
                  <span>Notiz</span>
                </span>
              </>
            )}

            {publicHolidays.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-emerald-500/35 ring-1 ring-inset ring-emerald-600" />
                <span>Gesetzlicher Feiertag</span>
              </span>
            )}

            {mode === 'heatmap' ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-amber-200/70 ring-1 ring-inset ring-amber-400/50" />
                  <span>Wenige Länder (&lt;20%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-amber-400/65" />
                  <span>Einige (20–44%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-orange-500/80" />
                  <span>Viele (45–74%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-rose-600/85" />
                  <span>Hochsaison (≥75%)</span>
                </span>
              </>
            ) : (
              showSchool && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-sky-500/25 border-b-2 border-b-sky-500 ring-1 ring-inset ring-sky-400/50" />
                  <span>Schulferien ({regionName})</span>
                </span>
              )
            )}

            {mode !== 'heatmap' && showBridges && (
              <>
                {bridgeDays.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-orange-500/35 ring-1 ring-inset ring-orange-500 font-bold" />
                    <span>1-Tages-Brückentag</span>
                  </span>
                )}
                {optimalBlocks.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-blue-600" />
                    <span>Empfohlener Urlaubsblock</span>
                  </span>
                )}
              </>
            )}

            {mode === 'personal' &&
              sharedLegendPeople.map(person => (
                <span key={person.label} className="inline-flex items-center gap-1.5">
                  {person.hasLeave && (
                    <span
                      className="h-1.5 w-3 rounded-full"
                      style={{ backgroundColor: person.color }}
                    />
                  )}
                  {person.hasNote && (
                    <span
                      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border bg-background"
                      style={{ borderColor: person.color, color: person.color }}
                    >
                      <StickyNote className="h-2 w-2" aria-hidden="true" />
                    </span>
                  )}
                  <span>{person.label}</span>
                </span>
              ))}
          </div>

          {!isEmbed && mode !== 'personal' && (
            <Link href={plannerHref} className="text-primary underline font-medium print:hidden">
              Im eigenen Urlaubsplaner öffnen &amp; anpassen →
            </Link>
          )}
        </div>
      )}

      {/* Container-aware 12-Month Calendar Grid (prevents wide stretched day boxes) */}
      <div style={{ containerType: 'inline-size' }}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,215px),1fr))] gap-3 print:grid-cols-4 print:gap-2">
          {months.map(monthStart => {
            const days = eachDayOfInterval({
              start: monthStart,
              end: endOfMonth(monthStart),
            })
            const mondayOffset = (monthStart.getDay() + 6) % 7
            const monthLabel = format(monthStart, 'MMMM', { locale: de })

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
                    {monthSchoolNames.size > 0 && showSchool && mode !== 'heatmap' && (
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
                      <span key={`empty-${i}`} className="aspect-[7/6] min-h-6 max-h-9" />
                    ))}
                    {days.map(d => {
                      const k = format(d, 'yyyy-MM-dd')
                      const dow = d.getDay()
                      const isWeekend = dow === 0 || dow === 6
                      const pubName = publicHolidayMap.get(k)
                      const schoolName = showSchool ? schoolHolidayMap.get(k) : undefined
                      const bridge = showBridges ? bridgeMap.get(k) : undefined
                      const optTip = showBridges ? optimalVacationDates.get(k) : undefined
                      const heatCount = mode === 'heatmap' ? (heatmapData[k] ?? 0) : 0

                      const hasVac = mode === 'personal' && personalMaps.vacation.has(k)
                      const hasGleit = mode === 'personal' && personalMaps.gleittag.has(k)
                      const hasSpec = mode === 'personal' && personalMaps.special.has(k)
                      const hasNote = mode === 'personal' && personalMaps.note.has(k)
                      const vacTitle = personalMaps.vacation.get(k)
                      const gleitTitle = personalMaps.gleittag.get(k)
                      const specTitle = personalMaps.special.get(k)
                      const noteTitle = personalMaps.note.get(k)
                      const sharedItems = mode === 'personal' ? (personalSharedByDate[k] ?? []) : []
                      const sharedLeave = sharedItems.filter(item => item.type !== 'note')
                      const sharedNotes = sharedItems.filter(item => item.type === 'note')

                      let cellStyle = isWeekend
                        ? 'bg-muted/50 text-muted-foreground/75'
                        : 'text-foreground hover:bg-muted/40'

                      if (mode === 'personal') {
                        if (hasVac) {
                          cellStyle = 'bg-blue-600 text-white font-semibold'
                        } else if (hasGleit) {
                          cellStyle = 'bg-teal-600 text-white font-semibold'
                        } else if (hasSpec) {
                          cellStyle = 'bg-purple-600 text-white font-semibold'
                        } else if (pubName) {
                          cellStyle =
                            'bg-emerald-500/30 text-emerald-950 dark:text-emerald-100 ring-1 ring-inset ring-emerald-600/70 font-bold'
                        } else if (bridge) {
                          cellStyle =
                            'bg-orange-500/30 text-orange-950 dark:text-orange-100 ring-1 ring-inset ring-orange-500 font-bold'
                        } else if (schoolName) {
                          cellStyle = isWeekend
                            ? 'bg-sky-500/15 text-sky-900/80 dark:text-sky-200/80 border-b-2 border-b-sky-500/60'
                            : 'bg-sky-500/25 text-sky-950 dark:text-sky-100 border-b-2 border-b-sky-500 font-medium'
                        } else if (hasNote) {
                          cellStyle =
                            'bg-amber-500/15 text-amber-950 dark:text-amber-100 ring-1 ring-inset ring-amber-400/80'
                        }
                      } else if (mode === 'heatmap') {
                        const totalStates = Math.max(1, heatmapTotalStates)
                        const ratio = heatCount / totalStates
                        if (ratio >= 0.75) {
                          cellStyle = 'bg-rose-600/80 text-white font-semibold'
                        } else if (ratio >= 0.45) {
                          cellStyle = 'bg-orange-500/75 text-white font-medium'
                        } else if (ratio >= 0.2) {
                          cellStyle = 'bg-amber-400/55 text-amber-950 dark:text-amber-100'
                        } else if (heatCount > 0) {
                          cellStyle = 'bg-amber-200/50 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200'
                        }
                        if (pubName) {
                          cellStyle =
                            heatCount > 0
                              ? `${cellStyle} ring-2 ring-inset ring-emerald-600/85 font-bold`
                              : 'bg-emerald-500/30 text-emerald-950 dark:text-emerald-100 ring-1 ring-inset ring-emerald-600/70 font-bold'
                        }
                      } else {
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
                      }

                      const hasExtraSchoolUnderline =
                        mode !== 'heatmap' &&
                        Boolean(schoolName) &&
                        Boolean(pubName || bridge || optTip || hasVac || hasGleit || hasSpec)

                      const titleParts = [format(d, 'dd.MM.yyyy (EEEE)', { locale: de })]
                      if (hasVac) titleParts.push(`Urlaub${vacTitle ? `: ${vacTitle}` : ''}`)
                      if (hasGleit) titleParts.push(`Gleittag${gleitTitle ? `: ${gleitTitle}` : ''}`)
                      if (hasSpec) titleParts.push(`Sonderurlaub${specTitle ? `: ${specTitle}` : ''}`)
                      if (hasNote) titleParts.push(`Notiz${noteTitle ? `: ${noteTitle}` : ''}`)
                      if (pubName) titleParts.push(`Feiertag: ${pubName}`)
                      if (mode === 'heatmap' && heatCount > 0) {
                        titleParts.push(`${heatCount}/${heatmapTotalStates} Bundesländer haben Schulferien`)
                      } else if (schoolName) {
                        titleParts.push(`Schulferien: ${schoolName}`)
                      }
                      if (bridge) titleParts.push(`Brückentag: 1 UT → ${bridge.freeDaysGained} Tage frei`)
                      if (optTip) titleParts.push(`Tipp: ${optTip}`)
                      for (const s of sharedItems) {
                        if (s.type === 'note') {
                          titleParts.push(`${s.label}: Notiz${s.title ? ` (${s.title})` : ''}`)
                        } else {
                          const typeText = s.type === 'gleittag' ? 'Gleittag' : s.type === 'special' ? 'Sonderurlaub' : 'Urlaub'
                          titleParts.push(`${s.label}: ${typeText}`)
                        }
                      }

                      const primarySharedNote = sharedNotes[0]
                      const sharedNoteCornerClass =
                        hasNote && pubName
                          ? 'bottom-0.5 right-0.5'
                          : hasNote
                            ? 'top-0.5 right-0.5'
                            : 'top-0.5 left-0.5'

                      return (
                        <div
                          key={k}
                          title={titleParts.join(' · ')}
                          className={`relative flex aspect-[7/6] min-h-6 max-h-9 items-center justify-center rounded-xs leading-none transition-colors ${cellStyle} ${
                            hasExtraSchoolUnderline ? 'border-b-2 border-b-sky-500' : ''
                          }`}
                        >
                          {sharedLeave.length > 0 && (
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute top-0.5 left-1/2 -translate-x-1/2 h-0.5 w-2.5 rounded-full"
                              style={{ backgroundColor: sharedLeave[0].color }}
                            />
                          )}
                          {hasNote && (
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute top-0.5 left-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-[2px] border border-amber-500 bg-amber-100 text-amber-700"
                            >
                              <StickyNote className="h-1.5 w-1.5" />
                            </span>
                          )}
                          {primarySharedNote && (
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none absolute ${sharedNoteCornerClass} flex h-2.5 w-2.5 items-center justify-center rounded-[2px] border bg-background shadow-2xs`}
                              style={{
                                borderColor: primarySharedNote.color,
                                color: primarySharedNote.color,
                              }}
                            >
                              <StickyNote className="h-1.5 w-1.5" />
                            </span>
                          )}
                          {pubName && (hasVac || hasGleit || hasSpec) && (
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-300 ring-1 ring-emerald-900/40"
                            />
                          )}
                          <span>{d.getDate()}</span>
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
