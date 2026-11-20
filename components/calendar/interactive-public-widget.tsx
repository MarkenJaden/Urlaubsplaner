'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Calendar, Flame, GraduationCap, Loader2, Sparkles, List, CalendarDays } from 'lucide-react'
import { PublicYearCalendar } from '@/components/calendar/public-year-calendar'
import { detectBridgeDays } from '@/lib/bridge-days'
import { suggestVacation, DEFAULT_PREFERENCES } from '@/lib/vacation-suggester'
import {
  buildPlannerHref,
  getSeoPlanningYears,
  SEO_REGIONS,
} from '@/lib/seo-regions'
import { localizedName } from '@/lib/holiday-regions'
import { DEFAULT_WORK_DAYS, formatDays } from '@/lib/vacation-accounting'
import type {
  Holiday,
  OptimizationGoal,
  SchoolHolidayStrategy,
} from '@/types'

export type PublicWidgetMode = 'brueckentage' | 'schulferien' | 'heatmap'

interface InteractivePublicWidgetProps {
  initialYear: number
  initialRegionSlug: string
  initialRegionName: string
  initialCountry: string
  initialSubdivision?: string
  initialMode: PublicWidgetMode
  initialGoal?: OptimizationGoal
  initialBudget?: number
  initialWorkDays?: number[]
  initialSchoolStrategy?: SchoolHolidayStrategy
  initialView?: 'calendar' | 'list'
  initialPublicHolidays: Holiday[]
  initialSchoolHolidays: Holiday[]
  initialHeatmap?: Record<string, number>
  initialHeatmapTotalStates?: number
  allowControls?: boolean
  isEmbed?: boolean
}

const GOAL_OPTIONS: Array<{ value: OptimizationGoal; label: string }> = [
  { value: 'balanced', label: 'Ausgewogen' },
  { value: 'max_efficiency', label: 'Max. Effizienz' },
  { value: 'long_breaks', label: 'Lange Blöcke' },
  { value: 'distributed', label: 'Gleichmäßig' },
  { value: 'mini_breaks', label: 'Kurztrips' },
]

const BUDGET_OPTIONS = [15, 20, 25, 28, 30]

const SCHOOL_STRATEGY_OPTIONS: Array<{ value: SchoolHolidayStrategy; label: string }> = [
  { value: 'neutral', label: 'Egal' },
  { value: 'prefer', label: 'Mit Schulferien' },
  { value: 'avoid', label: 'Ohne Schulferien' },
]

