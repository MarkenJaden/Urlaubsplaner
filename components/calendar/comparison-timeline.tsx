'use client'

import { useMemo, useState } from 'react'
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  differenceInCalendarDays,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { Users, Sun, GraduationCap, Sparkles, CheckCircle2, ChevronDown, ChevronUp, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DEFAULT_WORK_DAYS,
  holidayDateSet,
  isOffDayKey,
} from '@/lib/vacation-accounting'
import { localizedName } from '@/lib/holiday-regions'
import type { EntryType, Holiday, SharedPlanOverlay, VacationEntry } from '@/types'

interface ComparisonTimelineProps {
  year: number
  todayKey: string
  entries: VacationEntry[]
  workDays: number[]
  publicHolidays: Holiday[]
  schoolHolidays: Holiday[]
  homeRegionLabel: string
  compareHolidays: Holiday[][]
  compareLabels: string[]
  overlays: SharedPlanOverlay[]
  selectedType: EntryType
  onToggle: (date: Date, type: EntryType) => void
  onOpenSuggestions: () => void
}

interface DateWindow {
  startDate: string
  endDate: string
  days: number
  label?: string
}

type SchoolRowFilterMode = 'active_in_month' | 'own_vacation_overlap' | 'all' | 'density_only'

function buildHolidayMap(holidays: Holiday[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const h of holidays) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(h.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(h.endDate)) continue
    const name = localizedName(h.name)
    const span = eachDayOfInterval({ start: parseISO(h.startDate), end: parseISO(h.endDate) })
    for (const d of span) {
      map.set(format(d, 'yyyy-MM-dd'), name)
    }
  }
  return map
}

function findContiguousWindows(
  yearDays: string[],
  predicate: (dateKey: string) => boolean,
  minDays = 3,
): DateWindow[] {
  const windows: DateWindow[] = []
  let start: string | null = null
  let prev: string | null = null

  for (const key of yearDays) {
    if (predicate(key)) {
      if (!start) start = key
      prev = key
    } else if (start && prev) {
      const days = differenceInCalendarDays(parseISO(prev), parseISO(start)) + 1
      if (days >= minDays) {
        windows.push({ startDate: start, endDate: prev, days })
      }
      start = null
      prev = null
    }
  }
  if (start && prev) {
    const days = differenceInCalendarDays(parseISO(prev), parseISO(start)) + 1
    if (days >= minDays) {
      windows.push({ startDate: start, endDate: prev, days })
    }
  }
  return windows
}

