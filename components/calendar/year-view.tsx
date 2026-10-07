'use client'

import { useMemo } from 'react'
import { MonthGrid } from './month-grid'
import type { DayInfo } from './day-cell'
import type { VacationEntry, Holiday, EntryType } from '@/types'
import type { BridgeDay } from '@/lib/bridge-days'
import { countHolidayStates } from '@/lib/holidays'

interface YearViewProps {
  year: number
  entries: VacationEntry[]
  publicHolidays: Holiday[]
  schoolHolidays: Holiday[]
  compareHolidays?: Holiday[][]
  compareLabels?: string[]
  showHeatmap: boolean
  showPublicHolidays: boolean
  showSchoolHolidays: boolean
  bridgeDaySet: Set<string>
  bridgeDayMap: Map<string, BridgeDay>
  showBridgeDays: boolean
  showOtherMonthDays: boolean
  overBudgetDates: Set<string>
  onToggle: (date: Date, type: EntryType) => void
  selectedType: EntryType
  onHover?: (info: DayInfo | null) => void
  onSelectDate?: (date: Date) => void
}

export function YearView({
  year, entries, publicHolidays, schoolHolidays,
  compareHolidays = [], compareLabels = [], showHeatmap, showPublicHolidays,
  showSchoolHolidays, bridgeDaySet, bridgeDayMap,
  showBridgeDays, showOtherMonthDays, overBudgetDates,
  onToggle, selectedType, onHover, onSelectDate,
}: YearViewProps) {
  const heatmapData = useMemo(() => {
    if (!showHeatmap || compareHolidays.length === 0) return undefined
    const map = countHolidayStates(compareHolidays)
    const max = Math.max(compareHolidays.length, 1)
    const normalized = new Map<string, number>()
    map.forEach((v, k) => normalized.set(k, v / max))
    return normalized
  }, [showHeatmap, compareHolidays])

  const comparisonByDate = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!showHeatmap) return map
    for (let i = 0; i < compareHolidays.length; i++) {
      for (const date of countHolidayStates([compareHolidays[i]]).keys()) map.set(date, [...(map.get(date) ?? []), compareLabels[i] ?? `Bundesland ${i + 1}`])
    }
    return map
  }, [compareHolidays, compareLabels, showHeatmap])

  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {months.map(monthDate => (
        <MonthGrid
          key={monthDate.toISOString()}
          date={monthDate}
          entries={entries}
          publicHolidays={showPublicHolidays ? publicHolidays : []}
          schoolHolidays={showSchoolHolidays ? schoolHolidays : []}
          heatmapData={heatmapData}
          comparisonByDate={comparisonByDate}
          showHeatmap={showHeatmap}
          bridgeDaySet={bridgeDaySet}
          bridgeDayMap={bridgeDayMap}
          showBridgeDays={showBridgeDays}
          showOtherMonthDays={showOtherMonthDays}
          overBudgetDates={overBudgetDates}
          onToggle={onToggle}
          selectedType={selectedType}
          onHover={onHover}
          onSelectDate={onSelectDate}
        />
      ))}
    </div>
  )
}
