'use client'

import { cn } from '@/lib/utils'
import type { VacationEntry, Holiday, EntryType } from '@/types'
import type { BridgeDay } from '@/lib/bridge-days'
import { format, parseISO } from 'date-fns'
import { StickyNote } from 'lucide-react'

export interface SharedDayItem {
  label: string
  color: string
  type: EntryType | 'off_day'
  title?: string | null
}

export interface SuggestionPreviewDayInfo {
  blockIndex: number
  label: string
  isVacationDay: boolean
  isFirstVacationDay: boolean
  isLastVacationDay: boolean
  isSelectedBlock: boolean
  cost: number
  freeDaysGained: number
  efficiency: number
}

export interface DayInfo {
  date: Date
  publicHoliday?: string
  isPublicHolidayRegional?: boolean
  schoolHoliday?: string
  isBridgeDay: boolean
  bridgeDayInfo?: BridgeDay
  entry?: VacationEntry
  noteEntry?: VacationEntry
  comparisonStates?: string[]
  heatmapRatio?: number
  sharedItems?: SharedDayItem[]
  suggestionPreview?: SuggestionPreviewDayInfo
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
  isDragSelected?: boolean
  suggestionPreview?: SuggestionPreviewDayInfo
  heatmapValue?: number
  comparisonStates?: string[]
  showHeatmap: boolean
  isBridgeDay: boolean
  bridgeDayInfo?: BridgeDay
  showBridgeDays: boolean
  showOtherMonthDays: boolean
  sharedItems?: SharedDayItem[]
  onToggle: (date: Date, type: EntryType) => void
  onCellPointerDown?: (dateKey: string, event: React.PointerEvent<HTMLButtonElement>) => void
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
  isDragSelected = false, suggestionPreview,
  heatmapValue, comparisonStates = [], showHeatmap, isBridgeDay, bridgeDayInfo,
  showBridgeDays, showOtherMonthDays, sharedItems = [],
  onToggle, onCellPointerDown, selectedType, onHover, onSelectDate,
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

  const hasVacation = Boolean(vacation)
  const hasGleittag = Boolean(gleittag) && !hasVacation
  const hasVacationOrGleittag = hasVacation || hasGleittag
  const hasEntry = hasVacationOrGleittag || Boolean(note)

  const isPublicHolidayRegional = Boolean(publicHoliday && !publicHoliday.nationwide)
  const hasHeatmap = showHeatmap && heatmapValue !== undefined && heatmapValue > 0
  const isVisibleBridgeDay = showBridgeDays && isBridgeDay && !publicHoliday && !suggestionPreview?.isVacationDay
  const isWeekendName = (name?: string) =>
    !name || name === 'Samstag' || name === 'Sonntag' || name === 'Wochenende' || name.endsWith('(frei)')
  const bridgeHolidayBefore = isVisibleBridgeDay && bridgeDayInfo ? !isWeekendName(bridgeDayInfo.connectsBeforeName) : false
  const bridgeHolidayAfter = isVisibleBridgeDay && bridgeDayInfo ? !isWeekendName(bridgeDayInfo.connectsAfterName) : false

