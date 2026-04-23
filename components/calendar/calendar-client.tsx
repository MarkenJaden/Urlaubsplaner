'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Toolbar } from '@/components/calendar/toolbar'
import { YearView } from '@/components/calendar/year-view'
import { SuggestionsPanel } from '@/components/calendar/suggestions-panel'
import { useVacations, useToggleVacation } from '@/hooks/use-vacations'
import { useHolidays, useCompareHolidays } from '@/hooks/use-holidays'
import { detectBridgeDays } from '@/lib/bridge-days'
import { parseISO, isSameDay, format, eachDayOfInterval, isWeekend } from 'date-fns'
import type { EntryType, VacationEntry, Holiday } from '@/types'
import type { DayInfo } from '@/components/calendar/day-cell'
import type { ImportData } from '@/lib/export'

interface CalendarClientProps {
  userId?: string
  preferences: Record<string, unknown>
  isLoggedIn: boolean
}

const LOCAL_STORAGE_KEY = 'urlaubsplaner_local_entries'

function loadLocalEntries(): VacationEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveLocalEntries(entries: VacationEntry[]) {
  if (typeof window !== 'undefined')
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries))
}

function countWorkDays(year: number, entries: VacationEntry[], publicHolidays: Holiday[]): number {
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)
  const today = new Date()
  const calcStart = today > start && today.getFullYear() === year ? today : start
  if (calcStart.getFullYear() > year) return 0

  const holidaySet = new Set<string>()
  for (const h of publicHolidays) {
    try {
      const days = eachDayOfInterval({ start: parseISO(h.startDate), end: parseISO(h.endDate) })
      for (const d of days) holidaySet.add(format(d, 'yyyy-MM-dd'))
    } catch {}
  }
  const entrySet = new Set(entries.map(e => e.date.split('T')[0]))

  let count = 0
  const all = eachDayOfInterval({ start: calcStart, end })
  for (const d of all) {
    const key = format(d, 'yyyy-MM-dd')
    if (isWeekend(d) || holidaySet.has(key) || entrySet.has(key)) continue
    count++
  }
  return count
}