export function ComparisonTimeline({
  year,
  todayKey,
  entries,
  workDays = DEFAULT_WORK_DAYS,
  publicHolidays,
  schoolHolidays,
  homeRegionLabel,
  compareHolidays,
  compareLabels,
  overlays,
  selectedType,
  onToggle,
  onOpenSuggestions,
}: ComparisonTimelineProps) {
  const [showAllCardBadges, setShowAllCardBadges] = useState(false)
  const [schoolRowMode, setSchoolRowMode] = useState<SchoolRowFilterMode>('active_in_month')
  const [expandedMonths, setExpandedMonths] = useState<Record<number, boolean>>({})

  const activeOverlays = useMemo(() => overlays.filter(o => o.enabled), [overlays])

  const yearDays = useMemo(
    () =>
      eachDayOfInterval({
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31),
      }).map(d => format(d, 'yyyy-MM-dd')),
    [year],
  )

  const publicHolidayDates = useMemo(() => holidayDateSet(publicHolidays), [publicHolidays])
  const publicHolidayNames = useMemo(() => buildHolidayMap(publicHolidays), [publicHolidays])
  const homeSchoolMap = useMemo(() => buildHolidayMap(schoolHolidays), [schoolHolidays])

  const compareSchoolMaps = useMemo(
    () => compareHolidays.map(list => buildHolidayMap(list)),
    [compareHolidays],
  )

  const ownEntryByDate = useMemo(() => {
    const map = new Map<string, VacationEntry>()
    for (const e of entries) {
      const k = e.date.slice(0, 10)
      if (!map.has(k) || e.type === 'vacation') {
        map.set(k, e)
      }
    }
    return map
  }, [entries])

  const overlayMaps = useMemo(() => {
    return activeOverlays.map(ov => {
      const byDate = new Map<string, { type: EntryType; title?: string | null }>()
      for (const e of ov.entries) {
        const k = e.date.slice(0, 10)
        if (!byDate.has(k) || e.type === 'vacation') {
          byDate.set(k, e)
        }
      }
      const ovWorkDays = ov.workDays && ov.workDays.length > 0 ? ov.workDays : DEFAULT_WORK_DAYS
      return { overlay: ov, byDate, workDays: ovWorkDays }
    })
  }, [activeOverlays])

  // Check if viewer + all active overlays have a day off AND at least one person used planned leave
  const jointFreeDateSet = useMemo(() => {
    const set = new Set<string>()
    if (overlayMaps.length === 0) return set

    const isViewerOff = (k: string) => {
      const e = ownEntryByDate.get(k)
      if (e && (e.type === 'vacation' || e.type === 'gleittag' || e.type === 'special')) return true
      return publicHolidayDates.has(k) || isOffDayKey(k, workDays)
    }

    const isPartnerOff = (partner: (typeof overlayMaps)[0], k: string) => {
      const e = partner.byDate.get(k)
      if (e && (e.type === 'vacation' || e.type === 'gleittag' || e.type === 'special')) return true
      return publicHolidayDates.has(k) || isOffDayKey(k, partner.workDays)
    }

    for (const k of yearDays) {
      if (isViewerOff(k) && overlayMaps.every(p => isPartnerOff(p, k))) {
        set.add(k)
      }
    }
    return set
  }, [overlayMaps, ownEntryByDate, publicHolidayDates, workDays, yearDays])

  const jointFreeWindows = useMemo(() => {
    if (overlayMaps.length === 0) return []
    const raw = findContiguousWindows(yearDays, k => jointFreeDateSet.has(k), 3)
    return raw.filter(win => {
      const span = eachDayOfInterval({ start: parseISO(win.startDate), end: parseISO(win.endDate) }).map(d =>
        format(d, 'yyyy-MM-dd'),
      )
      return span.some(k => {
        const own = ownEntryByDate.get(k)
        if (own && own.type !== 'note') return true
        return overlayMaps.some(p => {
          const pe = p.byDate.get(k)
          return pe && pe.type !== 'note'
        })
      })
    })
  }, [overlayMaps, yearDays, jointFreeDateSet, ownEntryByDate])

  // School holiday density & off-peak windows (May 1 – Oct 31)
  const allSchoolRegionRows = useMemo(() => {
    const rows: Array<{
      label: string
      isHome: boolean
      map: Map<string, string>
      totalWeekdays: number
      totalDays: number
    }> = []
    const countStats = (m: Map<string, string>) => {
      let totalDays = 0
      let totalWeekdays = 0
      for (const k of yearDays) {
        if (m.has(k)) {
          totalDays++
          const dow = parseISO(k).getDay()
          if (dow !== 0 && dow !== 6) totalWeekdays++
        }
      }
      return { totalDays, totalWeekdays }
    }

    if (homeSchoolMap.size > 0) {
      const stats = countStats(homeSchoolMap)
      rows.push({ label: `${homeRegionLabel} (Eigene)`, isHome: true, map: homeSchoolMap, ...stats })
    }
    for (let i = 0; i < compareSchoolMaps.length; i++) {
      const m = compareSchoolMaps[i]
      const label = compareLabels[i] ?? `Region ${i + 1}`
      if (label === homeRegionLabel) continue
      const stats = countStats(m)
      rows.push({ label, isHome: false, map: m, ...stats })
    }
    return rows
  }, [homeSchoolMap, homeRegionLabel, compareSchoolMaps, compareLabels, yearDays])

  const offPeakWindows = useMemo(() => {
    if (allSchoolRegionRows.length === 0) return []
    const travelSeasonDays = yearDays.filter(k => k >= `${year}-04-15` && k <= `${year}-10-31`)
    return findContiguousWindows(
      travelSeasonDays,
      k => allSchoolRegionRows.every(r => !r.map.has(k)),
      5,
    )
      .sort((a, b) => b.days - a.days)
      .slice(0, 5)
  }, [allSchoolRegionRows, yearDays, year])

  const schoolOverlapWindows = useMemo(() => {
    if (allSchoolRegionRows.length < 2) return []
    return findContiguousWindows(
      yearDays,
      k => allSchoolRegionRows.every(r => r.map.has(k)),
      4,
    )
  }, [allSchoolRegionRows, yearDays])

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)), [year])

  const visibleCardRows = showAllCardBadges
    ? allSchoolRegionRows
    : allSchoolRegionRows.slice(0, 6)

  return (
    <div className="space-y-4">
      {/* Top Insight Cards: Partner Overlaps, Off-Peak Windows, and School Holiday Counts */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Card 1: Partner / Group Overlap Summary */}
        <div className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-teal-600" aria-hidden="true" />
              Gemeinsame freie Fenster ({year})
            </h3>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={onOpenSuggestions}>
              <Sparkles className="h-3 w-3 text-teal-600" />
              Paar-Optimierer
            </Button>
          </div>
          {activeOverlays.length === 0 ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Noch kein Partner- oder Team-Plan eingeblendet. Klicke oben auf <strong>„Teilen“</strong>, um den Link deines Partners einzufügen und sofort alle gemeinsamen freien Tage zu sehen.
            </p>
          ) : jointFreeWindows.length === 0 ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Aktuell noch keine gemeinsamen Urlaubsblöcke (ab 3 Tagen) mit{' '}
              <strong>{activeOverlays.map(o => o.label).join(', ')}</strong>. Starte den Paar-Optimierer für perfekte Überschneidungen!
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {jointFreeWindows.length} gemeinsame Freizeit-Blöcke ({jointFreeWindows.reduce((s, w) => s + w.days, 0)} Tage gesamt):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {jointFreeWindows.map((w, i) => (
                  <Badge key={i} variant="secondary" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 text-[11px]">
                    {format(parseISO(w.startDate), 'dd.MM.')}–{format(parseISO(w.endDate), 'dd.MM.')} ({w.days}T)
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Off-Peak / Nebensaison Finder */}
        <div className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Sun className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Nebensaison-Check (0 % Schulferien)
            </h3>
            <span className="text-[11px] text-muted-foreground">Apr–Okt {year}</span>
          </div>
          {offPeakWindows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Wähle dein Bundesland (oder Vergleichsregionen in den Einstellungen), um schulferienfreie Reisezeiträume zu berechnen.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Längste Zeiträume <strong>komplett ohne Schulferien</strong> in {allSchoolRegionRows.length === 1 ? homeRegionLabel : `allen ${allSchoolRegionRows.length} gewählten Regionen`}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {offPeakWindows.map((w, i) => (
                  <Badge key={i} variant="outline" className="text-[11px] font-medium">
                    {format(parseISO(w.startDate), 'dd.MM.')}–{format(parseISO(w.endDate), 'dd.MM.')} ({w.days} Tage)
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Who has how many school holidays & family overlap */}
        <div className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-sky-500" aria-hidden="true" />
              Ferien-Vergleich &amp; Überschneidungen
            </h3>
            <span className="text-[11px] text-muted-foreground">{allSchoolRegionRows.length} Region(en)</span>
          </div>
          {allSchoolRegionRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Keine Schulferien geladen. Aktiviere „Schulferien“ oder wähle Vergleichs-Bundesländer in den Einstellungen.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex flex-wrap gap-1.5">
                {visibleCardRows.map(r => (
                  <span key={r.label} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-[11px]">
                    <strong className="text-foreground">{r.label}:</strong>
                    <span className="text-muted-foreground">{r.totalDays}T ({r.totalWeekdays} WT)</span>
                  </span>
                ))}
                {allSchoolRegionRows.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCardBadges(v => !v)}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/15"
                  >
                    {showAllCardBadges ? (
                      <>
                        <ChevronUp className="h-3 w-3" /> Weniger anzeigen
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" /> +{allSchoolRegionRows.length - 6} weitere Regionen
                      </>
                    )}
                  </button>
                )}
              </div>
              {schoolOverlapWindows.length > 0 && (
                <p className="text-[11px] text-sky-700 dark:text-sky-300">
                  <strong>Gemeinsame Schulferien aller {allSchoolRegionRows.length} Regionen:</strong>{' '}
                  {schoolOverlapWindows
                    .map(w => `${format(parseISO(w.startDate), 'dd.MM.')}–${format(parseISO(w.endDate), 'dd.MM.')} (${w.days}T)`)
                    .join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 12-Month Horizontal Bar Timeline */}
      <div className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2.5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Jahres-Timeline {year}: Wer hat wann Urlaub &amp; Schulferien?
            </h3>
            <p className="text-xs text-muted-foreground">
              Klicke in der Zeile „Mein Plan“ auf einen Tag, um {selectedType === 'vacation' ? 'Urlaub' : selectedType === 'gleittag' ? 'Gleittage' : selectedType === 'special' ? 'Sonderurlaub' : 'Notizen'} direkt ein- oder auszutragen.
            </p>
          </div>

          {allSchoolRegionRows.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                Bundesländer-Zeilen ({allSchoolRegionRows.length}):
              </span>
              <div className="inline-flex flex-wrap rounded-lg border bg-muted/40 p-0.5 gap-0.5">
                {([
                  { id: 'active_in_month', label: 'Nur mit Ferien im Monat' },
                  { id: 'own_vacation_overlap', label: 'Nur bei meinem Urlaub' },
                  { id: 'density_only', label: 'Kompakt (Dichte-Balken)' },
                  { id: 'all', label: `Alle ${allSchoolRegionRows.length} einzeln` },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSchoolRowMode(opt.id)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      schoolRowMode === opt.id
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-blue-600" /> Mein Urlaub</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-purple-600" /> Gleittag</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-emerald-500/60" /> Feiertag</span>
            {activeOverlays.length > 0 && (
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" /> 🤝 Gemeinsam frei</span>
            )}
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-amber-400/75" /> Einzelne Schulferien</span>
          </div>
          {allSchoolRegionRows.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">🌡️ Ferien-Dichte:</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-lime-400/80" /> 1–25%</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-amber-400/85" /> 26–50%</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-orange-500/85" /> 51–75%</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-rose-500/90" /> &gt;75%</span>
            </div>
          )}
        </div>

        <div className="space-y-3 overflow-x-auto">
          {months.map((monthDate, monthIdx) => {
            const daysInMonth = eachDayOfInterval({
              start: startOfMonth(monthDate),
              end: endOfMonth(monthDate),
            })
            const monthDayKeys = daysInMonth.map(d => format(d, 'yyyy-MM-dd'))
            const monthLabel = format(monthDate, 'MMMM', { locale: de })

            // Filter which individual school holiday rows to show in this month
            const activeInMonthRows = allSchoolRegionRows.filter(
              r => r.isHome || monthDayKeys.some(k => r.map.has(k)),
            )
            const overlapWithOwnVacationRows = allSchoolRegionRows.filter(
              r =>
                r.isHome ||
                monthDayKeys.some(k => {
                  const own = ownEntryByDate.get(k)
                  const hasOwnLeave = own && own.type !== 'note'
                  return hasOwnLeave && r.map.has(k)
                }),
            )

            const candidateRows =
              schoolRowMode === 'density_only'
                ? allSchoolRegionRows.filter(r => r.isHome)
                : schoolRowMode === 'all'
                  ? allSchoolRegionRows
                  : schoolRowMode === 'own_vacation_overlap'
                    ? overlapWithOwnVacationRows
                    : activeInMonthRows

            const isMonthExpanded = Boolean(expandedMonths[monthIdx]) || schoolRowMode === 'all'
            const maxDefaultRows = 5
            const visibleSchoolRows = isMonthExpanded
              ? candidateRows
              : candidateRows.slice(0, maxDefaultRows)
            const hiddenSchoolRowCount = Math.max(0, candidateRows.length - visibleSchoolRows.length)

            return (
              <div key={monthDate.toISOString()} className="min-w-[640px] rounded-lg border border-border/60 bg-muted/10 p-2 space-y-1">
                {/* Month Header & Day Numbers */}
                <div className="grid grid-cols-[11rem_1fr] items-center gap-2">
                  <span className="text-xs font-bold capitalize text-foreground truncate">{monthLabel}</span>
                  <div
                    className="grid gap-0.5"
                    style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, minmax(0, 1fr))` }}
                  >
                    {daysInMonth.map(d => {
                      const k = format(d, 'yyyy-MM-dd')
                      const isWknd = isOffDayKey(k, workDays)
                      const isToday = k === todayKey
                      return (
                        <div
                          key={k}
                          className={`text-center text-[9px] leading-tight py-0.5 rounded-xs ${
                            isToday
                              ? 'bg-primary text-primary-foreground font-bold'
                              : isWknd
                                ? 'text-muted-foreground/60 bg-muted/50'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {d.getDate()}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Row 1: Own Plan */}
                <div className="grid grid-cols-[11rem_1fr] items-center gap-2">
                  <span className="text-[11px] font-medium text-foreground truncate">Mein Plan</span>
                  <div
                    className="grid gap-0.5"
                    style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, minmax(0, 1fr))` }}
                  >
                    {daysInMonth.map(d => {
                      const k = format(d, 'yyyy-MM-dd')
                      const entry = ownEntryByDate.get(k)
                      const pubName = publicHolidayNames.get(k)
                      const isWknd = isOffDayKey(k, workDays)

                      let cellClass = 'bg-background hover:bg-muted border border-border/40'
                      if (entry?.type === 'vacation') cellClass = 'bg-blue-600 text-white'
                      else if (entry?.type === 'gleittag') cellClass = 'bg-purple-600 text-white'
                      else if (entry?.type === 'special') cellClass = 'bg-cyan-600 text-white'
                      else if (entry?.type === 'note') cellClass = 'bg-slate-500 text-white'
                      else if (pubName) cellClass = 'bg-emerald-500/45 border border-emerald-500/70'
                      else if (isWknd) cellClass = 'bg-muted/60'

                      const titleParts = [format(d, 'dd.MM.yyyy (EE)', { locale: de })]
                      if (pubName) titleParts.push(`Feiertag: ${pubName}`)
                      if (entry) titleParts.push(entry.type === 'vacation' ? 'Urlaub' : entry.type === 'gleittag' ? 'Gleittag' : entry.title || entry.type)

                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => onToggle(d, selectedType)}
                          title={titleParts.join(' · ')}
                          aria-label={titleParts.join(' ')}
                          className={`h-4 rounded-xs transition-colors ${cellClass}`}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Partner Rows */}
                {overlayMaps.map(({ overlay, byDate, workDays: ovWorkDays }) => (
                  <div key={overlay.id} className="grid grid-cols-[11rem_1fr] items-center gap-2">
                    <span className="text-[11px] font-medium truncate flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: overlay.color }} />
                      <span className="truncate">{overlay.label}</span>
                    </span>
                    <div
                      className="grid gap-0.5"
                      style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, minmax(0, 1fr))` }}
                    >
                      {daysInMonth.map(d => {
                        const k = format(d, 'yyyy-MM-dd')
                        const pe = byDate.get(k)
                        const isPartnerOffDay = isOffDayKey(k, ovWorkDays)
                        const hasLeave = pe && (pe.type === 'vacation' || pe.type === 'gleittag' || pe.type === 'special')
                        return (
                          <div
                            key={k}
                            title={`${overlay.label} (${format(d, 'dd.MM.')}): ${
                              hasLeave ? 'Urlaub / Frei' : isPartnerOffDay ? 'Regulär frei' : 'Arbeitstag'
                            }`}
                            className={`h-3.5 rounded-xs ${
                              hasLeave
                                ? ''
                                : isPartnerOffDay
                                  ? 'bg-muted/60 border border-dashed border-border'
                                  : 'bg-background/60 border border-border/30'
                            }`}
                            style={hasLeave ? { backgroundColor: overlay.color } : undefined}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Joint Free Overlap Row */}
                {overlayMaps.length > 0 && (
                  <div className="grid grid-cols-[11rem_1fr] items-center gap-2">
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                      🤝 Gemeinsam frei
                    </span>
                    <div
                      className="grid gap-0.5"
                      style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, minmax(0, 1fr))` }}
                    >
                      {daysInMonth.map(d => {
                        const k = format(d, 'yyyy-MM-dd')
                        const bothFree = jointFreeDateSet.has(k)
                        return (
                          <div
                            key={k}
                            title={bothFree ? `${format(d, 'dd.MM.yyyy')}: Gemeinsam frei!` : undefined}
                            className={`h-2.5 rounded-xs ${
                              bothFree ? 'bg-emerald-500 shadow-2xs' : 'bg-transparent'
                            }`}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Aggregated School Holiday Density Row covering ALL selected regions */}
                {allSchoolRegionRows.length > 1 && (
                  <div className="grid grid-cols-[11rem_1fr] items-center gap-2">
                    <span
                      className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 truncate"
                      title={`Aggregierte Ferien-Auslastung über alle ${allSchoolRegionRows.length} ausgewählten Regionen`}
                    >
                      🌡️ Ferien-Dichte ({allSchoolRegionRows.length} Reg.)
                    </span>
                    <div
                      className="grid gap-0.5"
                      style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, minmax(0, 1fr))` }}
                    >
                      {daysInMonth.map(d => {
                        const k = format(d, 'yyyy-MM-dd')
                        const activeRegions = allSchoolRegionRows.filter(r => r.map.has(k))
                        const count = activeRegions.length
                        const ratio = count / allSchoolRegionRows.length
                        let heatClass = 'bg-background/35'
                        if (count > 0) {
                          if (ratio <= 0.25) heatClass = 'bg-lime-400/80 dark:bg-lime-500/60'
                          else if (ratio <= 0.5) heatClass = 'bg-amber-400/85 dark:bg-amber-500/70'
                          else if (ratio <= 0.75) heatClass = 'bg-orange-500/85 dark:bg-orange-500/75'
                          else heatClass = 'bg-rose-500/90 dark:bg-rose-500/85'
                        }
                        const tooltip =
                          count > 0
                            ? `${format(d, 'dd.MM.yyyy')}: ${count}/${allSchoolRegionRows.length} Regionen in Ferien (${activeRegions.map(r => r.label.replace(' (Eigene)', '')).join(', ')})`
                            : `${format(d, 'dd.MM.yyyy')}: 0/${allSchoolRegionRows.length} Regionen in Ferien`
                        return (
                          <div
                            key={k}
                            title={tooltip}
                            className={`h-3 rounded-xs ${heatClass}`}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Individual School Holiday Rows */}
                {visibleSchoolRows.map(regionRow => (
                  <div key={regionRow.label} className="grid grid-cols-[11rem_1fr] items-center gap-2">
                    <span
                      className={`text-[10px] truncate ${
                        regionRow.isHome ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      }`}
                      title={`Schulferien ${regionRow.label}`}
                    >
                      🏫 {regionRow.label}
                    </span>
                    <div
                      className="grid gap-0.5"
                      style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, minmax(0, 1fr))` }}
                    >
                      {daysInMonth.map(d => {
                        const k = format(d, 'yyyy-MM-dd')
                        const holidayName = regionRow.map.get(k)
                        return (
                          <div
                            key={k}
                            title={holidayName ? `${regionRow.label}: ${holidayName} (${format(d, 'dd.MM.')})` : undefined}
                            className={`h-2.5 rounded-xs ${
                              holidayName
                                ? regionRow.isHome
                                  ? 'bg-sky-500/80 dark:bg-sky-400/70'
                                  : 'bg-amber-400/75 dark:bg-amber-400/55'
                                : 'bg-background/40'
                            }`}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Expand/Collapse button when more regions have school holidays in this month */}
                {(hiddenSchoolRowCount > 0 || Boolean(expandedMonths[monthIdx])) && schoolRowMode !== 'all' && (
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMonths(prev => ({ ...prev, [monthIdx]: !prev[monthIdx] }))
                      }
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                    >
                      {expandedMonths[monthIdx] ? (
                        <>
                          <ChevronUp className="h-3 w-3" /> Weniger Bundesländer in {monthLabel} zeigen
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" /> +{hiddenSchoolRowCount} weitere Regionen mit Ferien im {monthLabel} aufklappen
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
