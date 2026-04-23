'use client'

import { useMemo } from 'react'
import { MonthGrid } from './month-grid'
import type { VacationEntry, Holiday, EntryType } from '@/types'
import { format } from 'date-fns'

interface YearViewProps {
  year: number
  entries: VacationEntry[]
  publicHolidays: Holiday[]
  schoolHolidays: Holiday[]
  compareHolidays?: Holiday[][] // per compare region
  showHeatmap: boolean
  showPublicHolidays: boolean
  showSchoolHolidays: boolean
  onToggle: (date: Date, type: EntryType) => void
  selectedType: EntryType
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
  onToggle,
  selectedType,
}: YearViewProps) {
  // Build heatmap: for each day, count how many compare-regions have a holiday
  const heatmapData = useMemo(() => {
    if (!showHeatmap || compareHolidays.length === 0) return undefined
    const map = new Map<string, number>()
    for (const regionHolidays of compareHolidays) {
      for (const h of regionHolidays) {
        const start = new Date(h.startDate)
        const end = new Date(h.endDate)
        const cur = new Date(start)
        while (cur <= end) {
          const key = format(cur, 'yyyy-MM-dd')
          map.set(key, (map.get(key) ?? 0) + 1)
          cur.setDate(cur.getDate() + 1)
        }
      }
    }
    // Normalize to 0-1
    const max = Math.max(...Array.from(map.values()))
    if (max === 0) return undefined
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
          onToggle={onToggle}
          selectedType={selectedType}
        />
      ))}
    </div>
  )
}
