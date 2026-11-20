'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Sparkles, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicYearCalendar } from '@/components/calendar/public-year-calendar'
import { detectBridgeDays, type BridgeDay } from '@/lib/bridge-days'
import {
  suggestVacation,
  DEFAULT_PREFERENCES,
  type VacationSuggestionBlock,
} from '@/lib/vacation-suggester'
import { DEFAULT_WORK_DAYS, formatDays } from '@/lib/vacation-accounting'
import type { Holiday, OptimizationGoal, SchoolHolidayStrategy } from '@/types'

interface RecommendedBlocksExplorerProps {
  year: number
  regionName: string
  regionSlug: string
  heading: string
  subtitle: string
  publicHolidays: Holiday[]
  schoolHolidays?: Holiday[]
  initialBridgeDays: BridgeDay[]
  initialOptimalBlocks: VacationSuggestionBlock[]
  plannerHref: string
  initialBudget?: number
  initialGoal?: OptimizationGoal
}

const STRATEGY_LABELS: Array<{ value: OptimizationGoal; label: string; hint: string }> = [
  { value: 'balanced', label: 'Ausgewogen', hint: 'Bester Mix aus Effizienz & Blöcken' },
  { value: 'max_efficiency', label: 'Max. Effizienz', hint: 'Top-Brückentage & höchste Quote' },
  { value: 'long_breaks', label: 'Lange Erholung', hint: 'Zusammenhängende 2–3 Wochen' },
  { value: 'distributed', label: 'Über das Jahr', hint: 'Quartalsweise Erholungspausen' },
  { value: 'mini_breaks', label: 'Viele Kurztrips', hint: 'Mehrere 4–6-Tage-Auszeiten' },
]

const BUDGET_PRESETS = [15, 20, 25, 28, 30]

const SCHOOL_OPTIONS: Array<{ value: SchoolHolidayStrategy; label: string }> = [
  { value: 'neutral', label: 'Egal' },
  { value: 'prefer', label: 'Bevorzugen' },
  { value: 'avoid', label: 'Vermeiden' },
]

export function RecommendedBlocksExplorer({
  year,
  regionName,
  regionSlug,
  heading,
  subtitle,
  publicHolidays,
  schoolHolidays = [],
  initialBridgeDays,
  initialOptimalBlocks,
  plannerHref,
  initialBudget = 30,
  initialGoal = 'balanced',
}: RecommendedBlocksExplorerProps) {
  const [goal, setGoal] = useState<OptimizationGoal>(initialGoal)
  const [budget, setBudget] = useState<number>(initialBudget)
  const [fourDayWeek, setFourDayWeek] = useState(false)
  const [schoolStrategy, setSchoolStrategy] = useState<SchoolHolidayStrategy>('neutral')
  const [touched, setTouched] = useState(false)

  const workDays = useMemo(
    () => (fourDayWeek ? [1, 2, 3, 4] : DEFAULT_WORK_DAYS),
    [fourDayWeek],
  )

  const bridgeDays = useMemo(() => {
    if (!touched) return initialBridgeDays
    return detectBridgeDays(year, publicHolidays, workDays)
  }, [touched, initialBridgeDays, year, publicHolidays, workDays])

  const optimalBlocks = useMemo(() => {
    if (!touched) return initialOptimalBlocks
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
  }, [touched, initialOptimalBlocks, year, publicHolidays, schoolHolidays, budget, goal, schoolStrategy, workDays])

  const totalCost = useMemo(
    () => optimalBlocks.reduce((sum, b) => sum + b.cost, 0),
    [optimalBlocks],
  )
  const totalFreeDays = useMemo(
    () => optimalBlocks.reduce((sum, b) => sum + b.freeDaysGained, 0),
    [optimalBlocks],
  )

  const handleReset = () => {
    setGoal(initialGoal)
    setBudget(initialBudget)
    setFourDayWeek(false)
    setSchoolStrategy('neutral')
    setTouched(false)
  }

  return (
    <div className="space-y-6">
      <PublicYearCalendar
        year={year}
        regionName={regionName}
        regionSlug={regionSlug}
        mode="brueckentage"
        publicHolidays={publicHolidays}
        schoolHolidays={schoolHolidays}
        bridgeDays={bridgeDays}
        optimalBlocks={optimalBlocks}
        plannerHref={plannerHref}
      />

      {/* Interactive Optimal Multi-Day Vacation Blocks */}
      <section aria-labelledby="recommended-blocks-heading" className="rounded-xl border bg-card p-5 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="recommended-blocks-heading" className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>{heading}</span>
            </h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {touched && (
              <Button type="button" size="sm" variant="ghost" onClick={handleReset} className="text-xs gap-1">
                <RotateCcw className="h-3.5 w-3.5" />
                Zurücksetzen
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link href={plannerHref}>
                Im eigenen Kalender anpassen →
              </Link>
            </Button>
          </div>
        </div>

        {/* Interactive Parameter Strip */}
        <div className="rounded-xl border bg-muted/30 p-3 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-muted-foreground mr-1">Strategie:</span>
            {STRATEGY_LABELS.map(item => (
              <button
                key={item.value}
                type="button"
                title={item.hint}
                onClick={() => {
                  setGoal(item.value)
                  setTouched(true)
                }}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  goal === item.value
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-background border text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-muted-foreground">Urlaubstage:</span>
              {BUDGET_PRESETS.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setBudget(b)
                    setTouched(true)
                  }}
                  className={`rounded-md px-2 py-1 font-medium transition-colors ${
                    budget === b
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'bg-background border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {b} UT
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-muted-foreground">Arbeitswoche:</span>
              <button
                type="button"
                onClick={() => {
                  setFourDayWeek(false)
                  setTouched(true)
                }}
                className={`rounded-md px-2 py-1 font-medium ${
                  !fourDayWeek ? 'bg-primary text-primary-foreground' : 'bg-background border text-muted-foreground hover:text-foreground'
                }`}
              >
                5T (Mo–Fr)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFourDayWeek(true)
                  setTouched(true)
                }}
                className={`rounded-md px-2 py-1 font-medium ${
                  fourDayWeek ? 'bg-primary text-primary-foreground' : 'bg-background border text-muted-foreground hover:text-foreground'
                }`}
              >
                4T (Mo–Do)
              </button>
            </div>

            {schoolHolidays.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-muted-foreground">Schulferien:</span>
                {SCHOOL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSchoolStrategy(opt.value)
                      setTouched(true)
                    }}
                    className={`rounded-md px-2 py-1 font-medium ${
                      schoolStrategy === opt.value
                        ? 'bg-sky-600 text-white'
                        : 'bg-background border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <div className="ml-auto font-medium text-foreground">
              Bilanz: <strong>{formatDays(totalCost)} UT</strong> →{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">{totalFreeDays} freie Tage</strong>
              {totalCost > 0 && (
                <span className="text-muted-foreground"> ({(totalFreeDays / totalCost).toFixed(1)}x)</span>
              )}
            </div>
          </div>
        </div>

        {optimalBlocks.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Für diese Einstellungen wurden keine empfohlenen Blöcke gefunden.
          </p>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="recommended-blocks-heading"
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
                    <td className="p-3 space-y-1">
                      <div className="font-medium text-foreground">{block.label}</div>
                      {block.holidaysIncluded.length > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          Enthält: {block.holidaysIncluded.join(', ')}
                        </div>
                      )}
                      {block.highlights && block.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {block.highlights.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                            >
                              {tag}
                            </span>
                          ))}
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
        )}
      </section>
    </div>
  )
}