export function InteractivePublicWidget({
  initialYear,
  initialRegionSlug,
  initialRegionName,
  initialCountry,
  initialSubdivision,
  initialMode,
  initialGoal = 'balanced',
  initialBudget = 30,
  initialWorkDays = DEFAULT_WORK_DAYS,
  initialSchoolStrategy = 'neutral',
  initialView = 'calendar',
  initialPublicHolidays,
  initialSchoolHolidays,
  initialHeatmap = {},
  initialHeatmapTotalStates = 16,
  allowControls = true,
  isEmbed = false,
}: InteractivePublicWidgetProps) {
  const years = useMemo(() => getSeoPlanningYears(), [])
  const [mode, setMode] = useState<PublicWidgetMode>(initialMode)
  const [year, setYear] = useState<number>(initialYear)
  const [regionSlug, setRegionSlug] = useState<string>(initialRegionSlug)
  const [regionName, setRegionName] = useState<string>(initialRegionName)
  const [country, setCountry] = useState<string>(initialCountry)
  const [subdivision, setSubdivision] = useState<string | undefined>(initialSubdivision)
  const [goal, setGoal] = useState<OptimizationGoal>(initialGoal)
  const [budget, setBudget] = useState<number>(initialBudget)
  const [isFourDayWeek, setIsFourDayWeek] = useState<boolean>(
    initialWorkDays.length === 4 && !initialWorkDays.includes(5),
  )
  const [schoolStrategy, setSchoolStrategy] = useState<SchoolHolidayStrategy>(initialSchoolStrategy)
  const [view, setView] = useState<'calendar' | 'list'>(initialView)

  const [publicHolidays, setPublicHolidays] = useState<Holiday[]>(initialPublicHolidays)
  const [schoolHolidays, setSchoolHolidays] = useState<Holiday[]>(initialSchoolHolidays)
  const [heatmap, setHeatmap] = useState<Record<string, number>>(initialHeatmap)
  const [heatmapTotalStates, setHeatmapTotalStates] = useState<number>(initialHeatmapTotalStates)
  const [loading, setLoading] = useState(false)

  const workDays = useMemo(
    () => (isFourDayWeek ? [1, 2, 3, 4] : DEFAULT_WORK_DAYS),
    [isFourDayWeek],
  )

  const fetchRegionData = async (nextYear: number, nextRegion: string, needHeatmap: boolean) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        year: String(nextYear),
        region: nextRegion,
        includeHeatmap: needHeatmap ? '1' : '0',
      })
      const res = await fetch(`/api/embed/public?${qs}`)
      if (!res.ok) return
      const data = await res.json()
      setYear(data.year)
      setRegionSlug(data.regionSlug)
      setRegionName(data.regionName)
      setCountry(data.country)
      setSubdivision(data.subdivision)
      setPublicHolidays(data.publicHolidays ?? [])
      setSchoolHolidays(data.schoolHolidays ?? [])
      if (needHeatmap && data.heatmap) {
        setHeatmap(data.heatmap)
        setHeatmapTotalStates(data.heatmapTotalStates ?? 16)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleModeChange = (nextMode: PublicWidgetMode) => {
    setMode(nextMode)
    if (nextMode === 'heatmap' && Object.keys(heatmap).length === 0) {
      void fetchRegionData(year, regionSlug, true)
    }
  }

  const handleRegionChange = (nextRegion: string) => {
    setRegionSlug(nextRegion)
    void fetchRegionData(year, nextRegion, mode === 'heatmap')
  }

  const handleYearChange = (nextYear: number) => {
    setYear(nextYear)
    void fetchRegionData(nextYear, regionSlug, mode === 'heatmap')
  }

  const bridgeDays = useMemo(
    () => detectBridgeDays(year, publicHolidays, workDays),
    [year, publicHolidays, workDays],
  )

  const optimalBlocks = useMemo(() => {
    if (mode !== 'brueckentage') return []
    return suggestVacation(
      year,
      publicHolidays,
      schoolHolidays,
      new Set(),
      budget,
      new Set(),
      {
        ...DEFAULT_PREFERENCES,
        goal,
        schoolStrategy,
        preferSchoolHolidays: schoolStrategy === 'prefer',
        avoidSchoolHolidays: schoolStrategy === 'avoid',
        planFromToday: false,
        planStartMode: 'year_start',
        workDays,
      },
      true,
    )
  }, [mode, year, publicHolidays, schoolHolidays, budget, goal, schoolStrategy, workDays])

  const plannerHref = useMemo(
    () => buildPlannerHref({ year, country, subdivision }),
    [year, country, subdivision],
  )

  const heatmapPeaks = useMemo(() => {
    const entries = Object.entries(heatmap)
      .filter(([, count]) => count >= Math.ceil(heatmapTotalStates * 0.5))
      .sort((a, b) => a[0].localeCompare(b[0]))
    const weeks: Array<{ start: string; end: string; maxStates: number }> = []
    for (const [dateStr, count] of entries) {
      const prev = weeks[weeks.length - 1]
      if (prev) {
        const diff = (parseISO(dateStr).getTime() - parseISO(prev.end).getTime()) / 86400000
        if (diff <= 1) {
          prev.end = dateStr
          prev.maxStates = Math.max(prev.maxStates, count)
          continue
        }
      }
      weeks.push({ start: dateStr, end: dateStr, maxStates: count })
    }
    return weeks
  }, [heatmap, heatmapTotalStates])

  return (
    <div className="space-y-3">
      {allowControls && (
        <div className="rounded-xl border bg-card p-3 space-y-3 print:hidden">
          {/* Top Row: Mode Switch + Region & Year + View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex flex-wrap rounded-lg border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleModeChange('brueckentage')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  mode === 'brueckentage'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Brückentage &amp; Optimierer
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('schulferien')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  mode === 'schulferien'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                Schulferien
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('heatmap')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  mode === 'heatmap'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                Ferien-Heatmap
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                aria-label="Bundesland oder Region wählen"
                value={regionSlug}
                onChange={e => handleRegionChange(e.target.value)}
                className="h-8 rounded-lg border bg-background px-2.5 text-xs font-medium"
              >
                <option value="de">Deutschland (bundesweit)</option>
                {SEO_REGIONS.map(r => (
                  <option key={r.slug} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Jahr wählen"
                value={year}
                onChange={e => handleYearChange(Number(e.target.value))}
                className="h-8 rounded-lg border bg-background px-2.5 text-xs font-medium"
              >
                {years.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setView('calendar')}
                  aria-label="Kalenderansicht"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                    view === 'calendar'
                      ? 'bg-background text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Kalender
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-label="Listenansicht"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                    view === 'list'
                      ? 'bg-background text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Liste
                </button>
              </div>

              {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="Lädt…" />}
            </div>
          </div>

          {/* Second Row: Optimizer Controls when in Brückentage mode */}
          {mode === 'brueckentage' && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-2.5 text-[11px]">
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-semibold text-muted-foreground mr-1">Strategie:</span>
                {GOAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGoal(opt.value)}
                    className={`rounded-md px-2 py-1 font-medium transition-colors ${
                      goal === opt.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <span className="font-semibold text-muted-foreground mr-1">Budget:</span>
                {BUDGET_OPTIONS.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBudget(b)}
                    className={`rounded-md px-2 py-1 font-medium transition-colors ${
                      budget === b
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {b} UT
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <span className="font-semibold text-muted-foreground mr-1">Woche:</span>
                <button
                  type="button"
                  onClick={() => setIsFourDayWeek(false)}
                  className={`rounded-md px-2 py-1 font-medium ${
                    !isFourDayWeek ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                  }`}
                >
                  5T (Mo–Fr)
                </button>
                <button
                  type="button"
                  onClick={() => setIsFourDayWeek(true)}
                  className={`rounded-md px-2 py-1 font-medium ${
                    isFourDayWeek ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                  }`}
                >
                  4T (Mo–Do)
                </button>
              </div>

              {schoolHolidays.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-semibold text-muted-foreground mr-1">Schulferien:</span>
                  {SCHOOL_STRATEGY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSchoolStrategy(opt.value)}
                      className={`rounded-md px-2 py-1 font-medium ${
                        schoolStrategy === opt.value
                          ? 'bg-sky-600 text-white'
                          : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'calendar' ? (
        <PublicYearCalendar
          year={year}
          regionName={regionName}
          regionSlug={regionSlug}
          mode={mode}
          publicHolidays={publicHolidays}
          schoolHolidays={schoolHolidays}
          bridgeDays={bridgeDays}
          optimalBlocks={optimalBlocks}
          heatmapData={heatmap}
          heatmapTotalStates={heatmapTotalStates}
          plannerHref={plannerHref}
          isEmbed={isEmbed}
        />
      ) : (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          {mode === 'brueckentage' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Empfohlene Urlaubsblöcke {year} – {regionName}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Strategie: {GOAL_OPTIONS.find(g => g.value === goal)?.label} · Budget: {budget} UT ·{' '}
                    {optimalBlocks.reduce((acc, b) => acc + b.freeDaysGained, 0)} freie Tage gesamt
                  </p>
                </div>
              </div>
              {optimalBlocks.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Für diese Auswahl wurden keine Blöcke gefunden.
                </p>
              ) : (
                <div className="divide-y rounded-xl border">
                  {optimalBlocks.map((b, i) => (
                    <div key={b.id ?? i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{b.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {format(parseISO(b.startDate), 'dd.MM.', { locale: de })} –{' '}
                          {format(parseISO(b.endDate), 'dd.MM.yyyy', { locale: de })}
                          {b.holidaysIncluded.length > 0 ? ` · ${b.holidaysIncluded.join(', ')}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{formatDays(b.cost)} UT</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {b.freeDaysGained}T frei
                        </span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {b.efficiency.toFixed(1)}x
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === 'schulferien' && (
            <>
              <h2 className="text-sm font-bold flex items-center gap-1.5 border-b pb-2.5">
                <GraduationCap className="h-4 w-4 text-sky-600" />
                Schulferien {year} – {regionName}
              </h2>
              {schoolHolidays.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Bitte wähle ein konkretes Bundesland für die Schulferien-Liste (oder nutze die Ferien-Heatmap).
                </p>
              ) : (
                <div className="divide-y rounded-xl border">
                  {schoolHolidays.map(h => (
                    <div key={h.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                      <span className="font-semibold">{localizedName(h.name)}</span>
                      <span className="font-mono text-muted-foreground">
                        {format(parseISO(h.startDate), 'dd.MM.', { locale: de })} –{' '}
                        {format(parseISO(h.endDate), 'dd.MM.yyyy', { locale: de })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === 'heatmap' && (
            <>
              <h2 className="text-sm font-bold flex items-center gap-1.5 border-b pb-2.5">
                <Flame className="h-4 w-4 text-orange-600" />
                Spitzenzeiten mit meisten Schulferien {year} (≥50% der Länder)
              </h2>
              {heatmapPeaks.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Keine Hochsaison-Zeiträume ≥50% gefunden.
                </p>
              ) : (
                <div className="divide-y rounded-xl border">
                  {heatmapPeaks.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                      <span className="font-mono font-semibold">
                        {format(parseISO(p.start), 'dd.MM.', { locale: de })} –{' '}
                        {format(parseISO(p.end), 'dd.MM.yyyy', { locale: de })}
                      </span>
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        bis {p.maxStates}/{heatmapTotalStates} Bundesländer
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

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
        </div>
      )}
    </div>
  )
}
