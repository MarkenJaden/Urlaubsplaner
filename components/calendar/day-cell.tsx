'use client'

import { cn } from '@/lib/utils'
import type { VacationEntry, Holiday, EntryType } from '@/types'
import type { BridgeDay } from '@/lib/bridge-days'
import { format, parseISO } from 'date-fns'

export interface SharedDayItem {
  label: string
  color: string
  type: EntryType
  title?: string | null
}

export interface DayInfo {
  date: Date
  publicHoliday?: string
  schoolHoliday?: string
  isBridgeDay: boolean
  bridgeDayInfo?: BridgeDay
  entry?: VacationEntry
  comparisonStates?: string[]
  heatmapRatio?: number
  sharedItems?: SharedDayItem[]
  /** Horizontal centre of the hovered cell in the viewport; keeps the info panel off that side. */
  anchorX?: number
}

interface DayCellProps {
  date: Date
  entries: VacationEntry[]
  publicHolidays: Holiday[]
  schoolHolidays: Holiday[]
  isWeekend: boolean
  isToday: boolean
  isOtherMonth: boolean
  isPast: boolean
  isOverBudget: boolean
  heatmapValue?: number
  comparisonStates?: string[]
  showHeatmap: boolean
  isBridgeDay: boolean
  bridgeDayInfo?: BridgeDay
  showBridgeDays: boolean
  showOtherMonthDays: boolean
  sharedItems?: SharedDayItem[]
  onToggle: (date: Date, type: EntryType) => void
  selectedType: EntryType
  onHover?: (info: DayInfo | null) => void
  onSelectDate?: (date: Date) => void
}

function getHolidayForDate(holidays: Holiday[], date: Date): Holiday | undefined {
  return holidays.find(h => {
    const start = parseISO(h.startDate)
    const end = parseISO(h.endDate)
    return date >= start && date <= end
  })
}

function getHolidayName(h: Holiday): string {
  return h.name.find(n => n.language === 'DE')?.text ?? h.name[0]?.text ?? ''
}

function getHeatmapClass(value?: number): string {
  if (value === undefined || value <= 0) return ''
  if (value <= 0.25) return 'bg-lime-200/90 text-lime-950 dark:bg-lime-500/35 dark:text-lime-100'
  if (value <= 0.5) return 'bg-amber-300/95 text-amber-950 dark:bg-amber-500/45 dark:text-amber-50'
  if (value <= 0.75) return 'bg-orange-400/95 text-white dark:bg-orange-500/65 dark:text-white'
  return 'bg-rose-500/95 text-white font-semibold dark:bg-rose-600/80 dark:text-white'
}

