'use client'

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { eachDayOfInterval, parseISO, format } from 'date-fns'
import { MonthGrid } from './month-grid'
import type { DayInfo, SharedDayItem, SuggestionPreviewDayInfo } from './day-cell'
import type { VacationEntry, Holiday, EntryType, SharedPlanOverlay } from '@/types'
import type { BridgeDay } from '@/lib/bridge-days'
import type { VacationSuggestionBlock } from '@/lib/vacation-suggester'
import { countHolidayStates } from '@/lib/holidays'
import { DEFAULT_WORK_DAYS, formatWorkDaysLabel, isOffDayKey } from '@/lib/vacation-accounting'

interface YearViewProps {
  year: number
  entries: VacationEntry[]
  publicHolidays: Holiday[]
  schoolHolidays: Holiday[]
  workDays?: number[]
  compareHolidays?: Holiday[][]
  compareLabels?: string[]
  overlays?: SharedPlanOverlay[]
  previewSuggestions?: VacationSuggestionBlock[]
  selectedPreviewIndex?: number
  onSelectPreviewBlock?: (index: number) => void
  onDragPreviewBlock?: (
    index: number,
    mode: 'move' | 'resize-start' | 'resize-end',
    targetDateKey: string,
    anchorDateKey: string,
  ) => void
  showHeatmap: boolean
  showPublicHolidays: boolean
  showSchoolHolidays: boolean
  bridgeDaySet: Set<string>
  bridgeDayMap: Map<string, BridgeDay>
  showBridgeDays: boolean
  showOtherMonthDays: boolean
  overBudgetDates: Set<string>
  onToggle: (date: Date, type: EntryType) => void
  onSelectRange?: (startDateKey: string, endDateKey: string, type: EntryType) => void
  selectedType: EntryType
  onHover?: (info: DayInfo | null) => void
  onSelectDate?: (date: Date) => void
}