export function CalendarClient({ userId, preferences, isLoggedIn }: CalendarClientProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [selectedType, setSelectedType] = useState<EntryType>('vacation')
  const [showHeatmap, setShowHeatmap] = useState((preferences?.showHeatmap as boolean) ?? false)
  const [showPublicHolidays, setShowPublicHolidays] = useState((preferences?.showPublicHolidays as boolean) ?? true)
  const [showSchoolHolidays, setShowSchoolHolidays] = useState((preferences?.showSchoolHolidays as boolean) ?? true)
  const [showBridgeDays, setShowBridgeDays] = useState(true)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [hoveredDay, setHoveredDay] = useState<DayInfo | null>(null)
  const [localEntries, setLocalEntries] = useState<VacationEntry[]>([])

  useEffect(() => { if (!isLoggedIn) setLocalEntries(loadLocalEntries()) }, [isLoggedIn])

  const subdivision = preferences?.subdivision as string | undefined
  const country = (preferences?.country as string) ?? 'DE'
  const vacationDaysTotal = (preferences?.vacationDays as number) ?? 30
  const compareSubdivisions = (preferences?.compareSubdivisions as string[]) ?? []

  const { data: serverEntries = [], isLoading: entriesLoading } = useVacations(year, isLoggedIn)
  const { addMutation, removeMutation } = useToggleVacation(year, isLoggedIn)

  const entries = isLoggedIn ? serverEntries : localEntries.filter(e => new Date(e.date).getFullYear() === year)

  const { data: publicHolidays = [] } = useHolidays({ country, subdivision, year, type: 'public', enabled: showPublicHolidays })
  const { data: schoolHolidays = [] } = useHolidays({ country, subdivision, year, type: 'school', enabled: showSchoolHolidays })

  const compareHolidays = useCompareHolidays(country, compareSubdivisions, year, showHeatmap)

  const bridgeDaySet = useMemo(() => {
    if (!showBridgeDays || publicHolidays.length === 0) return new Set<string>()
    const bdays = detectBridgeDays(year, publicHolidays)
    return new Set(bdays.map(b => b.date))
  }, [year, publicHolidays, showBridgeDays])

  const vacationDaysUsed = entries.filter(e => e.type === 'vacation').length
  const gleittageCount = entries.filter(e => e.type === 'gleittag').length
  const remainingWorkDays = countWorkDays(year, entries, publicHolidays)

  const handleToggle = useCallback((date: Date, type: EntryType) => {
    if (isLoggedIn) {
      const dateStr = date.toISOString().split('T')[0] + 'T00:00:00.000Z'
      const existing = serverEntries.find(e => e.type === type && isSameDay(parseISO(e.date), date))
      if (existing) { removeMutation.mutate(existing.id) }
      else {
        let title: string | undefined
        if (type === 'note') { title = prompt('Notiz-Text (optional):') ?? undefined }
        addMutation.mutate({ date: dateStr, type, title })
      }
    } else {
      const dateStr = format(date, 'yyyy-MM-dd') + 'T00:00:00.000Z'
      const existing = localEntries.find(e => e.type === type && isSameDay(parseISO(e.date), date))
      let updated: VacationEntry[]
      if (existing) {
        updated = localEntries.filter(e => e.id !== existing.id)
      } else {
        let title: string | undefined
        if (type === 'note') { title = prompt('Notiz-Text (optional):') ?? undefined }
        updated = [...localEntries, {
          id: `local_${Date.now()}`, date: dateStr, type, title,
          userId: 'local', year: date.getFullYear(),
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }]
      }
      setLocalEntries(updated)
      saveLocalEntries(updated)
    }
  }, [isLoggedIn, serverEntries, localEntries, addMutation, removeMutation])

  const handleApplySuggestions = (dates: string[], type: EntryType) => {
    for (const dateStr of dates) handleToggle(parseISO(dateStr), type)
  }

  const handleImport = (data: ImportData) => {
    for (const v of data.vacations) {
      const date = parseISO(v.date.includes('T') ? v.date : v.date + 'T00:00:00.000Z')
      const type = (['vacation', 'gleittag', 'note'].includes(v.type) ? v.type : 'vacation') as EntryType
      handleToggle(date, type)
    }
  }

  const existingVacationDates = entries.filter(e => e.type === 'vacation').map(e => e.date.split('T')[0])
  const existingNoteDates = entries.filter(e => e.type === 'note').map(e => e.date.split('T')[0])

  return (
    <div className="min-h-screen bg-background">
      <Header isLoggedIn={isLoggedIn} />
      <SuggestionsPanel
        open={showSuggestions} onClose={() => setShowSuggestions(false)}
        year={year} country={country} subdivision={subdivision}
        remainingDays={vacationDaysTotal - vacationDaysUsed}
        existingVacationDates={existingVacationDates}
        noteDates={existingNoteDates}
        onApply={handleApplySuggestions}
      />
      <main className="container py-4 space-y-4">
        {!isLoggedIn && (
          <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
            💡 Du planst gerade lokal.{' '}
            <a href="/login" className="underline font-medium">Anmelden</a> um zu speichern und synchronisieren.
          </div>
        )}

        <Toolbar
          year={year} onYearChange={setYear}
          selectedType={selectedType} onTypeChange={setSelectedType}
          showHeatmap={showHeatmap} onToggleHeatmap={setShowHeatmap}
          showPublicHolidays={showPublicHolidays} onTogglePublicHolidays={setShowPublicHolidays}
          showSchoolHolidays={showSchoolHolidays} onToggleSchoolHolidays={setShowSchoolHolidays}
          showBridgeDays={showBridgeDays} onToggleBridgeDays={setShowBridgeDays}
          vacationDaysUsed={vacationDaysUsed} vacationDaysTotal={vacationDaysTotal}
          gleittageCount={gleittageCount} remainingWorkDays={remainingWorkDays}
          entries={entries} preferences={preferences}
          onOpenSuggestions={() => setShowSuggestions(true)}
          onImport={handleImport}
        />

        {entriesLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <YearView
            year={year} entries={entries}
            publicHolidays={publicHolidays} schoolHolidays={schoolHolidays}
            compareHolidays={compareHolidays}
            showHeatmap={showHeatmap} showPublicHolidays={showPublicHolidays} showSchoolHolidays={showSchoolHolidays}
            bridgeDaySet={bridgeDaySet} showBridgeDays={showBridgeDays}
            onToggle={handleToggle} selectedType={selectedType}
            onHover={setHoveredDay}
          />
        )}

        {/* Hover Info Panel */}
        {hoveredDay && (
          <div className="fixed bottom-4 right-4 z-50 bg-card border rounded-lg shadow-lg p-3 text-sm max-w-xs">
            <p className="font-medium">{format(hoveredDay.date, 'dd.MM.yyyy (EEEE)')}</p>
            {hoveredDay.publicHoliday && <p className="text-green-600">🎉 {hoveredDay.publicHoliday}</p>}
            {hoveredDay.schoolHoliday && <p className="text-yellow-600">🏫 {hoveredDay.schoolHoliday}</p>}
            {hoveredDay.isBridgeDay && <p className="text-orange-500">🌉 Brückentag</p>}
            {hoveredDay.entry && (
              <p className="text-blue-500">
                {hoveredDay.entry.type === 'vacation' ? '🏖️ Urlaub' :
                 hoveredDay.entry.type === 'gleittag' ? '⏰ Gleittag' :
                 `📝 ${hoveredDay.entry.title ?? 'Notiz'}`}
              </p>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Urlaub</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500" /> Gleittag</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" /> Feiertag</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300" /> Schulferien</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-50 ring-2 ring-orange-400" /> Brückentag</span>
        </div>
      </main>
    </div>
  )
}