  const buildTitle = (): string => {
    const parts: string[] = []
    if (suggestionPreview) {
      parts.push(`✨ Vorschlag: ${suggestionPreview.label} (${suggestionPreview.cost} UT → ${suggestionPreview.freeDaysGained} Tage frei, ${suggestionPreview.efficiency.toFixed(1)}x)`)
      parts.push('Tipp: Enden ziehen (◀/▶) zum Kürzen/Verlängern oder Mitte ziehen zum Verschieben')
    }
    if (publicHoliday) {
      const regLabel = isPublicHolidayRegional ? ' (Feiertag im eigenen Bundesland)' : ' (Gesetzlicher Feiertag)'
      parts.push(`🎉 Feiertag: ${getHolidayName(publicHoliday)}${regLabel}`)
      if (hasVacation) parts.push('⚠️ Hinweis: Urlaub an einem gesetzlichen Feiertag eingetragen!')
      if (hasGleittag) parts.push('⚠️ Hinweis: Gleittag an einem gesetzlichen Feiertag eingetragen!')
    }
    if (schoolHoliday) {
      parts.push(`🏫 Schulferien: ${getHolidayName(schoolHoliday)}`)
      if (hasVacation) parts.push('✓ Liegt in den Schulferien deines Bundeslands')
    }
    if (showBridgeDays && isBridgeDay && bridgeDayInfo) {
      const before = bridgeDayInfo.connectsBeforeName
      const after = bridgeDayInfo.connectsAfterName
      parts.push(`🌉 Brückentag → verbindet ${before} mit ${after}`)
      parts.push(`1 Tag Urlaub → ${bridgeDayInfo.freeDaysGained} Tage frei`)
    } else if (showBridgeDays && isBridgeDay) {
      parts.push('🌉 Brückentag')
    }
    if (vacation) parts.push('🌴 Urlaub')
    if (gleittag) parts.push('⏰ Gleittag')
    if (note) parts.push(`📝 Notiz: ${note.title ?? 'Notiz'}`)
    for (const s of sharedItems) {
      const tLabel =
        s.type === 'vacation'
          ? 'Urlaub'
          : s.type === 'gleittag'
            ? 'Gleittag'
            : s.type === 'off_day'
              ? `Regulär frei (${s.title || 'Arbeitszeitmodell'})`
              : s.title || 'Notiz'
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
    isPublicHolidayRegional,
    schoolHoliday: schoolHoliday ? getHolidayName(schoolHoliday) : undefined,
    isBridgeDay: showBridgeDays && isBridgeDay,
    bridgeDayInfo,
    entry: vacation ?? gleittag ?? note ?? undefined,
    noteEntry: note ?? undefined,
    sharedItems,
    suggestionPreview,
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

  const heatmapClass = !hasVacationOrGleittag && !publicHoliday && !(showBridgeDays && isBridgeDay) && hasHeatmap && !suggestionPreview?.isVacationDay
    ? getHeatmapClass(heatmapValue)
    : ''

  // Note-only without vacation/gleittag on a public holiday keeps the public holiday styling, decorated with a note marker
  const isPublicHolidayDominant = Boolean(publicHoliday && !hasVacationOrGleittag && !suggestionPreview?.isVacationDay)

  return (
    <button
      type="button"
      data-date={key}
      className={cn(
        'day-cell relative w-full aspect-square flex flex-col items-center justify-center [-webkit-user-select:none] select-none',
        'rounded-md text-sm font-medium transition-all duration-150 sm:text-xs',
        'min-h-11 sm:min-h-0',
        'hover:ring-2 hover:ring-primary/60 hover:z-10 hover:scale-105',
        'active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isOtherMonth && 'opacity-25',
        // Future vs Past clarity:
        !isPast && !isOtherMonth && !hasEntry && !publicHoliday && !schoolHoliday && !hasHeatmap && !isWeekend && !suggestionPreview && 'bg-background text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.6)] dark:bg-card/95',
        isWeekend && !hasEntry && !publicHoliday && !hasHeatmap && !suggestionPreview?.isVacationDay && 'bg-muted/70 text-muted-foreground',
        isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background z-10',
        // Past days are distinctly dimmed across all states so past vs future is unmistakable:
        isPast && !hasEntry && !publicHoliday && !schoolHoliday && !isBridgeDay && !hasHeatmap && !suggestionPreview && 'opacity-35 bg-muted/40 text-muted-foreground saturate-50',
        isPast && (hasEntry || publicHoliday || schoolHoliday || isBridgeDay || hasHeatmap) && !suggestionPreview && 'opacity-50 saturate-[0.65]',

        // Primary entries:
        vacation && !isOverBudget && 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs',
        vacation && isOverBudget && 'bg-red-600 text-white hover:bg-red-700 shadow-2xs',
        hasGleittag && 'bg-purple-600 text-white hover:bg-purple-700 shadow-2xs',
        // Standalone note on a normal day (not on a public holiday)
        note && !hasVacationOrGleittag && !publicHoliday && 'bg-slate-500 text-white hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500',

        // Public Holiday in own Bundesland (empty or with standalone note):
        // Fine white/light frame (ring-1 ring-inset ring-emerald-700/50 dark:ring-white/80)
        isPublicHolidayDominant && [
          'bg-emerald-100 text-emerald-900 border border-emerald-300/90 dark:bg-emerald-500/35 dark:text-emerald-100 dark:border-emerald-500/60',
          'ring-1 ring-inset ring-emerald-700/50 dark:ring-white/80 font-semibold',
          isPublicHolidayRegional && 'border-b-2 border-b-emerald-600 dark:border-b-white/90',
        ],

        // When vacation or gleittag is booked on a Feiertag:
        // Preserve the requested fine white frame right on top of the vacation/gleittag color
        publicHoliday && hasVacationOrGleittag && [
          'ring-2 ring-inset ring-white dark:ring-white shadow-[inset_0_0_0_1px_rgba(16,185,129,0.9)] font-semibold',
          isPublicHolidayRegional && 'border-b-2 border-b-emerald-300 dark:border-b-emerald-300',
        ],

        // Heatmap background (when no dominant public holiday and no vacation/gleittag):
        heatmapClass,

        // Own School Holiday when Heatmap is OFF:
        schoolHoliday && !showHeatmap && !hasVacationOrGleittag && !publicHoliday && !suggestionPreview?.isVacationDay && [
          'bg-amber-100/85 text-amber-950 dark:bg-amber-400/20 dark:text-amber-100',
          'border-b-2 border-b-amber-400 dark:border-b-amber-400/80',
        ],
        // Own School Holiday when Heatmap is ON (fine inner white/foreground frame + bottom accent):
        schoolHoliday && showHeatmap && !hasVacationOrGleittag && !publicHoliday && !suggestionPreview?.isVacationDay && [
          'ring-1 ring-inset ring-foreground/45 border-b-2 border-b-foreground/65 dark:ring-white/60 dark:border-b-white/75 font-semibold',
        ],

        // School holiday visual retention when vacation/gleittag or note is planned:
        // A distinct amber bottom underline ensures the user still sees that this planned period is inside school holidays
        schoolHoliday && hasEntry && 'border-b-[3px] border-b-amber-300 dark:border-b-amber-400 rounded-b-md',

        // Bridge day with directional edge toward the referenced holiday:
        isVisibleBridgeDay && !hasVacationOrGleittag && 'ring-1 ring-inset ring-orange-400/90 bg-orange-50/95 text-orange-950 dark:bg-orange-500/20 dark:text-orange-100 dark:ring-orange-400/70',
        bridgeHolidayBefore && !bridgeHolidayAfter && !hasVacationOrGleittag && 'border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400',
        bridgeHolidayAfter && !bridgeHolidayBefore && !hasVacationOrGleittag && 'border-r-[3px] border-r-emerald-500 dark:border-r-emerald-400',
        bridgeHolidayBefore && bridgeHolidayAfter && !hasVacationOrGleittag && 'border-x-[3px] border-x-emerald-500 dark:border-x-emerald-400',

        // Interactive Suggestion Preview Overlay on the Calendar:
        suggestionPreview && !suggestionPreview.isVacationDay && 'ring-1 ring-inset ring-teal-500/60 bg-teal-500/15 dark:bg-teal-400/20',
        suggestionPreview?.isVacationDay && 'bg-teal-600 text-white hover:bg-teal-500 shadow-sm cursor-grab active:cursor-grabbing z-10',
        suggestionPreview?.isVacationDay && suggestionPreview.isSelectedBlock && 'ring-2 ring-teal-300 dark:ring-teal-200 scale-[1.03]',

        // Drag-to-Select Highlight:
        isDragSelected && selectedType === 'vacation' && 'ring-2 ring-blue-500 bg-blue-500/35 text-blue-950 dark:text-white z-20 scale-105',
        isDragSelected && selectedType === 'gleittag' && 'ring-2 ring-purple-500 bg-purple-500/35 text-purple-950 dark:text-white z-20 scale-105',
        isDragSelected && selectedType === 'note' && 'ring-2 ring-slate-500 bg-slate-500/35 text-slate-950 dark:text-white z-20 scale-105',
      )}
      onPointerDown={e => onCellPointerDown?.(key, e)}
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
          {sharedItems.slice(0, 3).map((s, idx) =>
            s.type === 'off_day' ? (
              <span
                key={idx}
                className="h-1 flex-1 max-w-3.5 border-t-2 border-dashed opacity-85"
                style={{ borderColor: s.color }}
              />
            ) : (
              <span
                key={idx}
                className="h-1.5 flex-1 max-w-3.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
            )
          )}
        </div>
      )}

      {/* Note indicator icon on top-left: visible even if placed on a Feiertag or Vacation day */}
      {note && (
        <span
          className="absolute top-1 left-1 pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
          title={`Notiz: ${note.title ?? 'Notiz'}`}
          aria-hidden="true"
        >
          <StickyNote className="h-3.5 w-3.5 text-amber-300 fill-amber-400/50 dark:text-amber-200 dark:fill-amber-300/50" />
        </span>
      )}

      {/* Feiertags-Indikator oben rechts: wenn an diesem Tag Urlaub oder Gleittag geplant ist,
          bleibt der Feiertag durch diesen leuchtenden Smaragd-Punkt (bzw. Stern bei regionalem Feiertag) sofort erkennbar */}
      {publicHoliday && hasVacationOrGleittag && (
        <span
          className={cn(
            'absolute top-1 right-1 flex items-center justify-center rounded-full bg-emerald-400 text-emerald-950 ring-1.5 ring-white dark:ring-slate-900 shadow-xs pointer-events-none',
            isPublicHolidayRegional ? 'w-2.5 h-2.5 text-[7px] font-extrabold' : 'w-2 h-2'
          )}
          title={
            isPublicHolidayRegional
              ? `Regionaler Feiertag in deinem Bundesland: ${getHolidayName(publicHoliday)}`
              : `Gesetzlicher Feiertag: ${getHolidayName(publicHoliday)}`
          }
          aria-hidden="true"
        >
          {isPublicHolidayRegional ? '★' : ''}
        </span>
      )}

      {/* Brückentag-Punkt bei geplantem Urlaub/Gleittag */}
      {isVisibleBridgeDay && hasVacationOrGleittag && (
        <span
          className="absolute bottom-1 left-1.5 w-1.5 h-1.5 rounded-full bg-orange-300 ring-1 ring-white dark:ring-slate-900 pointer-events-none"
          title="Brückentag"
          aria-hidden="true"
        />
      )}

      {/* Draggable left/right handles for interactive suggestion blocks on the calendar */}
      {suggestionPreview?.isVacationDay && suggestionPreview.isFirstVacationDay && (
        <span
          data-suggestion-handle="resize-start"
          title="Anfang ziehen zum Verlängern/Verkürzen"
          className="absolute left-0 inset-y-0 w-2.5 flex items-center justify-center bg-teal-900/45 hover:bg-teal-900/75 text-[7px] font-bold text-white cursor-ew-resize rounded-l-md"
        >
          ◀
        </span>
      )}
      {suggestionPreview?.isVacationDay && suggestionPreview.isLastVacationDay && (
        <span
          data-suggestion-handle="resize-end"
          title="Ende ziehen zum Verlängern/Verkürzen"
          className="absolute right-0 inset-y-0 w-2.5 flex items-center justify-center bg-teal-900/45 hover:bg-teal-900/75 text-[7px] font-bold text-white cursor-ew-resize rounded-r-md"
        >
          ▶
        </span>
      )}

      <span className={cn('leading-none pointer-events-none', isToday && !hasVacationOrGleittag && !suggestionPreview?.isVacationDay && 'text-primary font-extrabold underline decoration-2 underline-offset-2')}>
        {format(date, 'd')}
      </span>

      {/* Directional arrow on potential bridge days indicating which holiday it connects to */}
      {isVisibleBridgeDay && !hasVacationOrGleittag && (
        <span
          aria-hidden="true"
          className="mt-0.5 text-[9px] leading-none font-bold text-orange-600 dark:text-orange-300 tracking-tighter pointer-events-none"
        >
          {bridgeHolidayBefore && bridgeHolidayAfter
            ? '↔'
            : bridgeHolidayBefore
              ? '←'
              : bridgeHolidayAfter
                ? '→'
                : '•'}
        </span>
      )}
    </button>
  )
}
