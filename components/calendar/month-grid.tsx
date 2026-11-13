'use client'

import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, format,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { DayCell } from './day-cell'
import type { DayInfo, SharedDayItem, SuggestionPreviewDayInfo } from './day-cell'
import type { VacationEntry, Holiday, EntryType } from '@/types'
import type { BridgeDay } from '@/lib/bridge-days'
import { DEFAULT_WORK_DAYS } from '@/lib/vacation-accounting'

const WEEKDAY_HEADER = [
  { label: 'Mo', dow: 1 },
  { label: 'Di', dow: 2 },
  { label: 'Mi', dow: 3 },
  { label: 'Do', dow: 4 },
  { label: 'Fr', dow: 5 },
  { label: 'Sa', dow: 6 },
  { label: 'So', dow: 0 },
] as const

interface MonthGridProps {
  date: Date
  todayKey?: string
  selectedDayKey?: string | null
  rangeAnchorKey?: string | null
  entries: VacationEntry[]
  publicHolidays: Holiday[]
  schoolHolidays: Holiday[]
  workDays?: number[]
  heatmapData?: Map<string, number>
  comparisonByDate?: Map<string, string[]>
  sharedByDate?: Map<string, SharedDayItem[]>
  suggestionPreviewByDate?: Map<string, SuggestionPreviewDayInfo>
  dragSelectedDates?: Set<string>
  showHeatmap: boolean
  bridgeDaySet: Set<string>
  bridgeDayMap: Map<string, BridgeDay>
  showBridgeDays: boolean
  showOtherMonthDays: boolean
  overBudgetDates: Set<string>
  onToggle: (date: Date, type: EntryType) => void
  onCellPointerDown?: (dateKey: string, event: React.PointerEvent<HTMLButtonElement>) => void
  selectedType: EntryType
  onHover?: (info: DayInfo | null) => void
  onSelectDate?: (date: Date) => void
}

export function MonthGrid({
  date, todayKey, selectedDayKey, rangeAnchorKey, entries, publicHolidays, schoolHolidays,
  workDays = DEFAULT_WORK_DAYS,
  heatmapData, comparisonByDate, sharedByDate,
  suggestionPreviewByDate, dragSelectedDates,
  showHeatmap, bridgeDaySet, bridgeDayMap,
  showBridgeDays, showOtherMonthDays, overBudgetDates,
  onToggle, onCellPointerDown, selectedType, onHover, onSelectDate,
}: MonthGridProps) {
  const activeTodayKey = todayKey ?? format(new Date(), 'yyyy-MM-dd')
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })
  const monthName = format(date, 'MMMM yyyy', { locale: de })
  const monthAnchorId = `month-${format(date, 'yyyy-MM')}`
  const activeWorkDays = workDays.length > 0 ? workDays : DEFAULT_WORK_DAYS

  return (
    <div
      id={monthAnchorId}
      className="flex min-w-0 scroll-mt-28 sm:scroll-mt-20 flex-col gap-1.5 rounded-xl border border-border/70 bg-card/60 p-2.5 shadow-2xs print:break-inside-avoid print:gap-1 print:p-1.5 print:shadow-none"
    >
      <h3 className="text-center text-base font-semibold text-foreground capitalize sm:text-sm">
        {monthName}
      </h3>
      <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-0.5">
        {WEEKDAY_HEADER.map(({ label, dow }) => {
          const isOff = !activeWorkDays.includes(dow)
          return (
            <div
              key={label}
              className={`py-0.5 text-center text-[11px] font-medium sm:text-[10px] ${
                isOff ? 'text-muted-foreground/60 italic' : 'text-muted-foreground'
              }`}
              title={isOff ? 'Arbeitsfreier Wochentag (Wochenende)' : 'Arbeitstag'}
            >
              {label}
            </div>
          )
        })}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const isOffWeekday = !activeWorkDays.includes(day.getDay())
          return (
            <DayCell
              key={day.toISOString()}
              date={day}
              entries={entries}
              publicHolidays={publicHolidays}
              schoolHolidays={schoolHolidays}
              isWeekend={isOffWeekday}
              isToday={key === activeTodayKey}
              isSelectedDay={Boolean(selectedDayKey && key === selectedDayKey)}
              isRangeAnchor={Boolean(rangeAnchorKey && key === rangeAnchorKey)}
              isOtherMonth={!isSameMonth(day, date)}
              isDragSelected={Boolean(dragSelectedDates?.has(key))}
              suggestionPreview={suggestionPreviewByDate?.get(key)}
              heatmapValue={heatmapData?.get(key)}
              comparisonStates={comparisonByDate?.get(key)}
              sharedItems={sharedByDate?.get(key)}
              showHeatmap={showHeatmap}
              isPast={key < activeTodayKey}
              isOverBudget={overBudgetDates.has(key)}
              isBridgeDay={bridgeDaySet.has(key)}
              bridgeDayInfo={bridgeDayMap.get(key)}
              showBridgeDays={showBridgeDays}
              showOtherMonthDays={showOtherMonthDays}
              onToggle={onToggle}
              onCellPointerDown={onCellPointerDown}
              selectedType={selectedType}
              onHover={onHover}
              onSelectDate={onSelectDate}
            />
          )
        })}
      </div>
    </div>
  )
}
