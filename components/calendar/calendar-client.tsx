'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Toolbar } from '@/components/calendar/toolbar'
import { YearView } from '@/components/calendar/year-view'
import { SettingsPanel } from '@/components/calendar/settings-panel'
import { SuggestionsPanel } from '@/components/calendar/suggestions-panel'
import { useVacations, useToggleVacation } from '@/hooks/use-vacations'
import { useHolidays, useCompareHolidays, useCountries, useCountryHolidays } from '@/hooks/use-holidays'
import { useHomeRegion } from '@/hooks/use-home-region'
import { detectBridgeDays } from '@/lib/bridge-days'
import { loadConfig, saveConfig, configToEntries, defaultConfig, applyConfigPatch, mergeImportedEntries, toggleEntry } from '@/lib/config'
import { comparisonRegions, defaultComparisonSelection, localizedName } from '@/lib/holiday-regions'
import { holidayDateSet, remainingWorkDays as countRemainingWorkDays, summarizeVacation, vacationBudget } from '@/lib/vacation-accounting'
import { X, Info, Cloud, PartyPopper, School, Palmtree, Clock, StickyNote, Route } from 'lucide-react'
import { useProfile, useUpdatePreferences } from '@/hooks/use-profile'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { parsePreferences, parseEntry, countryChangePatch } from '@/lib/preferences'
import { parseISO, format } from 'date-fns'
import type { EntryType, Holiday, LocalConfig, PreferencesPatch } from '@/types'
import type { DayInfo } from '@/components/calendar/day-cell'
import type { ImportData } from '@/lib/export'

interface CalendarClientProps {
  userId?: string
  preferences: Record<string, unknown>
  isLoggedIn: boolean
}

function getDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function getHolidayForDate(holidays: Holiday[], date: Date): Holiday | undefined {
  return holidays.find(h => {
    const start = parseISO(h.startDate)
    const end = parseISO(h.endDate)
    return date >= start && date <= end
  })
}

function getHolidayName(h: Holiday): string {
  return localizedName(h.name)
}

type ConfigPatch = PreferencesPatch & { entries?: LocalConfig['entries'] }

function hasVisibleDayInfo(day: DayInfo | null): day is DayInfo {
  return Boolean(day?.publicHoliday || day?.schoolHoliday || day?.isBridgeDay || day?.entry || day?.comparisonStates?.length)
}

function DayInfoDetails({ day }: { day: DayInfo }) {
  return (
    <>
      <p className="font-medium">{format(day.date, 'dd.MM.yyyy (EEEE)')}</p>
      {day.publicHoliday && <p className="text-green-600"><PartyPopper className="mr-1 inline h-4 w-4" /> {day.publicHoliday}</p>}
      {day.schoolHoliday && <p className="text-yellow-600"><School className="mr-1 inline h-4 w-4" /> {day.schoolHoliday}</p>}
      {day.isBridgeDay && day.bridgeDayInfo && (
        <div className="text-orange-500">
          <p><Route className="mr-1 inline h-4 w-4" /> Brückentag</p>
          <p className="text-xs">Verbindet {day.bridgeDayInfo.connectsBeforeName} mit {day.bridgeDayInfo.connectsAfterName}</p>
          <p className="text-xs font-medium">1 Tag Urlaub → {day.bridgeDayInfo.freeDaysGained} Tage frei</p>
        </div>
      )}
      {day.isBridgeDay && !day.bridgeDayInfo && <p className="text-orange-500"><Route className="mr-1 inline h-4 w-4" /> Brückentag</p>}
      {Boolean(day.comparisonStates?.length) && <p className="mt-1 text-xs text-muted-foreground">Schulferien in {day.comparisonStates!.length} Bundesländern: {day.comparisonStates!.join(', ')}</p>}
      {day.entry && (
        <p className="text-blue-500">
          {day.entry.type === 'vacation' ? <><Palmtree className="mr-1 inline h-4 w-4" /> Urlaub</> :
           day.entry.type === 'gleittag' ? <><Clock className="mr-1 inline h-4 w-4" /> Gleittag</> :
           <><StickyNote className="mr-1 inline h-4 w-4" /> {day.entry.title ?? 'Notiz'}</>}
        </p>
      )}
    </>
  )
}

