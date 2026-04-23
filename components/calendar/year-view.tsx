'use client'

import { useMemo } from 'react'
import { MonthGrid } from './month-grid'
import type { DayInfo } from './day-cell'
import type { VacationEntry, Holiday, EntryType } from '@/types'
import { format, parseISO, eachDayOfInterval } from 'date-fns'

interface YearViewProps {
  year: number
  entries: VacationEntry[]
  publicHolidays: Holiday[]
  schoolHolidays: Holiday[]
  compareHolidays?: Holiday[][]
  showHeatmap: boolean
  showPublicHolidays: boolean
  showSchoolHolidays: boolean
  bridgeDaySet: Set<string>
  showBridgeDays: boolean
  overBudgetDates: Set<string>
  onToggle: (date: Date, type: EntryType) => void
  selectedType: EntryType
  onHover?: (info: DayInfo | null) => void
}

export function YearView({
  year,
  entries,
  publicHolidays,
  schoolHolidays,
  compareHolidays = [],
  showHeatmap,
  showPublicHolidays,
  showSchoolHolidays,
  bridgeDaySet,
  showBridgeDays,
  overBudgetDates,
  onToggle,
  selectedType,
  onHover,
}: YearViewProps) {
  const heatmapData = useMemo(() => {
    if (!showHeatmap || compareHolidays.length === 0) return undefined
    const map = new Map<string, number>()
    for (const regionHolidays of compareHolidays) {
      for (const h of regionHolidays) {
        try {
          const start = parseISO(h.startDate)
          const end = parseISO(h.endDate)
          const days = eachDayOfInterval({ start, end })
          for (const d of days) {
            const key = format(d, 'yyyy-MM-dd')
            map.set(key, (map.get(key) ?? 0) + 1)
          }
        } catch { /* skip invalid dates */ }
      }
    }
    const max = Math.max(...Array.from(map.values()), 1)
    const normalized = new Map<string, number>()
    map.forEach((v, k) => normalized.set(k, v / max))
    return normalized
  }, [showHeatmap, compareHolidays])

  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {months.map(monthDate => (
        <MonthGrid
          key={monthDate.toISOString()}
          date={monthDate}
          entries={entries}
          publicHolidays={showPublicHolidays ? publicHolidays : []}
          schoolHolidays={showSchoolHolidays ? schoolHolidays : []}
          heatmapData={heatmapData}
          showHeatmap={showHeatmap}
          bridgeDaySet={bridgeDaySet}
          showBridgeDays={showBridgeDays}
          overBudgetDates={overBudgetDates}
          onToggle={onToggle}
          selectedType={selectedType}
          onHover={onHover}
        />
      ))}
    </div>
  )
}