function buildRangeSet(a: string | null, b: string | null): Set<string> {
  if (!a || !b) return new Set()
  const start = parseISO(a < b ? a : b)
  const end = parseISO(a < b ? b : a)
  if (start > end) return new Set()
  return new Set(eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd')))
}

export function YearView({
  year, entries, publicHolidays, schoolHolidays,
  workDays = DEFAULT_WORK_DAYS,
  compareHolidays = [], compareLabels = [], overlays = [],
  previewSuggestions = [], selectedPreviewIndex = 0,
  onSelectPreviewBlock, onDragPreviewBlock,
  showHeatmap, showPublicHolidays,
  showSchoolHolidays, bridgeDaySet, bridgeDayMap,
  showBridgeDays, showOtherMonthDays, overBudgetDates,
  onToggle, onSelectRange, selectedType, onHover, onSelectDate,
}: YearViewProps) {
  const [dragStartKey, setDragStartKey] = useState<string | null>(null)
  const [dragCurrentKey, setDragCurrentKey] = useState<string | null>(null)
  const [isDraggingRange, setIsDraggingRange] = useState(false)

  const lastClickedKeyRef = useRef<string | null>(null)
  const suppressNextClickRef = useRef(false)
  const suggestionDragRef = useRef<{
    blockIndex: number
    mode: 'move' | 'resize-start' | 'resize-end'
    anchorDateKey: string
    lastTargetKey: string
    hasMoved: boolean
  } | null>(null)
  const rangeDragRef = useRef<{
    startKey: string
    currentKey: string
    hasMoved: boolean
  } | null>(null)

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

  const sharedByDate = useMemo(() => {
    const map = new Map<string, SharedDayItem[]>()
    const yearDays = eachDayOfInterval({
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31),
    }).map(d => format(d, 'yyyy-MM-dd'))

    for (const ov of overlays) {
      if (!ov.enabled) continue
      const entryDateSet = new Set<string>()
      for (const e of ov.entries) {
        const key = e.date.slice(0, 10)
        entryDateSet.add(key)
        const list = map.get(key) ?? []
        list.push({ label: ov.label, color: ov.color, type: e.type, title: e.title })
        map.set(key, list)
      }

      const ovWorkDays = ov.workDays && ov.workDays.length > 0 ? ov.workDays : DEFAULT_WORK_DAYS
      const ovLabel = formatWorkDaysLabel(ovWorkDays)
      const differsFromViewer =
        ovWorkDays.length !== workDays.length ||
        ovWorkDays.some(d => !workDays.includes(d))

      if (differsFromViewer) {
        for (const key of yearDays) {
          if (entryDateSet.has(key)) continue
          // Highlight days where the partner has a regular off-weekday (e.g. Friday in a 4-day week) while the viewer works
          if (isOffDayKey(key, ovWorkDays) && !isOffDayKey(key, workDays)) {
            const list = map.get(key) ?? []
            list.push({
              label: ov.label,
              color: ov.color,
              type: 'off_day',
              title: ovLabel,
            })
            map.set(key, list)
          }
        }
      }
    }
    return map
  }, [overlays, year, workDays])

  const suggestionPreviewByDate = useMemo(() => {
    const map = new Map<string, SuggestionPreviewDayInfo>()
    for (let idx = 0; idx < previewSuggestions.length; idx++) {
      const block = previewSuggestions[idx]
      const vacSet = new Set(block.vacationDays)
      const firstVac = block.vacationDays[0]
      const lastVac = block.vacationDays[block.vacationDays.length - 1]
      if (block.startDate && block.endDate && block.startDate <= block.endDate) {
        const spanDays = eachDayOfInterval({
          start: parseISO(block.startDate),
          end: parseISO(block.endDate),
        })
        for (const d of spanDays) {
          const k = format(d, 'yyyy-MM-dd')
          const isVac = vacSet.has(k)
          // Vacation days take precedence over non-work span days
          if (!map.has(k) || isVac) {
            map.set(k, {
              blockIndex: idx,
              label: block.label,
              isVacationDay: isVac,
              isFirstVacationDay: k === firstVac,
              isLastVacationDay: k === lastVac,
              isSelectedBlock: idx === selectedPreviewIndex,
              cost: block.cost,
              freeDaysGained: block.freeDaysGained,
              efficiency: block.efficiency,
            })
          }
        }
      }
    }
    return map
  }, [previewSuggestions, selectedPreviewIndex])

  const dragSelectedDates = useMemo(
    () => (isDraggingRange ? buildRangeSet(dragStartKey, dragCurrentKey) : undefined),
    [isDraggingRange, dragStartKey, dragCurrentKey],
  )

  const handleCellPointerDown = useCallback(
    (dateKey: string, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return

      const preview = suggestionPreviewByDate.get(dateKey)
      if (preview?.isVacationDay && onDragPreviewBlock) {
        const targetEl = event.target as HTMLElement | null
        const handleAttr = targetEl?.closest('[data-suggestion-handle]')?.getAttribute('data-suggestion-handle')
        const mode: 'move' | 'resize-start' | 'resize-end' =
          handleAttr === 'resize-start'
            ? 'resize-start'
            : handleAttr === 'resize-end'
              ? 'resize-end'
              : 'move'

        onSelectPreviewBlock?.(preview.blockIndex)
        suggestionDragRef.current = {
          blockIndex: preview.blockIndex,
          mode,
          anchorDateKey: dateKey,
          lastTargetKey: dateKey,
          hasMoved: false,
        }
        return
      }

      // Shift + Click selects range from last clicked date to current date
      if (event.shiftKey && lastClickedKeyRef.current && onSelectRange) {
        suppressNextClickRef.current = true
        onSelectRange(lastClickedKeyRef.current, dateKey, selectedType)
        lastClickedKeyRef.current = dateKey
        return
      }

      rangeDragRef.current = {
        startKey: dateKey,
        currentKey: dateKey,
        hasMoved: false,
      }
      setDragStartKey(dateKey)
      setDragCurrentKey(dateKey)
      setIsDraggingRange(false)
    },
    [suggestionPreviewByDate, onDragPreviewBlock, onSelectPreviewBlock, onSelectRange, selectedType],
  )

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!suggestionDragRef.current && !rangeDragRef.current) return
      const el = document.elementFromPoint(event.clientX, event.clientY)
      const cell = el?.closest('[data-date]') as HTMLElement | null
      const targetKey = cell?.getAttribute('data-date')
      if (!targetKey) return

      if (suggestionDragRef.current) {
        const state = suggestionDragRef.current
        if (targetKey !== state.lastTargetKey) {
          state.hasMoved = true
          state.lastTargetKey = targetKey
          onDragPreviewBlock?.(state.blockIndex, state.mode, targetKey, state.anchorDateKey)
          if (state.mode === 'move') {
            state.anchorDateKey = targetKey
          }
        }
        return
      }

      if (rangeDragRef.current) {
        const state = rangeDragRef.current
        if (targetKey !== state.currentKey) {
          state.currentKey = targetKey
          if (targetKey !== state.startKey) {
            state.hasMoved = true
            setIsDraggingRange(true)
          }
          setDragCurrentKey(targetKey)
        }
      }
    }

    const onPointerUpOrCancel = () => {
      if (suggestionDragRef.current) {
        suppressNextClickRef.current = true
        suggestionDragRef.current = null
      }
      if (rangeDragRef.current) {
        const state = rangeDragRef.current
        rangeDragRef.current = null
        if (state.hasMoved && state.startKey !== state.currentKey && onSelectRange) {
          suppressNextClickRef.current = true
          onSelectRange(state.startKey, state.currentKey, selectedType)
          lastClickedKeyRef.current = state.currentKey
        }
        setIsDraggingRange(false)
        setDragStartKey(null)
        setDragCurrentKey(null)
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUpOrCancel)
    document.addEventListener('pointercancel', onPointerUpOrCancel)
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUpOrCancel)
      document.removeEventListener('pointercancel', onPointerUpOrCancel)
    }
  }, [onDragPreviewBlock, onSelectRange, selectedType])

  const handleCellToggle = useCallback(
    (date: Date, type: EntryType) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false
        return
      }
      const key = format(date, 'yyyy-MM-dd')
      const preview = suggestionPreviewByDate.get(key)
      if (preview?.isVacationDay && onSelectPreviewBlock) {
        onSelectPreviewBlock(preview.blockIndex)
        return
      }
      lastClickedKeyRef.current = key
      onToggle(date, type)
    },
    [suggestionPreviewByDate, onSelectPreviewBlock, onToggle],
  )

  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1))

  return (
    <div className="relative">
      {isDraggingRange && dragSelectedDates && dragSelectedDates.size > 1 && (
        <div
          role="status"
          className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-full border bg-card/95 px-4 py-1.5 text-xs font-semibold shadow-lg backdrop-blur"
        >
          {dragSelectedDates.size} Tage ausgewählt ({selectedType === 'vacation' ? '🌴 Urlaub' : selectedType === 'gleittag' ? '⏰ Gleittag' : '📝 Notiz / Event'}) – Loslassen zum Anwenden
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {months.map(monthDate => (
          <MonthGrid
            key={monthDate.toISOString()}
            date={monthDate}
            entries={entries}
            publicHolidays={showPublicHolidays ? publicHolidays : []}
            schoolHolidays={showSchoolHolidays ? schoolHolidays : []}
            workDays={workDays}
            heatmapData={heatmapData}
            comparisonByDate={comparisonByDate}
            sharedByDate={sharedByDate}
            suggestionPreviewByDate={suggestionPreviewByDate}
            dragSelectedDates={dragSelectedDates}
            showHeatmap={showHeatmap}
            bridgeDaySet={bridgeDaySet}
            bridgeDayMap={bridgeDayMap}
            showBridgeDays={showBridgeDays}
            showOtherMonthDays={showOtherMonthDays}
            overBudgetDates={overBudgetDates}
            onToggle={handleCellToggle}
            onCellPointerDown={handleCellPointerDown}
            selectedType={selectedType}
            onHover={onHover}
            onSelectDate={onSelectDate}
          />
        ))}
      </div>
    </div>
  )
}