export function CalendarClient({ preferences: serverPrefs, isLoggedIn }: CalendarClientProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [selectedType, setSelectedType] = useState<EntryType>('vacation')
  const [localConfig, setConfig] = useState<LocalConfig | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [hoveredDay, setHoveredDay] = useState<DayInfo | null>(null)
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null)
  const [defaultNoteText, setDefaultNoteText] = useState('')

  useEffect(() => { if (!isLoggedIn) setConfig(loadConfig()) }, [isLoggedIn])

  const profile = useProfile(isLoggedIn)
  const updatePreferences = useUpdatePreferences()
  const queryClient = useQueryClient()
  const [importBusy, setImportBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const prefs = profile.data?.preferences ?? serverPrefs
  const config = isLoggedIn ? { ...defaultConfig(), ...prefs, entries: [] } as LocalConfig : localConfig
  // Country → subdivision → holiday group (e.g. NL-UT → NL-MI).
  const home = useHomeRegion(config)
  const { country, subdivision, region, locationReady, groupsLoading } = home
  const subdivisionsData = home.subdivisions, groupsData = home.groups
  const storedCompare = config?.compareSubdivisions
  const compareSubdivisions = useMemo(() => [...new Set(storedCompare ?? [])], [storedCompare])
  const selectedCountries = (config?.selectedCountries ?? []).filter(code => code !== country)
  const showHeatmap = config?.showHeatmap ?? false
  const showPublicHolidays = config?.showPublicHolidays ?? true
  const showSchoolHolidays = config?.showSchoolHolidays ?? true
  const showBridgeDays = config?.showBridgeDays ?? true
  const halfDaysChristmas = config?.halfDaysChristmas ?? true
  const countWeekendsAsVacation = config?.countWeekendsAsVacation ?? false
  const vacationDaysTotal = vacationBudget(config ?? {}, year)

  const { data: countriesData = [] } = useCountries()
  const { data: serverEntries = [], isLoading: entriesLoading, isError: entriesError } = useVacations(year, isLoggedIn)
  const { addMutation, removeMutation } = useToggleVacation(year, isLoggedIn)

  const entries = useMemo(() => isLoggedIn ? serverEntries : (localConfig ? configToEntries(localConfig, year) : []), [isLoggedIn, serverEntries, localConfig, year])


  const { data: publicHolidays = [], isError: holidaysError, refetch: refetchHolidays } = useHolidays({
    country, subdivision, year, type: 'public', enabled: locationReady,
  })
  const { data: schoolHolidays = [], isError: schoolError, isLoading: schoolLoading, refetch: refetchSchool } = useHolidays({
    country, subdivision, group: region.group, year, type: 'school', enabled: showSchoolHolidays && locationReady && !groupsLoading,
  })
  const groupCodes = useMemo(() => new Set(groupsData.map(g => g.code)), [groupsData])
  const compareRegions = useMemo(() => compareSubdivisions.map(code => ({ code, kind: groupCodes.has(code) ? 'group' as const : 'subdivision' as const })), [compareSubdivisions, groupCodes])
  const comparison = useCompareHolidays(country, compareRegions, year, showHeatmap && !groupsLoading)
  const countryHolidayArrays = useCountryHolidays(selectedCountries, year, selectedCountries.length > 0)

  const allCountryHolidays = useMemo(() => countryHolidayArrays.flat(), [countryHolidayArrays])

  const regionName = useCallback((code: string) => localizedName(
    subdivisionsData.find(s => s.code === code)?.name ?? groupsData.find(g => g.code === code)?.name, code,
  ), [subdivisionsData, groupsData])
  const compareOptions = useMemo(() => comparisonRegions(subdivisionsData, groupsData).map(r => ({ value: r.code, label: regionName(r.code) })), [subdivisionsData, groupsData, regionName])

  const bridgeDays = useMemo(() => {
    if (!showBridgeDays || publicHolidays.length === 0) return []
    return detectBridgeDays(year, publicHolidays)
  }, [year, publicHolidays, showBridgeDays])

  const bridgeDaySet = useMemo(() => new Set(bridgeDays.map(b => b.date)), [bridgeDays])

  const bridgeDayMap = useMemo(() => {
    const map = new Map<string, (typeof bridgeDays)[0]>()
    for (const b of bridgeDays) map.set(b.date, b)
    return map
  }, [bridgeDays])

  const showOtherMonthDays = config?.showOtherMonthDays ?? false

  // One cost definition for "verplant", "verbleibend", over budget and suggestions.
  const holidayDates = useMemo(() => holidayDateSet(publicHolidays), [publicHolidays])
  const summary = useMemo(
    () => summarizeVacation(entries, vacationDaysTotal, { holidayDates, halfDaysChristmas, countWeekendsAsVacation }),
    [entries, vacationDaysTotal, holidayDates, halfDaysChristmas, countWeekendsAsVacation]
  )
  const overBudgetDates = summary.overBudget
  const vacationDaysUsed = summary.used
  const gleittageCount = entries.filter(e => e.type === 'gleittag').length
  const remainingWorkDays = countRemainingWorkDays(year, entries, { holidayDates, countWeekendsAsVacation }, format(new Date(), 'yyyy-MM-dd'))
  const vacationDateSet = useMemo(
    () => new Set(entries.filter(e => e.type === 'vacation').map(e => e.date.split('T')[0])),
    [entries]
  )

  const updateConfig = useCallback((patch: ConfigPatch) => {
    if (isLoggedIn) {
      const { entries: _entries, ...preferences } = patch
      updatePreferences.mutate(preferences)
      return
    }
    setConfig(prev => {
      const next = applyConfigPatch(prev ?? loadConfig(), patch)
      saveConfig(next)
      return next
    })
  }, [isLoggedIn, updatePreferences])

  const updateLocalEntries = useCallback((updater: (entries: LocalConfig['entries']) => LocalConfig['entries']) => {
    if (isLoggedIn) return
    setConfig(prev => {
      const base = prev ?? loadConfig()
      const next = { ...base, entries: updater(base.entries) }
      saveConfig(next)
      return next
    })
  }, [isLoggedIn])

  const handleToggle = useCallback((date: Date, type: EntryType) => {
    const dateKey = getDateKey(date)
    const existing = entries.find(e => e.type === type && e.date.slice(0, 10) === dateKey)
    const title = !existing && type === 'note' ? defaultNoteText || prompt('Notiz-Text (optional):') || undefined : undefined
    if (isLoggedIn) {
      if (existing) removeMutation.mutate(existing.id)
      else addMutation.mutate({ date: `${dateKey}T00:00:00.000Z`, type, title })
    } else {
      updateLocalEntries(current => toggleEntry(current, dateKey, type, title))
    }
  }, [isLoggedIn, entries, addMutation, removeMutation, updateLocalEntries, defaultNoteText])

  const importSavedData = async (vacations: unknown[], preferences?: Record<string, unknown>, successMessage = 'Plan übernommen. Die lokale Kopie bleibt erhalten.') => {
    setImportBusy(true); setSyncMessage('')
    try {
      const response = await fetch('/api/vacations/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vacations, preferences }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['vacations'] }), queryClient.invalidateQueries({ queryKey: ['profile'] })])
      setSyncMessage(successMessage)
    } catch (error) { setSyncMessage(error instanceof Error ? error.message : 'Import fehlgeschlagen.') }
    finally { setImportBusy(false) }
  }

  const handleApplySuggestions = (dates: string[], type: EntryType, replace = false) => {
    const dateKeys = [...new Set(dates.map(date => date.split('T')[0]))]
    if (dateKeys.length === 0) return
    const wanted = new Set(dateKeys)
    // "Vorhandene überschreiben" replaces this year's vacation days; Gleittage and notes stay.
    const replaced = (entry: { date: string; type: string }) => replace && entry.type === type && entry.date.startsWith(`${year}-`) && !wanted.has(entry.date.slice(0, 10))

    if (isLoggedIn) {
      for (const entry of serverEntries) if (replaced(entry)) removeMutation.mutate(entry.id)
      void importSavedData(dateKeys.map(date => ({ date, type })), undefined, 'Vorschläge übernommen.')
      return
    }

    updateLocalEntries(current => mergeImportedEntries(current.filter(entry => !replaced(entry)), dateKeys.map(date => ({ date, type }))))
  }

  const handleImport = (data: ImportData) => {
    if (isLoggedIn) { void importSavedData(data.vacations); return }
    if (data.vacations.some(entry => !parseEntry(entry))) { setSyncMessage('Import enthält ungültige Einträge.'); return }
    updateLocalEntries(current => mergeImportedEntries(current, data.vacations))
  }

  const handleImportConfig = (data: Record<string, unknown>) => {
    const { entries, ...preferences } = data
    const valid = parsePreferences(preferences)
    if (!valid) { setSyncMessage('Ungültige Konfiguration.'); return }
    if (isLoggedIn) { void importSavedData(Array.isArray(entries) ? entries : [], valid as Record<string, unknown>); return }
    updateConfig(valid)
    if (Array.isArray(entries)) handleImport({ vacations: entries })
  }

  const importGuestPlan = () => {
    const { entries, ...preferences } = loadConfig()
    void importSavedData(entries, preferences as Record<string, unknown>)
  }

  const handleReset = async () => {
    if (!isLoggedIn) { updateConfig({ entries: [] }); return }
    setSyncMessage('')
    try {
      const response = await fetch('/api/vacations', { method: 'DELETE' })
      if (!response.ok) throw new Error()
      setSyncMessage('Alle Planungen wurden gelöscht.')
    } catch { setSyncMessage('Planungen konnten nicht gelöscht werden. Bitte erneut versuchen.') }
    finally { await queryClient.invalidateQueries({ queryKey: ['vacations'] }) }
  }

  const handleRetryApi = () => { home.retry(); refetchHolidays(); refetchSchool(); comparison.retry() }

  const existingVacationDates = [...vacationDateSet]
  const existingNoteDates = entries.filter(e => e.type === 'note').map(e => e.date.split('T')[0])

  const combinedPublicHolidays = useMemo(() => {
    if (allCountryHolidays.length === 0) return publicHolidays
    const merged = [...publicHolidays]
    for (const h of allCountryHolidays) {
      if (!merged.some(m => m.id === h.id)) merged.push(h)
    }
    return merged
  }, [publicHolidays, allCountryHolidays])

  const activeDayInfo = useMemo(() => {
    if (!activeDayKey) return null

    const date = parseISO(activeDayKey)
    const entry = entries.find(e => e.type === 'vacation' && e.date.split('T')[0] === activeDayKey)
      ?? entries.find(e => e.type === 'gleittag' && e.date.split('T')[0] === activeDayKey)
      ?? entries.find(e => e.type === 'note' && e.date.split('T')[0] === activeDayKey)
    const publicHoliday = getHolidayForDate(combinedPublicHolidays, date)
    const schoolHoliday = getHolidayForDate(schoolHolidays, date)
    const bridgeDayInfo = bridgeDayMap.get(activeDayKey)
    const day: DayInfo = {
      date,
      comparisonStates: showHeatmap ? comparison.holidays.flatMap((holidays, i) => getHolidayForDate(holidays, date) ? [regionName(compareSubdivisions[i])] : []) : [],
      publicHoliday: publicHoliday ? getHolidayName(publicHoliday) : undefined,
      schoolHoliday: schoolHoliday ? getHolidayName(schoolHoliday) : undefined,
      isBridgeDay: showBridgeDays && bridgeDaySet.has(activeDayKey),
      bridgeDayInfo,
      entry,
    }

    return hasVisibleDayInfo(day) ? day : null
  }, [activeDayKey, entries, combinedPublicHolidays, schoolHolidays, bridgeDayMap, bridgeDaySet, showBridgeDays, showHeatmap, comparison.holidays, compareSubdivisions, regionName])

  return (
    <div className="min-h-screen bg-background">
      <Header isLoggedIn={isLoggedIn} />
      <SuggestionsPanel
        open={showSuggestions} onClose={() => setShowSuggestions(false)}
        year={year} country={country} subdivision={subdivision} group={region.group}
        remainingDays={vacationDaysTotal - vacationDaysUsed}
        totalDays={vacationDaysTotal}
        halfDaysChristmas={halfDaysChristmas}
        existingVacationDates={existingVacationDates}
        noteDates={existingNoteDates}
        onApply={handleApplySuggestions}
      />
      <main className="container space-y-4 py-3 sm:py-4">
        {!isLoggedIn && (
          <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
            <Info className="mr-1 inline h-4 w-4" /> Dein Plan wird auf diesem Gerät gespeichert.{' '}
            <a href="/login" className="underline font-medium">Anmelden</a>, um ihn auf deinen anderen Geräten zu nutzen.
          </div>
        )}

        {isLoggedIn && <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm">
          <Cloud className="h-4 w-4 text-primary" /><span>{profile.isError || entriesError || updatePreferences.isError || addMutation.isError || removeMutation.isError ? 'Synchronisierung fehlgeschlagen' : profile.isLoading || entriesLoading ? 'Plan wird geladen…' : updatePreferences.isPending || addMutation.isPending || removeMutation.isPending ? 'Wird gespeichert…' : 'Mit deinem Konto synchronisiert'}</span>
          <Button variant="outline" size="sm" disabled={importBusy} onClick={importGuestPlan}>Lokalen Plan übernehmen</Button>
          <span className="text-xs text-muted-foreground">Aktualisierung alle 15 Sekunden und beim Zurückkehren.</span>
        </div>}
        {(profile.isError || entriesError || updatePreferences.isError || addMutation.isError || removeMutation.isError) && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">Speichern oder Synchronisieren fehlgeschlagen. Prüfe deine Verbindung und Anmeldung. <Button variant="outline" size="sm" onClick={() => { profile.refetch(); queryClient.invalidateQueries({ queryKey: ['vacations'] }) }}>Neu laden</Button></div>}
        {syncMessage && <p role="status" className="rounded-lg border p-3 text-sm">{syncMessage}</p>}
        {(schoolLoading || comparison.isLoading) && <p role="status" className="text-sm text-muted-foreground">Schulferien werden geladen…</p>}
        {locationReady && showSchoolHolidays && !schoolLoading && !schoolError && schoolHolidays.length === 0 && <p role="status" className="text-sm text-muted-foreground">Für {country === 'DE' ? 'dieses Bundesland' : 'diese Region'} und Jahr sind noch keine Schulferien verfügbar.</p>}
        {showSchoolHolidays && region.ambiguous && <p role="status" className="text-sm text-muted-foreground">Hier gelten mehrere Ferienregionen. Wähle deine Ferienregion, damit nur deine Schulferien angezeigt werden.</p>}
        {!locationReady && <p className="text-sm text-muted-foreground">{country === 'DE' ? 'Wähle dein Bundesland' : 'Wähle deine Region oder Ferienregion'}, um Feiertage und Schulferien zu laden.</p>}
        {showHeatmap && <p className="text-sm text-muted-foreground">Ferienvergleich: {country === 'DE' && compareSubdivisions.length === 16 ? 'Alle 16 Bundesländer' : compareSubdivisions.length ? compareSubdivisions.map(regionName).join(', ') : 'Wähle Vergleichsregionen aus.'}</p>}

        <SettingsPanel
          country={country}
          onCountryChange={(code) => { if (code !== country) updateConfig(countryChangePatch(code)) }}
          subdivisions={subdivisionsData}
          subdivision={subdivision}
          onSubdivisionChange={(code) => updateConfig({ subdivision: code, holidayGroup: null })}
          groups={region.candidates}
          holidayGroup={region.group}
          onHolidayGroupChange={(code) => updateConfig({ holidayGroup: code })}
          compareOptions={compareOptions}
          compareSubdivisions={compareSubdivisions}
          onCompareChange={(codes) => updateConfig({ compareSubdivisions: codes, showHeatmap: codes.length > 0 })}
          defaultCompareSelection={defaultComparisonSelection(subdivisionsData, groupsData)}
          countries={countriesData}
          selectedCountries={selectedCountries}
          onCountriesChange={(codes) => updateConfig({ selectedCountries: codes })}
          vacationDaysTotal={vacationDaysTotal}
          onVacationDaysChange={(n) => updateConfig({ vacationDaysPerYear: { [year]: n } })}
          countWeekendsAsVacation={countWeekendsAsVacation}
          onCountWeekendsChange={(v) => updateConfig({ countWeekendsAsVacation: v })}
          halfDaysChristmas={halfDaysChristmas}
          onHalfDaysChange={(v) => updateConfig({ halfDaysChristmas: v })}
          vacationDaysUsed={vacationDaysUsed}
          gleittageCount={gleittageCount}
          remainingWorkDays={remainingWorkDays}
          defaultNoteText={defaultNoteText}
          onDefaultNoteTextChange={setDefaultNoteText}
          apiError={home.isError || holidaysError || schoolError || comparison.isError}
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
          entries={entries} preferences={isLoggedIn ? (prefs as Record<string, unknown>) : ((config ?? {}) as unknown as Record<string, unknown>)}
          localConfig={isLoggedIn ? null : config}
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
            compareHolidays={comparison.holidays}
            compareLabels={compareSubdivisions.map(code => subdivisionsData.find((s: { code: string }) => s.code === code)?.name?.find((n: { language: string }) => n.language === 'DE')?.text ?? code)}
            showHeatmap={showHeatmap} showPublicHolidays={showPublicHolidays} showSchoolHolidays={showSchoolHolidays}
            bridgeDaySet={bridgeDaySet} bridgeDayMap={bridgeDayMap}
            showBridgeDays={showBridgeDays} showOtherMonthDays={showOtherMonthDays}
            overBudgetDates={overBudgetDates}
            onToggle={handleToggle} selectedType={selectedType}
            onHover={setHoveredDay}
            onSelectDate={(date) => setActiveDayKey(getDateKey(date))}
          />
        )}

        {hoveredDay && (
          <div className="pointer-events-none fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-lg border border-border bg-card p-3 text-sm text-card-foreground shadow-lg supports-[bottom:env(safe-area-inset-bottom)]:bottom-[calc(1rem+env(safe-area-inset-bottom))] md:block">
            <DayInfoDetails day={hoveredDay} />
          </div>
        )}

        {activeDayInfo && (
          <div className="fixed inset-x-3 z-50 rounded-lg border border-border bg-card p-3 pr-12 text-sm text-card-foreground shadow-lg supports-[bottom:env(safe-area-inset-bottom)]:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] bottom-3 md:hidden">
            <DayInfoDetails day={activeDayInfo} />
            <button
              type="button"
              onClick={() => setActiveDayKey(null)}
              className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Tagesinfo schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Urlaub</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" /> Über Budget</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500" /> Gleittag</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" /> Feiertag</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300" /> Schulferien</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-50 ring-2 ring-orange-400" /> Brückentag</span>
        </div>
      </main>
    </div>
  )
}
