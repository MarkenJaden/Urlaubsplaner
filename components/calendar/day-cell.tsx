'use client'

import { cn } from '@/lib/utils'
import type { VacationEntry, Holiday, EntryType } from '@/types'
import { format, isSameDay, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

interface DayCellProps {
  date: Date
  entries: VacationEntry[]
  publicHolidays: Holiday[]
  schoolHolidays: Holiday[]
  isWeekend: boolean
  isToday: boolean
  isOtherMonth: boolean
  heatmapValue?: number // 0-1
  showHeatmap: boolean
  onToggle: (date: Date, type: EntryType) => void
  selectedType: EntryType
}

function getHolidayForDate(holidays: Holiday[], date: Date): Holiday | undefined {
  return holidays.find(h => {
    const start = parseISO(h.startDate)
    const end = parseISO(h.endDate)
    return date >= start && date <= end
  })
}

export function DayCell({
  date,
  entries,
  publicHolidays,
  schoolHolidays,
  isWeekend,
  isToday,
  isOtherMonth,
  heatmapValue,
  showHeatmap,
  onToggle,
  selectedType,
}: DayCellProps) {
  const vacation = entries.find(e => e.type === 'vacation' && isSameDay(parseISO(e.date), date))
  const gleittag = entries.find(e => e.type === 'gleittag' && isSameDay(parseISO(e.date), date))
  const note = entries.find(e => e.type === 'note' && isSameDay(parseISO(e.date), date))
  const publicHoliday = getHolidayForDate(publicHolidays, date)
  const schoolHoliday = getHolidayForDate(schoolHolidays, date)

  const hasEntry = vacation || gleittag || note

  // Heatmap color calculation
  let heatmapStyle: React.CSSProperties = {}
  if (showHeatmap && heatmapValue !== undefined && heatmapValue > 0) {
    const h = Math.round((1 - heatmapValue) * 120) // 120=green, 0=red
    heatmapStyle = {
      backgroundColor: `hsla(${h}, 70%, 85%, ${Math.min(heatmapValue + 0.2, 0.8)})`,
    }
  }

  return (
    <button
      className={cn(
        'day-cell relative w-full aspect-square flex flex-col items-center justify-center rounded-md text-xs font-medium transition-all duration-150',
        'hover:ring-2 hover:ring-primary/50 hover:z-10',
        'focus:outline-none focus:ring-2 focus:ring-primary',
        isOtherMonth && 'opacity-30',
        isWeekend && !hasEntry && !publicHoliday && 'bg-muted/50',
        isToday && 'ring-2 ring-primary',
        vacation && 'bg-blue-500 text-white hover:bg-blue-600',
        gleittag && !vacation && 'bg-purple-500 text-white hover:bg-purple-600',
        note && !vacation && !gleittag && 'bg-gray-400 text-white hover:bg-gray-500',
        publicHoliday && !hasEntry && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        schoolHoliday && !hasEntry && !publicHoliday && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      )}
      style={!hasEntry && !publicHoliday && !schoolHoliday ? heatmapStyle : {}}
      onClick={() => onToggle(date, selectedType)}
      title={[
        publicHoliday ? publicHoliday.name.find(n => n.language === 'DE')?.text ?? publicHoliday.name[0]?.text : null,
        schoolHoliday ? schoolHoliday.name.find(n => n.language === 'DE')?.text ?? schoolHoliday.name[0]?.text : null,
        vacation ? 'Urlaub' : null,
        gleittag ? 'Gleittag' : null,
        note ? (note.title ?? 'Notiz') : null,
      ].filter(Boolean).join(' | ')}
    >
      <span className={cn('leading-none', isToday && !hasEntry && 'text-primary font-bold')}>
        {format(date, 'd')}
      </span>
      {/* Dot indicators */}
      <div className="flex gap-0.5 mt-0.5">
        {publicHoliday && <span className="w-1 h-1 rounded-full bg-green-500" />}
        {schoolHoliday && <span className="w-1 h-1 rounded-full bg-yellow-500" />}
      </div>
    </button>
  )
}
