'use client'

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isWeekend,
  format,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { DayCell } from './day-cell'
import type { VacationEntry, Holiday, EntryType } from '@/types'

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface MonthGridProps {
  date: Date // Any day in the target month
  entries: VacationEntry[]
  publicHolidays: Holiday[]
  schoolHolidays: Holiday[]
  heatmapData?: Map<string, number>
  showHeatmap: boolean
  onToggle: (date: Date, type: EntryType) => void
  selectedType: EntryType
}

export function MonthGrid({
  date,
  entries,
  publicHolidays,
  schoolHolidays,
  heatmapData,
  showHeatmap,
  onToggle,
  selectedType,
}: MonthGridProps) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  // Start week on Monday (weekStartsOn: 1)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const monthName = format(date, 'MMMM yyyy', { locale: de })

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-center text-sm font-semibold text-foreground capitalize">
        {monthName}
      </h3>
      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">
            {d}
          </div>
        ))}
        {/* Day cells */}
        {days.map(day => (
          <DayCell
            key={day.toISOString()}
            date={day}
            entries={entries}
            publicHolidays={publicHolidays}
            schoolHolidays={schoolHolidays}
            isWeekend={isWeekend(day)}
            isToday={isToday(day)}
            isOtherMonth={!isSameMonth(day, date)}
            heatmapValue={heatmapData?.get(format(day, 'yyyy-MM-dd'))}
            showHeatmap={showHeatmap}
            onToggle={onToggle}
            selectedType={selectedType}
          />
        ))}
      </div>
    </div>
  )
}