export function DayCell({
  date, entries, publicHolidays, schoolHolidays,
  isWeekend, isToday, isOtherMonth, isPast, isOverBudget,
  heatmapValue, comparisonStates = [], showHeatmap, isBridgeDay, bridgeDayInfo,
  showBridgeDays, showOtherMonthDays, sharedItems = [],
  onToggle, selectedType, onHover, onSelectDate,
}: DayCellProps) {
  if (isOtherMonth && !showOtherMonthDays) {
    return <div className="aspect-square" />
  }

  // Entries are stored as UTC midnight; compare calendar dates, not local instants.
  const key = format(date, 'yyyy-MM-dd')
  const vacation = entries.find(e => e.type === 'vacation' && e.date.slice(0, 10) === key)
  const gleittag = entries.find(e => e.type === 'gleittag' && e.date.slice(0, 10) === key)
  const note = entries.find(e => e.type === 'note' && e.date.slice(0, 10) === key)
  const publicHoliday = getHolidayForDate(publicHolidays, date)
  const schoolHoliday = getHolidayForDate(schoolHolidays, date)
  const hasEntry = vacation || gleittag || note
  const hasHeatmap = showHeatmap && heatmapValue !== undefined && heatmapValue > 0

  const buildTitle = (): string => {
    const parts: string[] = []
    if (publicHoliday) parts.push(getHolidayName(publicHoliday))
    if (schoolHoliday) parts.push(`Eigene Schulferien: ${getHolidayName(schoolHoliday)}`)
    if (showBridgeDays && isBridgeDay && bridgeDayInfo) {
      const before = bridgeDayInfo.connectsBeforeName
      const after = bridgeDayInfo.connectsAfterName
      parts.push(`Brückentag → verbindet ${before} mit ${after}`)
      parts.push(`1 Tag Urlaub → ${bridgeDayInfo.freeDaysGained} Tage frei`)
    } else if (showBridgeDays && isBridgeDay) {
      parts.push('Brückentag')
    }
    if (vacation) parts.push('Urlaub')
    if (gleittag) parts.push('Gleittag')
    if (note) parts.push(note.title ?? 'Notiz')
    for (const s of sharedItems) {
      const tLabel = s.type === 'vacation' ? 'Urlaub' : s.type === 'gleittag' ? 'Gleittag' : s.title || 'Notiz'
      parts.push(`${s.label}: ${tLabel}`)
    }
    if (comparisonStates.length) parts.push(`Ferien-Dichte (${comparisonStates.length} Regionen): ${comparisonStates.join(', ')}`)
    return parts.join('\n')
  }

  const buildDayInfo = (): DayInfo => ({
    date,
    comparisonStates,
    heatmapRatio: heatmapValue,
    publicHoliday: publicHoliday ? getHolidayName(publicHoliday) : undefined,
    schoolHoliday: schoolHoliday ? getHolidayName(schoolHoliday) : undefined,
    isBridgeDay: showBridgeDays && isBridgeDay,
    bridgeDayInfo,
    entry: vacation ?? gleittag ?? note ?? undefined,
    sharedItems,
  })

  const handleMouseEnter = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (window.matchMedia('(hover: none)').matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    onHover?.({ ...buildDayInfo(), anchorX: rect.left + rect.width / 2 })
  }

  const handleMouseLeave = () => onHover?.(null)

  const handleClick = () => {
    onToggle(date, selectedType)
    if (window.matchMedia('(hover: none)').matches) onSelectDate?.(date)
  }

  const heatmapClass = !hasEntry && !publicHoliday && !(showBridgeDays && isBridgeDay) && hasHeatmap
    ? getHeatmapClass(heatmapValue)
    : ''

  return (
    <button
      className={cn(
        'day-cell relative w-full aspect-square flex flex-col items-center justify-center',
        'rounded-md text-sm font-medium transition-all duration-150 sm:text-xs',
        'min-h-11 sm:min-h-0',
        'hover:ring-2 hover:ring-primary/60 hover:z-10 hover:scale-105',
        'active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isOtherMonth && 'opacity-25',
        // Future vs Past clarity:
        !isPast && !isOtherMonth && !hasEntry && !publicHoliday && !schoolHoliday && !hasHeatmap && !isWeekend && 'bg-background text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.6)] dark:bg-card/95',
        isWeekend && !hasEntry && !publicHoliday && !hasHeatmap && 'bg-muted/70 text-muted-foreground',
        isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background z-10',
        // Past days are distinctly dimmed across all states so past vs future is unmistakable:
        isPast && !hasEntry && !publicHoliday && !schoolHoliday && !isBridgeDay && !hasHeatmap && 'opacity-35 bg-muted/40 text-muted-foreground saturate-50',
        isPast && (hasEntry || publicHoliday || schoolHoliday || isBridgeDay || hasHeatmap) && 'opacity-50 saturate-[0.65]',
        // Entries:
        vacation && !isOverBudget && 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs',
        vacation && isOverBudget && 'bg-red-600 text-white hover:bg-red-700 shadow-2xs',
        gleittag && !vacation && 'bg-purple-600 text-white hover:bg-purple-700 shadow-2xs',
        note && !vacation && !gleittag && 'bg-slate-500 text-white hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500',
        // Public Holiday:
        publicHoliday && !hasEntry && 'bg-emerald-100 text-emerald-900 border border-emerald-300/80 dark:bg-emerald-500/30 dark:text-emerald-100 dark:border-emerald-500/50',
        // Heatmap background:
        heatmapClass,
        // Own School Holiday when Heatmap is OFF:
        schoolHoliday && !showHeatmap && !hasEntry && !publicHoliday && 'bg-amber-100/85 text-amber-950 dark:bg-amber-400/20 dark:text-amber-100',
        // Own School Holiday when Heatmap is ON (subtle inner frame + bottom accent so own school holidays are recognizable without clashing):
        schoolHoliday && showHeatmap && !hasEntry && 'ring-1 ring-inset ring-foreground/45 border-b-2 border-b-foreground/65 dark:ring-white/60 dark:border-b-white/75 font-semibold',
        // Bridge day:
        showBridgeDays && isBridgeDay && !hasEntry && !publicHoliday && 'ring-2 ring-orange-500 bg-orange-50 text-orange-950 dark:bg-orange-500/25 dark:text-orange-100',
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={buildTitle()}
      aria-label={`${format(date, 'dd.MM.yyyy')}${buildTitle() ? ` · ${buildTitle()}` : ''}`}
      aria-pressed={Boolean(hasEntry)}
    >
      {/* Shared plan overlay bar at top of cell */}
      {sharedItems.length > 0 && (
        <div className="absolute top-0.5 inset-x-1 flex gap-0.5 justify-center pointer-events-none">
          {sharedItems.slice(0, 3).map((s, idx) => (
            <span
              key={idx}
              className="h-1 flex-1 max-w-3 rounded-full"
              style={{ backgroundColor: s.color }}
            />
          ))}
        </div>
      )}

      <span className={cn('leading-none', isToday && !hasEntry && 'text-primary font-extrabold underline decoration-2 underline-offset-2')}>
        {format(date, 'd')}
      </span>

      <div className="flex gap-0.5 mt-0.5">
        {publicHoliday && <span className="w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
        {schoolHoliday && <span className={cn('w-1 h-1 rounded-full', showHeatmap ? 'bg-foreground/75 dark:bg-white/85' : 'bg-amber-500')} />}
        {showBridgeDays && isBridgeDay && !hasEntry && <span className="w-1 h-1 rounded-full bg-orange-500" />}
      </div>
    </button>
  )
}
