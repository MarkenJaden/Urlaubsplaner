'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Toolbar } from '@/components/calendar/toolbar'
import { YearView } from '@/components/calendar/year-view'
import { SettingsPanel } from '@/components/calendar/settings-panel'
import { SuggestionsPanel } from '@/components/calendar/suggestions-panel'
import { useVacations, useToggleVacation } from '@/hooks/use-vacations'
import { useHolidays, useCompareHolidays, useSubdivisions, useCountries, useCountryHolidays } from '@/hooks/use-holidays'
import { detectBridgeDays } from '@/lib/bridge-days'
import { loadConfig, saveConfig, configToEntries } from '@/lib/config'
import { parseISO, isSameDay, format, eachDayOfInterval, isWeekend } from 'date-fns'
import type { EntryType, VacationEntry, Holiday, LocalConfig } from '@/types'
import type { DayInfo } from '@/components/calendar/day-cell'
import type { ImportData } from '@/lib/export'

interface CalendarClientProps {
  userId?: string
  preferences: Record<string, unknown>
  isLoggedIn: boolean
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

function computeOverBudget(
  entries: VacationEntry[],
  publicHolidays: Holiday[],
  totalDays: number,
  halfDaysChristmas: boolean,
): Set<string> {
  const result = new Set<string>()
  const holidaySet = new Set<string>()
  for (const h of publicHolidays) {
    try {
      const days = eachDayOfInterval({ start: parseISO(h.startDate), end: parseISO(h.endDate) })
      for (const d of days) holidaySet.add(format(d, 'yyyy-MM-dd'))
    } catch {}
  }

  const vacDays = entries
    .filter(e => e.type === 'vacation')
    .sort((a, b) => a.date.localeCompare(b.date))

  let cost = 0
  for (const e of vacDays) {
    const dateStr = e.date.split('T')[0]
    const d = parseISO(e.date)
    if (isWeekend(d) || holidaySet.has(dateStr)) continue
    const isHalf = halfDaysChristmas && d.getMonth() === 11 && (d.getDate() === 24 || d.getDate() === 31)
    cost += isHalf ? 0.5 : 1
    if (cost > totalDays) result.add(dateStr)
  }
  return result
}

export function CalendarClient({ userId, preferences: serverPrefs, isLoggedIn }: CalendarClientProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [selectedType, setSelectedType] = useState<EntryType>('vacation')
  const [config, setConfig] = useState<LocalConfig | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [hoveredDay, setHoveredDay] = useState<DayInfo | null>(null)
  const [defaultNoteText, setDefaultNoteText] = useState('')

  useEffect(() => { if (!isLoggedIn) setConfig(loadConfig()) }, [isLoggedIn])

  const subdivision = isLoggedIn ? (serverPrefs?.subdivision as string) : config?.subdivision
  const country = 'DE'
  const compareSubdivisions = isLoggedIn
    ? ((serverPrefs?.compareSubdivisions as string[]) ?? [])
    : (config?.compareSubdivisions ?? [])
  const selectedCountries = (config?.selectedCountries as string[] | undefined) ?? []
  const showHeatmap = isLoggedIn ? ((serverPrefs?.showHeatmap as boolean) ?? false) : (config?.showHeatmap ?? false)
  const showPublicHolidays = isLoggedIn ? ((serverPrefs?.showPublicHolidays as boolean) ?? true) : (config?.showPublicHolidays ?? true)
  const showSchoolHolidays = isLoggedIn ? ((serverPrefs?.showSchoolHolidays as boolean) ?? true) : (config?.showSchoolHolidays ?? true)
  const showBridgeDays = config?.showBridgeDays ?? true
  const halfDaysChristmas = config?.halfDaysChristmas ?? true
  const countWeekendsAsVacation = config?.countWeekendsAsVacation ?? false
  const vacationDaysTotal = isLoggedIn
    ? ((serverPrefs?.vacationDays as number) ?? 30)
    : (config?.vacationDaysPerYear?.[year] ?? 30)

  const { data: subdivisionsData = [] } = useSubdivisions(country)
  const { data: countriesData = [] } = useCountries()
  const { data: serverEntries = [], isLoading: entriesLoading } = useVacations(year, isLoggedIn)
  const { addMutation, removeMutation } = useToggleVacation(year, isLoggedIn)

  const entries = isLoggedIn ? serverEntries : (config ? configToEntries(config, year) : [])

  const { data: publicHolidays = [], isError: holidaysError, refetch: refetchHolidays } = useHolidays({
    country, subdivision, year, type: 'public', enabled: showPublicHolidays && !!subdivision,
  })
  const { data: schoolHolidays = [] } = useHolidays({
    country, subdivision, year, type: 'school', enabled: showSchoolHolidays && !!subdivision,
  })
  const compareHolidays = useCompareHolidays(country, compareSubdivisions, year, showHeatmap)
  const countryHolidayArrays = useCountryHolidays(selectedCountries, year, selectedCountries.length > 0)

  const allCountryHolidays = useMemo(() => countryHolidayArrays.flat(), [countryHolidayArrays])

  const bridgeDaySet = useMemo(() => {
    if (!showBridgeDays || publicHolidays.length === 0) return new Set<string>()
    const bdays = detectBridgeDays(year, publicHolidays)
    return new Set(bdays.map(b => b.date))
  }, [year, publicHolidays, showBridgeDays])

  const overBudgetDates = useMemo(
    () => computeOverBudget(entries, publicHolidays, vacationDaysTotal, halfDaysChristmas),
    [entries, publicHolidays, vacationDaysTotal, halfDaysChristmas]
  )

  const vacationDaysUsed = entries.filter(e => e.type === 'vacation').length
  const gleittageCount = entries.filter(e => e.type === 'gleittag').length
  const remainingWorkDays = countWorkDays(year, entries, publicHolidays)

  const updateConfig = useCallback((patch: Partial<LocalConfig>) => {
    if (isLoggedIn) return
    setConfig(prev => {
      const next = { ...(prev ?? loadConfig()), ...patch } as LocalConfig
      saveConfig(next)
      return next
    })
  }, [isLoggedIn])

  const handleToggle = useCallback((date: Date, type: EntryType) => {
    if (isLoggedIn) {
      const dateStr = date.toISOString().split('T')[0] + 'T00:00:00.000Z'
      const existing = serverEntries.find(e => e.type === type && isSameDay(parseISO(e.date), date))
      if (existing) { removeMutation.mutate(existing.id) }
      else {
        let title: string | undefined
        if (type === 'note') { title = defaultNoteText || prompt('Notiz-Text (optional):') || undefined }
        addMutation.mutate({ date: dateStr, type, title })
      }
    } else {
      if (!config) return
      const dateStr = format(date, 'yyyy-MM-dd')
      const existing = config.entries.findIndex(e => e.type === type && e.date === dateStr)
      let newEntries: LocalConfig['entries']
      if (existing >= 0) {
        newEntries = config.entries.filter((_, i) => i !== existing)
      } else {
        let title: string | undefined
        if (type === 'note') { title = defaultNoteText || prompt('Notiz-Text (optional):') || undefined }
        newEntries = [...config.entries, { date: dateStr, type, title }]
      }
      updateConfig({ entries: newEntries })
    }
  }, [isLoggedIn, serverEntries, config, addMutation, removeMutation, updateConfig, defaultNoteText])

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

  const handleImportConfig = (data: Record<string, unknown>) => {
    const merged = { ...(config ?? loadConfig()), ...data } as LocalConfig
    saveConfig(merged)
    setConfig(merged)
  }

  const handleReset = () => {
    if (isLoggedIn) {
      for (const e of serverEntries) removeMutation.mutate(e.id)
    } else {
      updateConfig({ entries: [] })
    }
  }

  const handleRetryApi = () => { refetchHolidays() }

  const existingVacationDates = entries.filter(e => e.type === 'vacation').map(e => e.date.split('T')[0])
  const existingNoteDates = entries.filter(e => e.type === 'note').map(e => e.date.split('T')[0])

  const combinedPublicHolidays = useMemo(() => {
    if (allCountryHolidays.length === 0) return publicHolidays
    const merged = [...publicHolidays]
    for (const h of allCountryHolidays) {
      if (!merged.some(m => m.id === h.id)) merged.push(h)
    }
    return merged
  }, [publicHolidays, allCountryHolidays])

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
            \ud83d\udca1 Du planst gerade lokal.{' '}
            <a href="/login" className="underline font-medium">Anmelden</a> um zu speichern und synchronisieren.
          </div>
        )}

        <SettingsPanel
          subdivisions={subdivisionsData}
          subdivision={subdivision}
          onSubdivisionChange={(code) => updateConfig({ subdivision: code })}
          compareSubdivisions={compareSubdivisions}
          onCompareChange={(codes) => updateConfig({ compareSubdivisions: codes })}
          countries={countriesData}
          selectedCountries={selectedCountries}
          onCountriesChange={(codes) => updateConfig({ selectedCountries: codes } as Partial<LocalConfig>)}
          vacationDaysTotal={vacationDaysTotal}
          onVacationDaysChange={(n) => updateConfig({ vacationDaysPerYear: { ...(config?.vacationDaysPerYear ?? {}), [year]: n } })}
          countWeekendsAsVacation={countWeekendsAsVacation}
          onCountWeekendsChange={(v) => updateConfig({ countWeekendsAsVacation: v })}
          halfDaysChristmas={halfDaysChristmas}
          onHalfDaysChange={(v) => updateConfig({ halfDaysChristmas: v })}
          vacationDaysUsed={vacationDaysUsed}
          gleittageCount={gleittageCount}
          remainingWorkDays={remainingWorkDays}
          defaultNoteText={defaultNoteText}
          onDefaultNoteTextChange={setDefaultNoteText}
          apiError={holidaysError}
          onRetryApi={handleRetryApi}
        />

        <Toolbar
          year={year} onYearChange={setYear}
          selectedType={selectedType} onTypeChange={setSelectedType}
          showHeatmap={showHeatmap} onToggleHeatmap={(v) => updateConfig({ showHeatmap: v })}
          showPublicHolidays={showPublicHolidays} onTogglePublicHolidays={(v) => updateConfig({ showPublicHolidays: v })}
          showSchoolHolidays={showSchoolHolidays} onToggleSchoolHolidays={(v) => updateConfig({ showSchoolHolidays: v })}
          showBridgeDays={showBridgeDays} onToggleBridgeDays={(v) => updateConfig({ showBridgeDays: v })}
          vacationDaysUsed={vacationDaysUsed} vacationDaysTotal={vacationDaysTotal}
          gleittageCount={gleittageCount} remainingWorkDays={remainingWorkDays}
          entries={entries} preferences={isLoggedIn ? serverPrefs : ((config ?? {}) as unknown as Record<string, unknown>)}
          localConfig={config}
          onOpenSuggestions={() => setShowSuggestions(true)}
          onImport={handleImport}
          onImportConfig={handleImportConfig}
          onReset={handleReset}
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
            publicHolidays={combinedPublicHolidays} schoolHolidays={schoolHolidays}
            compareHolidays={compareHolidays}
            showHeatmap={showHeatmap} showPublicHolidays={showPublicHolidays} showSchoolHolidays={showSchoolHolidays}
            bridgeDaySet={bridgeDaySet} showBridgeDays={showBridgeDays}
            overBudgetDates={overBudgetDates}
            onToggle={handleToggle} selectedType={selectedType}
            onHover={setHoveredDay}
          />
        )}

        {hoveredDay && (
          <div className="fixed bottom-4 right-4 z-50 bg-card border rounded-lg shadow-lg p-3 text-sm max-w-xs">
            <p className="font-medium">{format(hoveredDay.date, 'dd.MM.yyyy (EEEE)')}</p>
            {hoveredDay.publicHoliday && <p className="text-green-600">\ud83c\udf89 {hoveredDay.publicHoliday}</p>}
            {hoveredDay.schoolHoliday && <p className="text-yellow-600">\ud83c\udfeb {hoveredDay.schoolHoliday}</p>}
            {hoveredDay.isBridgeDay && <p className="text-orange-500">\ud83c\udf09 Br\u00fcckentag</p>}
            {hoveredDay.entry && (
              <p className="text-blue-500">
                {hoveredDay.entry.type === 'vacation' ? '\ud83c\udfd6\ufe0f Urlaub' :
                 hoveredDay.entry.type === 'gleittag' ? '\u23f0 Gleittag' :
                 `\ud83d\udcdd ${hoveredDay.entry.title ?? 'Notiz'}`}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Urlaub</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" /> \u00dcber Budget</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500" /> Gleittag</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" /> Feiertag</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300" /> Schulferien</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-50 ring-2 ring-orange-400" /> Br\u00fcckentag</span>
        </div>
      </main>
    </div>
  )
}
