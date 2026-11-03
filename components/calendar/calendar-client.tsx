'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Toolbar } from '@/components/calendar/toolbar'
import { YearView } from '@/components/calendar/year-view'
import { SettingsPanel } from '@/components/calendar/settings-panel'
import { SuggestionsPanel } from '@/components/calendar/suggestions-panel'
import { ClipboardExportDialog } from '@/components/calendar/clipboard-export-dialog'
import { ShareDialog } from '@/components/calendar/share-dialog'
import { SubscribeDialog } from '@/components/calendar/subscribe-dialog'
import { useVacations, useToggleVacation } from '@/hooks/use-vacations'
import { useHolidays, useCompareHolidays, useCountries, useCountryHolidays } from '@/hooks/use-holidays'
import { useHomeRegion } from '@/hooks/use-home-region'
import { detectBridgeDays } from '@/lib/bridge-days'
import { loadConfig, saveConfig, configToEntries, defaultConfig, applyConfigPatch, mergeImportedEntries, toggleEntry, diffEntries } from '@/lib/config'
import { comparisonRegions, defaultComparisonSelection, localizedName } from '@/lib/holiday-regions'
import { getSubdivisionAliases } from '@/lib/subdivision-aliases'
import {
  christmasPartner,
  holidayDateSet,
  isOffDayKey,
  DEFAULT_WORK_DAYS,
  formatDays,
  remainingWorkDays as countRemainingWorkDays,
  summarizeFlex,
  summarizeVacation,
  vacationBudget,
} from '@/lib/vacation-accounting'
import { recalculateSuggestionBlock, type VacationSuggestionBlock } from '@/lib/vacation-suggester'
import { decodeSharePayload, type ImportData } from '@/lib/export'
import {
  X,
  CheckCircle2,
  Share2,
  CalendarPlus,
  Sparkles,
  Users,
  Eye,
  Edit3,
  Keyboard,
  HelpCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react'
import { useProfile, useUpdatePreferences } from '@/hooks/use-profile'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parsePreferences, parseEntry, countryChangePatch } from '@/lib/preferences'
import { parseISO, format, eachDayOfInterval, differenceInCalendarDays } from 'date-fns'
import { de } from 'date-fns/locale'
import type { EntryType, Holiday, LocalConfig, PreferencesPatch, SharedPlanOverlay } from '@/types'
import type { DayInfo } from '@/components/calendar/day-cell'

interface CalendarClientProps {
  userId?: string
  preferences: Record<string, unknown>
  isLoggedIn: boolean
}

const SHARED_OVERLAYS_STORAGE_KEY = 'urlaubsplaner_shared_overlays_v1'
const GUEST_IMPORT_DISMISSED_KEY = 'urlaubsplaner_guest_import_dismissed_v1'
const OVERLAY_COLORS = ['#0d9488', '#db2777', '#7c3aed', '#ea580c', '#0284c7']

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

function shiftIsoDate(dateStr: string, deltaDays: number, year: number): string {
  const d = parseISO(dateStr)
  const shifted = new Date(d.getTime() + deltaDays * 86400000)
  const minD = new Date(year, 0, 1)
  const maxD = new Date(year, 11, 31)
  const clamped = shifted < minD ? minD : shifted > maxD ? maxD : shifted
  return format(clamped, 'yyyy-MM-dd')
}

type ConfigPatch = PreferencesPatch & { entries?: LocalConfig['entries'] }

type PlannedEntry = { date: string; type: string; title?: string | null }
/** State before an undoable change: one year of a synchronized plan, or the whole guest plan. */
type UndoSnapshot = { scope: number | 'all'; entries: PlannedEntry[] }
const UNDO_LIMIT = 20

const plannedEntry = ({ date, type, title }: PlannedEntry): PlannedEntry => ({ date: date.slice(0, 10), type, ...(title ? { title } : {}) })

function hasVisibleDayInfo(day: DayInfo | null): day is DayInfo {
  return Boolean(
    day?.publicHoliday ||
    day?.schoolHoliday ||
    day?.isBridgeDay ||
    day?.entry ||
    day?.comparisonStates?.length ||
    day?.sharedItems?.length ||
    day?.suggestionPreview
  )
}

function DayInfoDetails({ day }: { day: DayInfo }) {
  return (
    <>
      <p className="font-medium">{format(day.date, 'dd.MM.yyyy (EEEE)', { locale: de })}</p>
      {day.suggestionPreview && (
        <div className="my-1 rounded-md border border-teal-500/40 bg-teal-500/10 p-1.5 text-xs text-teal-700 dark:text-teal-300">
          <p className="font-semibold">✨ Vorschlag: {day.suggestionPreview.label}</p>
          <p>
            {formatDays(day.suggestionPreview.cost)} UT → <strong>{day.suggestionPreview.freeDaysGained} Tage frei</strong> ({day.suggestionPreview.efficiency.toFixed(1)}x Effizienz)
          </p>
          <p className="text-[10px] opacity-85">Ziehe ◀ / ▶ an den Enden oder verschiebe den Block direkt im Kalender.</p>
        </div>
      )}
      {day.publicHoliday && <p className="text-green-600 dark:text-green-400">🎉 {day.publicHoliday}</p>}
      {day.schoolHoliday && <p className="text-sky-600 dark:text-sky-400 font-medium">🏫 Eigene Schulferien: {day.schoolHoliday}</p>}
      {day.isBridgeDay && day.bridgeDayInfo && (
        <div className="text-orange-500">
          <p>🌉 Brückentag</p>
          <p className="text-xs">Verbindet {day.bridgeDayInfo.connectsBeforeName} mit {day.bridgeDayInfo.connectsAfterName}</p>
          <p className="text-xs font-medium">1 Tag Urlaub → {day.bridgeDayInfo.freeDaysGained} Tage frei</p>
        </div>
      )}
      {day.isBridgeDay && !day.bridgeDayInfo && <p className="text-orange-500">🌉 Brückentag</p>}
      {Boolean(day.comparisonStates?.length) && (
        <p className="mt-1 text-xs text-muted-foreground">
          Ferien-Auslastung ({day.comparisonStates!.length} Regionen): {day.comparisonStates!.join(', ')}
        </p>
      )}
      {day.entry && (
        <p className={day.entry.type === 'vacation' ? 'text-blue-500 font-medium' : day.entry.type === 'gleittag' ? 'text-purple-500 font-medium' : 'text-muted-foreground'}>
          {day.entry.type === 'vacation' ? '🌴 Urlaub' : day.entry.type === 'gleittag' ? '⏰ Gleittag' : `📝 ${day.entry.title ?? 'Notiz'}`}
        </p>
      )}
      {Boolean(day.sharedItems?.length) && (
        <div className="mt-1.5 border-t pt-1.5 space-y-0.5">
          {day.sharedItems!.map((shared, i) => (
            <p key={i} className="text-xs flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: shared.color }} />
              <span className="font-medium">{shared.label}:</span>
              <span>
                {shared.type === 'vacation' ? 'Urlaub' : shared.type === 'gleittag' ? 'Gleittag' : shared.title || 'Notiz'}
              </span>
            </p>
          ))}
        </div>
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
  const [showClipboardDialog, setShowClipboardDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false)
  const [hoveredDay, setHoveredDay] = useState<DayInfo | null>(null)
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null)
  const [defaultNoteText, setDefaultNoteText] = useState('')
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([])
  const [undoBusy, setUndoBusy] = useState(false)
  const [sharedOverlays, setSharedOverlays] = useState<SharedPlanOverlay[]>([])
  const [activeCollab, setActiveCollab] = useState<{
    token: string
    label: string
    ownerName: string
    entries: Array<{ id?: string; date: string; type: EntryType; title?: string | null }>
  } | null>(null)
  const [collabMode, setCollabMode] = useState<'overlay' | 'edit'>('overlay')
  const [guestEntriesCount, setGuestEntriesCount] = useState(0)
  const [guestImportDismissed, setGuestImportDismissed] = useState(false)

  // Interactive Calendar Suggestion Preview state
  const [previewSuggestions, setPreviewSuggestions] = useState<VacationSuggestionBlock[]>([])
  const [previewOverwrite, setPreviewOverwrite] = useState(false)
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0)

  useEffect(() => {
    const loaded = loadConfig()
    if (!isLoggedIn) {
      setConfig(loaded)
    } else {
      setGuestEntriesCount(loaded.entries?.length ?? 0)
      try {
        setGuestImportDismissed(localStorage.getItem(GUEST_IMPORT_DISMISSED_KEY) === '1')
      } catch {
        // ignore
      }
    }
  }, [isLoggedIn])

  // Load saved shared plan overlays from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHARED_OVERLAYS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setSharedOverlays(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  const saveSharedOverlays = useCallback((next: SharedPlanOverlay[]) => {
    setSharedOverlays(next)
    try {
      localStorage.setItem(SHARED_OVERLAYS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [])

  const handleAddOverlayByLink = useCallback(async (input: string): Promise<boolean> => {
    const trimmed = input.trim()
    if (!trimmed) return false
    try {
      let shareSnapshot: string | null = null
      let shareToken: string | null = null

      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('?')) {
        const url = new URL(trimmed, window.location.origin)
        shareSnapshot = url.searchParams.get('share')
        shareToken = url.searchParams.get('shareToken')
      } else if (trimmed.length > 40) {
        shareSnapshot = trimmed
      } else {
        shareToken = trimmed
      }

      if (shareSnapshot) {
        const decoded = decodeSharePayload(shareSnapshot)
        if (!decoded || decoded.entries.length === 0) return false
        const id = `snapshot-${decoded.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        setSharedOverlays(prev => {
          const exists = prev.find(o => o.id === id)
          const color = exists?.color ?? OVERLAY_COLORS[prev.length % OVERLAY_COLORS.length]
          const nextOverlay: SharedPlanOverlay = {
            id,
            label: decoded.label,
            permission: 'view',
            color,
            enabled: true,
            entries: decoded.entries,
          }
          const updated = exists ? prev.map(o => o.id === id ? nextOverlay : o) : [...prev, nextOverlay]
          try {
            localStorage.setItem(SHARED_OVERLAYS_STORAGE_KEY, JSON.stringify(updated))
          } catch {
            // ignore
          }
          return updated
        })
        return true
      }

      if (shareToken) {
        const res = await fetch(`/api/shares/${encodeURIComponent(shareToken)}`)
        if (!res.ok) return false
        const data = await res.json()
        const id = `token-${shareToken.slice(0, 10)}`
        const mappedEntries = (data.entries ?? []).map((e: { date: string; type: EntryType; title?: string | null }) => ({
          date: e.date.slice(0, 10),
          type: e.type,
          ...(e.title ? { title: e.title } : {}),
        }))
        setSharedOverlays(prev => {
          const exists = prev.find(o => o.id === id)
          const color = exists?.color ?? OVERLAY_COLORS[prev.length % OVERLAY_COLORS.length]
          const nextOverlay: SharedPlanOverlay = {
            id,
            label: `${data.label} (${data.ownerName})`,
            token: shareToken,
            permission: data.permission,
            color,
            enabled: true,
            entries: mappedEntries,
          }
          const updated = exists ? prev.map(o => o.id === id ? nextOverlay : o) : [...prev, nextOverlay]
          try {
            localStorage.setItem(SHARED_OVERLAYS_STORAGE_KEY, JSON.stringify(updated))
          } catch {
            // ignore
          }
          return updated
        })
        if (data.permission === 'edit') {
          setActiveCollab({
            token: shareToken,
            label: data.label,
            ownerName: data.ownerName,
            entries: data.entries ?? [],
          })
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  // Handle ?share= and ?shareToken= URL query parameters
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const shareSnapshot = params.get('share')
    const shareToken = params.get('shareToken')

    if (shareSnapshot) {
      const decoded = decodeSharePayload(shareSnapshot)
      if (decoded && decoded.entries.length > 0) {
        const firstYear = Number(decoded.entries[0]?.date?.slice(0, 4))
        if (firstYear >= 2020 && firstYear <= 2100) {
          setYear(firstYear)
        }
        const id = `snapshot-${decoded.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        setSharedOverlays(prev => {
          const exists = prev.find(o => o.id === id)
          const color = exists?.color ?? OVERLAY_COLORS[prev.length % OVERLAY_COLORS.length]
          const nextOverlay: SharedPlanOverlay = {
            id,
            label: decoded.label,
            permission: 'view',
            color,
            enabled: true,
            entries: decoded.entries,
          }
          const updated = exists ? prev.map(o => o.id === id ? nextOverlay : o) : [...prev, nextOverlay]
          try {
            localStorage.setItem(SHARED_OVERLAYS_STORAGE_KEY, JSON.stringify(updated))
          } catch {
            // ignore
          }
          return updated
        })
        setSyncMessage(`Geteilter Plan „${decoded.label}“ wurde im Kalender eingeblendet.`)
      }
    }

    if (shareToken) {
      void (async () => {
        try {
          const res = await fetch(`/api/shares/${encodeURIComponent(shareToken)}`)
          if (!res.ok) return
          const data = await res.json()
          const id = `token-${shareToken.slice(0, 10)}`
          const mappedEntries = (data.entries ?? []).map((e: { date: string; type: EntryType; title?: string | null }) => ({
            date: e.date.slice(0, 10),
            type: e.type,
            ...(e.title ? { title: e.title } : {}),
          }))
          setSharedOverlays(prev => {
            const exists = prev.find(o => o.id === id)
            const color = exists?.color ?? OVERLAY_COLORS[prev.length % OVERLAY_COLORS.length]
            const nextOverlay: SharedPlanOverlay = {
              id,
              label: `${data.label} (${data.ownerName})`,
              token: shareToken,
              permission: data.permission,
              color,
              enabled: true,
              entries: mappedEntries,
            }
            const updated = exists ? prev.map(o => o.id === id ? nextOverlay : o) : [...prev, nextOverlay]
            try {
              localStorage.setItem(SHARED_OVERLAYS_STORAGE_KEY, JSON.stringify(updated))
            } catch {
              // ignore
            }
            return updated
          })
          if (data.permission === 'edit') {
            setActiveCollab({
              token: shareToken,
              label: data.label,
              ownerName: data.ownerName,
              entries: data.entries ?? [],
            })
            setSyncMessage(`Geteilter Plan „${data.label}“ von ${data.ownerName} geladen. Du kannst ihn vergleichen oder direkt gemeinsam bearbeiten!`)
          } else {
            setSyncMessage(`Geteilter Plan „${data.label}“ von ${data.ownerName} wurde zum Vergleichen eingeblendet.`)
          }
        } catch {
          // ignore
        }
      })()
    }
  }, [])

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
  const workDays = useMemo(() => config?.workDays ?? DEFAULT_WORK_DAYS, [config?.workDays])
  const vacationDaysTotal = vacationBudget(config ?? {}, year)

  const { data: countriesData = [] } = useCountries()
  const { data: serverEntries = [], isLoading: entriesLoading, isError: entriesError } = useVacations(year, isLoggedIn)
  const { addMutation, removeMutation } = useToggleVacation(year, isLoggedIn)

  const baseEntries = useMemo(
    () => isLoggedIn ? serverEntries : (localConfig ? configToEntries(localConfig, year) : []),
    [isLoggedIn, serverEntries, localConfig, year]
  )

  // When collaborative editing mode is active on a shared plan, show and edit that plan's entries
  const entries = useMemo(() => {
    if (activeCollab && collabMode === 'edit') {
      return activeCollab.entries
        .filter(e => e.date.startsWith(`${year}-`))
        .map((e, i) => ({
          id: e.id ?? `collab-${i}`,
          userId: 'shared',
          date: e.date,
          type: e.type,
          title: e.title ?? undefined,
          year,
          createdAt: '',
          updatedAt: '',
        }))
    }
    return baseEntries
  }, [activeCollab, collabMode, baseEntries, year])

  // Lightweight anonymous/registered analytics heartbeat for the Admin Dashboard
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return
    try {
      let visitorId = localStorage.getItem('urlaubsplaner_visitor_id')
      if (!visitorId) {
        visitorId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        localStorage.setItem('urlaubsplaner_visitor_id', visitorId)
      }
      void fetch('/api/analytics/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          country,
          subdivision,
          plannedDaysCount: baseEntries.length,
        }),
      }).catch(() => {})
    } catch {
      // ignore
    }
  }, [country, subdivision, baseEntries.length])

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
  const compareOptions = useMemo(() => comparisonRegions(subdivisionsData, groupsData).map(r => ({ value: r.code, label: regionName(r.code), aliases: getSubdivisionAliases(r.code) })), [subdivisionsData, groupsData, regionName])

  const bridgeDays = useMemo(() => {
    if (!showBridgeDays || publicHolidays.length === 0) return []
    return detectBridgeDays(year, publicHolidays, workDays)
  }, [year, publicHolidays, showBridgeDays, workDays])

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
    () => summarizeVacation(entries, vacationDaysTotal, { holidayDates, halfDaysChristmas, countWeekendsAsVacation, workDays }),
    [entries, vacationDaysTotal, holidayDates, halfDaysChristmas, countWeekendsAsVacation, workDays]
  )
  const overBudgetDates = summary.overBudget
  const vacationDaysUsed = summary.used
  const gleittageCount = entries.filter(e => e.type === 'gleittag').length
  const flex = summarizeFlex(gleittageCount, config ?? {}, year)
  const remainingWorkDays = countRemainingWorkDays(year, entries, { holidayDates, countWeekendsAsVacation, workDays }, format(new Date(), 'yyyy-MM-dd'))
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

  const pushUndo = useCallback((snapshot: UndoSnapshot) => setUndoStack(stack => [...stack.slice(1 - UNDO_LIMIT), snapshot]), [])
  // Before a change to the shown year: the year of a synchronized plan, or the whole guest plan.
  const recordUndo = useCallback(() => pushUndo(isLoggedIn
    ? { scope: year, entries: serverEntries.map(plannedEntry) }
    : { scope: 'all', entries: (localConfig?.entries ?? []).map(plannedEntry) }), [pushUndo, isLoggedIn, year, serverEntries, localConfig])

  const handleUndo = useCallback(async () => {
    const snapshot = undoStack.at(-1)
    if (!snapshot) return
    setUndoStack(stack => stack.slice(0, -1))
    if (!isLoggedIn) { updateLocalEntries(() => snapshot.entries.map(e => ({ date: e.date, type: e.type, ...(e.title ? { title: e.title } : {}) }))); return }
    setUndoBusy(true); setSyncMessage('')
    try {
      const response = await fetch(snapshot.scope === 'all' ? '/api/vacations' : `/api/vacations?year=${snapshot.scope}`)
      if (!response.ok) throw new Error()
      const { remove, add } = diffEntries(await response.json() as Array<PlannedEntry & { id: string }>, snapshot.entries)
      for (const entry of remove) if (!(await fetch(`/api/vacations/${entry.id}`, { method: 'DELETE' })).ok) throw new Error()
      if (add.length && !(await fetch('/api/vacations/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vacations: add }) })).ok) throw new Error()
    } catch { setSyncMessage('Rückgängig machen fehlgeschlagen. Bitte erneut versuchen.') }
    finally { setUndoBusy(false); await queryClient.invalidateQueries({ queryKey: ['vacations'] }) }
  }, [undoStack, isLoggedIn, updateLocalEntries, queryClient])

  const canUndo = undoStack.length > 0 && !undoBusy && !importBusy && !addMutation.isPending && !removeMutation.isPending

  // Keyboard shortcuts: U (Urlaub), G (Gleittag), N (Notiz), P (Planer), Ctrl+Z (Undo)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (showSuggestions || showClipboardDialog || showShareDialog || showSubscribeDialog) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (canUndo) {
          e.preventDefault()
          void handleUndo()
        }
        return
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.toLowerCase()
      if (key === 'u' || key === '1') {
        e.preventDefault()
        setSelectedType('vacation')
      } else if (key === 'g' || key === '2') {
        e.preventDefault()
        setSelectedType('gleittag')
      } else if (key === 'n' || key === '3') {
        e.preventDefault()
        setSelectedType('note')
      } else if (key === 'p') {
        e.preventDefault()
        setShowSuggestions(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    canUndo,
    handleUndo,
    showSuggestions,
    showClipboardDialog,
    showShareDialog,
    showSubscribeDialog,
  ])

  const importSavedData = useCallback(async (vacations: unknown[], preferences?: Record<string, unknown>, successMessage = 'Plan übernommen. Die lokale Kopie bleibt erhalten.') => {
    setImportBusy(true); setSyncMessage('')
    try {
      const response = await fetch('/api/vacations/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vacations, preferences }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['vacations'] }), queryClient.invalidateQueries({ queryKey: ['profile'] })])
      if (successMessage) setSyncMessage(successMessage)
    } catch (error) { setSyncMessage(error instanceof Error ? error.message : 'Import fehlgeschlagen.') }
    finally { setImportBusy(false) }
  }, [queryClient])

  const handleToggle = useCallback((date: Date, type: EntryType) => {
    const dateKey = getDateKey(date)

    // Collaborative live-edit mode on a shared plan
    if (activeCollab && collabMode === 'edit') {
      const matching = (key: string) => (e: { date: string; type: string }) => e.type === type && e.date.slice(0, 10) === key
      const existing = activeCollab.entries.find(matching(dateKey))
      const title = !existing && type === 'note' ? defaultNoteText || prompt('Notiz-Text (optional):') || undefined : undefined
      void (async () => {
        try {
          const res = await fetch(`/api/shares/${encodeURIComponent(activeCollab.token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle', date: dateKey, type, title }),
          })
          if (!res.ok) throw new Error()
          const refreshed = await fetch(`/api/shares/${encodeURIComponent(activeCollab.token)}`)
          if (refreshed.ok) {
            const data = await refreshed.json()
            setActiveCollab(prev => prev ? { ...prev, entries: data.entries ?? [] } : null)
          }
        } catch {
          setSyncMessage('Gemeinsame Änderung konnte nicht gespeichert werden.')
        }
      })()
      return
    }

    const matching = (key: string) => (e: { date: string; type: string }) => e.type === type && e.date.slice(0, 10) === key
    // Guests: search all years, days of the neighbouring year can be visible in the grid.
    const existing = isLoggedIn ? entries.find(matching(dateKey)) : localConfig?.entries.find(matching(dateKey))
    const title = !existing && type === 'note' ? defaultNoteText || prompt('Notiz-Text (optional):') || undefined : undefined
    // With half days, 24.12. and 31.12. are planned together.
    const partner = type === 'vacation' && halfDaysChristmas ? christmasPartner(dateKey) : null
    const keys = partner ? [dateKey, partner] : [dateKey]
    recordUndo()
    if (isLoggedIn) {
      for (const key of keys) {
        const saved = entries.find(matching(key))
        if (existing && saved) removeMutation.mutate(saved.id)
        else if (!existing && !saved) addMutation.mutate({ date: `${key}T00:00:00.000Z`, type, title })
      }
    } else {
      updateLocalEntries(current => keys.reduce((next, key) => Boolean(next.find(matching(key))) === Boolean(existing) ? toggleEntry(next, key, type, title) : next, current))
    }
  }, [activeCollab, collabMode, isLoggedIn, entries, localConfig, addMutation, removeMutation, updateLocalEntries, defaultNoteText, halfDaysChristmas, recordUndo])

  // Multi-day Drag-to-Select & Shift+Click range handler for vacation, gleittag, and multi-day notes/events
  const handleSelectRange = useCallback((startDateKey: string, endDateKey: string, type: EntryType) => {
    const firstKey = startDateKey < endDateKey ? startDateKey : endDateKey
    const lastKey = startDateKey < endDateKey ? endDateKey : startDateKey
    const allRangeKeys = eachDayOfInterval({
      start: parseISO(firstKey),
      end: parseISO(lastKey),
    }).map(d => format(d, 'yyyy-MM-dd'))

    // For vacation and gleittag, skip public holidays and non-working weekdays unless countWeekendsAsVacation is enabled
    const targetKeys =
      type === 'note'
        ? allRangeKeys
        : allRangeKeys.filter(
            k =>
              !holidayDates.has(k) &&
              (countWeekendsAsVacation || !isOffDayKey(k, workDays)),
          )

    if (targetKeys.length === 0) return

    const sourceList = isLoggedIn ? entries : (localConfig?.entries ?? [])
    const existingSet = new Set(
      sourceList.filter(e => e.type === type).map(e => e.date.slice(0, 10)),
    )
    const allAlreadyPlanned = targetKeys.every(k => existingSet.has(k))

    recordUndo()

    if (allAlreadyPlanned) {
      // Remove the selected range
      const removeSet = new Set(targetKeys)
      if (isLoggedIn) {
        for (const entry of serverEntries) {
          if (entry.type === type && removeSet.has(entry.date.slice(0, 10))) {
            removeMutation.mutate(entry.id)
          }
        }
      } else {
        updateLocalEntries(current =>
          current.filter(e => !(e.type === type && removeSet.has(e.date.slice(0, 10)))),
        )
      }
      return
    }

    // Adding range
    let noteTitle: string | undefined
    if (type === 'note') {
      const rangeLabel = `${format(parseISO(firstKey), 'dd.MM.')} – ${format(parseISO(lastKey), 'dd.MM.')} (${targetKeys.length} Tage)`
      const entered = defaultNoteText || prompt(`Notiz / Event-Text für ${rangeLabel}:`)
      if (entered === null) return
      noteTitle = entered.trim() || 'Event'
    }

    const missingKeys = targetKeys.filter(k => !existingSet.has(k))
    if (missingKeys.length === 0) return

    if (isLoggedIn) {
      void importSavedData(
        missingKeys.map(date => ({ date, type, ...(noteTitle ? { title: noteTitle } : {}) })),
        undefined,
        `${missingKeys.length} ${type === 'vacation' ? 'Urlaubstage' : type === 'gleittag' ? 'Gleittage' : 'Notiz-Tage'} hinzugefügt.`,
      )
    } else {
      updateLocalEntries(current =>
        mergeImportedEntries(
          current,
          missingKeys.map(date => ({ date, type, ...(noteTitle ? { title: noteTitle } : {}) })),
        ),
      )
    }
  }, [holidayDates, countWeekendsAsVacation, workDays, isLoggedIn, entries, localConfig, recordUndo, serverEntries, removeMutation, updateLocalEntries, defaultNoteText, importSavedData])

  const handleApplySuggestions = (dates: string[], type: EntryType, replace = false) => {
    const dateKeys = [...new Set(dates.map(date => date.split('T')[0]))]
    if (dateKeys.length === 0) return
    const wanted = new Set(dateKeys)
    // "Vorhandene überschreiben" replaces this year's vacation days; Gleittage and notes stay.
    const replaced = (entry: { date: string; type: string }) => replace && entry.type === type && entry.date.startsWith(`${year}-`) && !wanted.has(entry.date.slice(0, 10))
    recordUndo()

    if (isLoggedIn) {
      for (const entry of serverEntries) if (replaced(entry)) removeMutation.mutate(entry.id)
      void importSavedData(dateKeys.map(date => ({ date, type })), undefined, 'Vorschläge übernommen.')
      return
    }

    updateLocalEntries(current => mergeImportedEntries(current.filter(entry => !replaced(entry)), dateKeys.map(date => ({ date, type }))))
  }

  const handleRemoveSuggestion = (dates: string[]) => {
    const removed = new Set(dates)
    const isRemoved = (entry: { date: string; type: string }) => entry.type === 'vacation' && removed.has(entry.date.slice(0, 10))
    recordUndo()
    if (isLoggedIn) { for (const entry of serverEntries) if (isRemoved(entry)) removeMutation.mutate(entry.id); return }
    updateLocalEntries(current => current.filter(entry => !isRemoved(entry)))
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
    void importSavedData(entries, preferences as Record<string, unknown>, 'Deine lokal gespeicherten Tage wurden in dein Konto übernommen.')
    setGuestImportDismissed(true)
    try {
      localStorage.setItem(GUEST_IMPORT_DISMISSED_KEY, '1')
    } catch {
      // ignore
    }
  }

  const dismissGuestImport = () => {
    setGuestImportDismissed(true)
    try {
      localStorage.setItem(GUEST_IMPORT_DISMISSED_KEY, '1')
    } catch {
      // ignore
    }
  }

  const handleReset = async () => {
    if (!isLoggedIn) { pushUndo({ scope: 'all', entries: (localConfig?.entries ?? []).map(plannedEntry) }); updateConfig({ entries: [] }); return }
    setSyncMessage('')
    try {
      const before = await fetch('/api/vacations')
      if (!before.ok) throw new Error()
      pushUndo({ scope: 'all', entries: (await before.json() as PlannedEntry[]).map(plannedEntry) })
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

  // Interactive Suggestion Preview Drag & Resize Handler on the Calendar
  const handleDragPreviewBlock = useCallback(
    (
      index: number,
      mode: 'move' | 'resize-start' | 'resize-end',
      targetDateKey: string,
      anchorDateKey: string,
    ) => {
      setPreviewSuggestions(prev => {
        const current = prev[index]
        if (!current || current.vacationDays.length === 0) return prev
        const firstVac = current.vacationDays[0]
        const lastVac = current.vacationDays[current.vacationDays.length - 1]
        let nextStart = firstVac
        let nextEnd = lastVac

        if (mode === 'resize-start') {
          nextStart = targetDateKey <= lastVac ? targetDateKey : lastVac
        } else if (mode === 'resize-end') {
          nextEnd = targetDateKey >= firstVac ? targetDateKey : firstVac
        } else {
          const delta = differenceInCalendarDays(parseISO(targetDateKey), parseISO(anchorDateKey))
          if (delta === 0) return prev
          nextStart = shiftIsoDate(firstVac, delta, year)
          nextEnd = shiftIsoDate(lastVac, delta, year)
        }

        const recalculated = recalculateSuggestionBlock(
          year,
          nextStart,
          nextEnd,
          combinedPublicHolidays,
          schoolHolidays,
          vacationDateSet,
          {
            halfDaysChristmas,
            countWeekendsAsVacation,
            workDays,
            overwrite: previewOverwrite,
          },
          current,
        )
        if (!recalculated) return prev
        return prev.map((b, i) => (i === index ? recalculated : b))
      })
    },
    [year, combinedPublicHolidays, schoolHolidays, vacationDateSet, halfDaysChristmas, countWeekendsAsVacation, workDays, previewOverwrite],
  )

  const handleNudgePreviewBlock = (index: number, mode: 'move' | 'start' | 'end', deltaDays: number) => {
    const current = previewSuggestions[index]
    if (!current || current.vacationDays.length === 0) return
    const firstVac = current.vacationDays[0]
    const lastVac = current.vacationDays[current.vacationDays.length - 1]
    const nextStart = mode === 'move' || mode === 'start' ? shiftIsoDate(firstVac, deltaDays, year) : firstVac
    const nextEnd = mode === 'move' || mode === 'end' ? shiftIsoDate(lastVac, deltaDays, year) : lastVac
    if (nextStart > nextEnd) return
    const recalculated = recalculateSuggestionBlock(
      year,
      nextStart,
      nextEnd,
      combinedPublicHolidays,
      schoolHolidays,
      vacationDateSet,
      {
        halfDaysChristmas,
        countWeekendsAsVacation,
        workDays,
        overwrite: previewOverwrite,
      },
      current,
    )
    if (recalculated) {
      setPreviewSuggestions(prev => prev.map((b, i) => (i === index ? recalculated : b)))
    }
  }

  // Build map of dateKey -> shared plan entries from visible overlays (when not in edit mode for that same token)
  const sharedOverlayMap = useMemo(() => {
    const map = new Map<string, Array<{ label: string; color: string; type: EntryType; title?: string }>>()
    for (const overlay of sharedOverlays) {
      if (!overlay.enabled) continue
      if (activeCollab && collabMode === 'edit' && overlay.token === activeCollab.token) continue
      for (const e of overlay.entries) {
        const key = e.date.slice(0, 10)
        const list = map.get(key) ?? []
        list.push({ label: overlay.label, color: overlay.color, type: e.type, title: e.title ?? undefined })
        map.set(key, list)
      }
    }
    return map
  }, [sharedOverlays, activeCollab, collabMode])

  const activeDayInfo = useMemo(() => {
    if (!activeDayKey) return null

    const date = parseISO(activeDayKey)
    const entry = entries.find(e => e.type === 'vacation' && e.date.split('T')[0] === activeDayKey)
      ?? entries.find(e => e.type === 'gleittag' && e.date.split('T')[0] === activeDayKey)
      ?? entries.find(e => e.type === 'note' && e.date.split('T')[0] === activeDayKey)
    const publicHoliday = getHolidayForDate(combinedPublicHolidays, date)
    const schoolHoliday = getHolidayForDate(schoolHolidays, date)
    const bridgeDayInfo = bridgeDayMap.get(activeDayKey)
    const sharedItems = sharedOverlayMap.get(activeDayKey)
    const day: DayInfo = {
      date,
      comparisonStates: showHeatmap ? comparison.holidays.flatMap((holidays, i) => getHolidayForDate(holidays, date) ? [regionName(compareSubdivisions[i])] : []) : [],
      publicHoliday: publicHoliday ? getHolidayName(publicHoliday) : undefined,
      schoolHoliday: schoolHoliday ? getHolidayName(schoolHoliday) : undefined,
      isBridgeDay: showBridgeDays && bridgeDaySet.has(activeDayKey),
      bridgeDayInfo,
      entry,
      sharedItems,
    }

    return hasVisibleDayInfo(day) ? day : null
  }, [activeDayKey, entries, combinedPublicHolidays, schoolHolidays, bridgeDayMap, bridgeDaySet, showBridgeDays, showHeatmap, comparison.holidays, compareSubdivisions, regionName, sharedOverlayMap])

  const hasSyncError = profile.isError || entriesError || updatePreferences.isError || addMutation.isError || removeMutation.isError
  const isSavingOrLoading = profile.isLoading || entriesLoading || updatePreferences.isPending || addMutation.isPending || removeMutation.isPending

  const activePreviewBlock = previewSuggestions[selectedPreviewIndex] ?? previewSuggestions[0] ?? null
  const previewTotalCost = useMemo(() => previewSuggestions.reduce((s, b) => s + b.cost, 0), [previewSuggestions])
  const previewTotalFree = useMemo(() => previewSuggestions.reduce((s, b) => s + b.freeDaysGained, 0), [previewSuggestions])
  const previewAvgEff = previewTotalCost > 0 ? previewTotalFree / previewTotalCost : 0

  return (
    <div className="min-h-screen bg-background">
      <Header isLoggedIn={isLoggedIn} />

      <SuggestionsPanel
        open={showSuggestions} onClose={() => setShowSuggestions(false)}
        year={year} country={country} subdivision={subdivision} group={region.group}
        remainingDays={vacationDaysTotal - vacationDaysUsed}
        totalDays={vacationDaysTotal}
        halfDaysChristmas={halfDaysChristmas}
        countWeekendsAsVacation={countWeekendsAsVacation}
        workDays={workDays}
        publicHolidays={combinedPublicHolidays}
        schoolHolidays={schoolHolidays}
        existingVacationDates={existingVacationDates}
        noteDates={existingNoteDates}
        onApply={handleApplySuggestions}
        onRemove={handleRemoveSuggestion}
        onOpenCalendarPreview={(blocks, overwrite) => {
          setPreviewSuggestions(blocks)
          setPreviewOverwrite(overwrite)
          setSelectedPreviewIndex(0)
          setShowSuggestions(false)
        }}
        busy={importBusy || addMutation.isPending || removeMutation.isPending}
      />

      <ClipboardExportDialog
        open={showClipboardDialog}
        onClose={() => setShowClipboardDialog(false)}
        entries={entries}
        year={year}
        vacationDaysUsed={vacationDaysUsed}
        vacationDaysTotal={vacationDaysTotal}
      />

      <ShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        isLoggedIn={isLoggedIn}
        country={country}
        subdivision={subdivision}
        entries={entries}
        overlays={sharedOverlays}
        onToggleOverlay={(id, enabled) =>
          saveSharedOverlays(sharedOverlays.map(o => (o.id === id ? { ...o, enabled } : o)))
        }
        onRemoveOverlay={id => saveSharedOverlays(sharedOverlays.filter(o => o.id !== id))}
        onAddOverlayByLink={handleAddOverlayByLink}
        activeCollabToken={activeCollab && collabMode === 'edit' ? activeCollab.token : null}
        onSelectCollabToken={token => {
          if (!token) {
            setCollabMode('overlay')
            return
          }
          const match = sharedOverlays.find(o => o.token === token && o.permission === 'edit')
          if (match) {
            setActiveCollab({
              token,
              label: match.label,
              ownerName: match.label,
              entries: match.entries,
            })
            setCollabMode('edit')
          }
        }}
      />

      <SubscribeDialog
        open={showSubscribeDialog}
        onClose={() => setShowSubscribeDialog(false)}
        isLoggedIn={isLoggedIn}
        year={year}
        entries={entries}
        locationReady={locationReady}
        regionLabel={subdivision ? regionName(subdivision) : country}
      />

      <main className="container space-y-4 py-3 sm:py-4">
        {/* Guest Welcome & Quick Actions Bar */}
        {!isLoggedIn && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200/80 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/30 px-3.5 py-2.5 text-sm text-blue-900 dark:text-blue-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                Dein Plan wird automatisch <strong>auf diesem Gerät gespeichert</strong>.{' '}
                <a href="/login" className="underline font-semibold hover:text-blue-700 dark:hover:text-blue-300">
                  Kostenlos anmelden
                </a>
                , um ihn auch am Handy oder anderen PCs zu synchronisieren.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background/80"
                onClick={() => setShowShareDialog(true)}
              >
                <Share2 className="mr-1.5 h-3.5 w-3.5" />
                Plan teilen
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background/80"
                onClick={() => setShowSubscribeDialog(true)}
              >
                <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                In Kalender einbinden
              </Button>
            </div>
          </div>
        )}

        {/* Logged-in Friendly Account Status & Optional Guest Plan Import */}
        {isLoggedIn && !hasSyncError && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card/70 px-3.5 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {isSavingOrLoading
                  ? 'Änderungen werden gespeichert…'
                  : 'Alle Änderungen werden automatisch in deinem Konto gespeichert'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {guestEntriesCount > 0 && !guestImportDismissed && (
                <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs text-foreground">
                  <span>Lokale Gast-Einträge gefunden ({guestEntriesCount}):</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={importBusy}
                    onClick={importGuestPlan}
                  >
                    In mein Konto übernehmen
                  </Button>
                  <button
                    type="button"
                    onClick={dismissGuestImport}
                    className="text-muted-foreground hover:text-foreground px-1"
                    title="Hinweis ausblenden"
                    aria-label="Hinweis ausblenden"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowShareDialog(true)}
              >
                <Share2 className="mr-1 h-3.5 w-3.5" />
                Teilen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowSubscribeDialog(true)}
              >
                <CalendarPlus className="mr-1 h-3.5 w-3.5" />
                Google / Apple Kalender
              </Button>
            </div>
          </div>
        )}

        {hasSyncError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <span>Speichern oder Synchronisieren fehlgeschlagen. Prüfe deine Verbindung und Anmeldung.</span>
            <Button variant="outline" size="sm" onClick={() => { profile.refetch(); queryClient.invalidateQueries({ queryKey: ['vacations'] }) }}>
              Neu laden
            </Button>
          </div>
        )}

        {/* Active Collaborative Plan Banner */}
        {activeCollab && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-teal-500/40 bg-teal-50/70 dark:bg-teal-950/30 p-3 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <div>
                <span className="font-semibold">Geteilter Plan: „{activeCollab.label}“</span>{' '}
                <span className="text-muted-foreground">(von {activeCollab.ownerName})</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant={collabMode === 'overlay' ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setCollabMode('overlay')}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Neben meinem Plan vergleichen
              </Button>
              <Button
                size="sm"
                variant={collabMode === 'edit' ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setCollabMode('edit')}
              >
                <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                Diesen Plan direkt bearbeiten
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => {
                  setActiveCollab(null)
                  setCollabMode('overlay')
                }}
              >
                Beenden
              </Button>
            </div>
          </div>
        )}

        {/* Shared Overlays Quick Bar when overlays exist */}
        {sharedOverlays.length > 0 && !activeCollab && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Eingeblendete Pläne:
              </span>
              {sharedOverlays.map(overlay => (
                <button
                  key={overlay.id}
                  type="button"
                  onClick={() =>
                    saveSharedOverlays(
                      sharedOverlays.map(o => (o.id === overlay.id ? { ...o, enabled: !o.enabled } : o))
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium transition-opacity ${
                    overlay.enabled ? 'bg-background shadow-xs opacity-100' : 'opacity-50'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: overlay.color }} />
                  <span>{overlay.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({overlay.enabled ? 'sichtbar' : 'ausgeblendet'})
                  </span>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowShareDialog(true)}>
              Verwalten
            </Button>
          </div>
        )}

        {syncMessage && (
          <div role="status" className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
            <span>{syncMessage}</span>
            <button
              type="button"
              onClick={() => setSyncMessage('')}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Meldung schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
          workDays={workDays}
          onWorkDaysChange={(days) => updateConfig({ workDays: days })}
          countWeekendsAsVacation={countWeekendsAsVacation}
          onCountWeekendsChange={(v) => updateConfig({ countWeekendsAsVacation: v })}
          halfDaysChristmas={halfDaysChristmas}
          onHalfDaysChange={(v) => updateConfig({ halfDaysChristmas: v })}
          vacationDaysUsed={vacationDaysUsed}
          gleittageCount={gleittageCount}
          flex={flex}
          flexHoursPerDay={config?.flexHoursPerDay ?? 8}
          onFlexUnitChange={(unit) => updateConfig({ flexUnit: unit })}
          onFlexHoursPerDayChange={(hours) => updateConfig({ flexHoursPerDay: hours })}
          onFlexBudgetChange={(amount) => updateConfig({ flexBudgetPerYear: { [year]: amount } })}
          remainingWorkDays={remainingWorkDays}
          defaultNoteText={defaultNoteText}
          onDefaultNoteTextChange={setDefaultNoteText}
          apiError={home.isError || holidaysError || schoolError || comparison.isError}
          onRetryApi={handleRetryApi}
          onOpenSubscribe={() => setShowSubscribeDialog(true)}
          onOpenShare={() => setShowShareDialog(true)}
        />

        <Toolbar
          year={year} onYearChange={setYear}
          selectedType={selectedType} onTypeChange={setSelectedType}
          showHeatmap={showHeatmap} onToggleHeatmap={(v) => updateConfig({ showHeatmap: v })}
          showPublicHolidays={showPublicHolidays} onTogglePublicHolidays={(v) => updateConfig({ showPublicHolidays: v })}
          showSchoolHolidays={showSchoolHolidays} onToggleSchoolHolidays={(v) => updateConfig({ showSchoolHolidays: v })}
          showBridgeDays={showBridgeDays} onToggleBridgeDays={(v) => updateConfig({ showBridgeDays: v })}
          vacationDaysUsed={vacationDaysUsed} vacationDaysTotal={vacationDaysTotal}
          flex={flex} remainingWorkDays={remainingWorkDays}
          canUndo={canUndo}
          onUndo={() => void handleUndo()}
          entries={entries} preferences={isLoggedIn ? (prefs as Record<string, unknown>) : ((config ?? {}) as unknown as Record<string, unknown>)}
          localConfig={isLoggedIn ? null : config}
          onOpenSuggestions={() => setShowSuggestions(true)}
          onOpenClipboardExport={() => setShowClipboardDialog(true)}
          onOpenShare={() => setShowShareDialog(true)}
          onOpenSubscribe={() => setShowSubscribeDialog(true)}
          onImport={handleImport}
          onImportConfig={handleImportConfig}
          onReset={handleReset}
        />

        {/* Interactive Calendar Suggestion Preview & Live Drag Bar */}
        {previewSuggestions.length > 0 && (
          <div className="sticky top-14 z-40 rounded-xl border-2 border-teal-500/70 bg-card/95 p-3 shadow-lg backdrop-blur space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-teal-600 text-white hover:bg-teal-600">
                  <Sparkles className="mr-1 h-3 w-3" /> Interaktive Kalender-Vorschau
                </Badge>
                <span className="font-medium">
                  Gesamt: <strong>{formatDays(previewTotalCost)} Urlaubstage</strong> →{' '}
                  <strong className="text-teal-600 dark:text-teal-400">{previewTotalFree} freie Tage</strong>{' '}
                  (Ø {previewAvgEff.toFixed(1)}x Effizienz)
                </span>
                <span className="hidden lg:inline text-muted-foreground">
                  · Ziehe <strong>◀ / ▶</strong> an den Enden im Kalender zum Kürzen/Verlängern oder ziehe die Mitte zum Verschieben!
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowSuggestions(true)}
                >
                  <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
                  Optionen
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => {
                    const allDates = [...new Set(previewSuggestions.flatMap(s => s.vacationDays))]
                    handleApplySuggestions(allDates, 'vacation', previewOverwrite)
                    setPreviewSuggestions([])
                  }}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Alle {previewSuggestions.length} übernehmen
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setPreviewSuggestions([])}
                >
                  <X className="h-3.5 w-3.5" />
                  Beenden
                </Button>
              </div>
            </div>

            {/* Block Selector Pills */}
            <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
              {previewSuggestions.map((b, idx) => {
                const active = idx === selectedPreviewIndex
                return (
                  <button
                    key={b.id ?? idx}
                    type="button"
                    onClick={() => setSelectedPreviewIndex(idx)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-colors ${
                      active
                        ? 'border-teal-600 bg-teal-600/15 font-semibold text-teal-800 dark:text-teal-200 ring-1 ring-teal-500'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    <span>{b.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({formatDays(b.cost)} UT → {b.freeDaysGained}T · {b.efficiency.toFixed(1)}x)
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Active Block Live Inspector & Controls */}
            {activePreviewBlock && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-teal-700 dark:text-teal-300">
                    {activePreviewBlock.label}:
                  </span>
                  <span>
                    {format(parseISO(activePreviewBlock.startDate), 'dd.MM.yyyy')} – {format(parseISO(activePreviewBlock.endDate), 'dd.MM.yyyy')}
                  </span>
                  <Badge variant="secondary" className="text-[11px]">
                    {formatDays(activePreviewBlock.cost)} Urlaubstage → {activePreviewBlock.freeDaysGained} Tage frei ({activePreviewBlock.efficiency.toFixed(1)}x)
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="inline-flex items-center rounded border bg-background px-1 py-0.5 gap-0.5">
                    <span className="text-muted-foreground px-1">Start:</span>
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'start', -1)} className="hover:bg-muted rounded px-1.5 font-bold">−1T</button>
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'start', 1)} className="hover:bg-muted rounded px-1.5 font-bold">+1T</button>
                  </div>
                  <div className="inline-flex items-center rounded border bg-background px-1 py-0.5 gap-0.5">
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'move', -1)} className="hover:bg-muted rounded px-1 flex items-center"><ChevronLeft className="h-3.5 w-3.5" /></button>
                    <span className="text-muted-foreground px-1">Verschieben</span>
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'move', 1)} className="hover:bg-muted rounded px-1 flex items-center"><ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="inline-flex items-center rounded border bg-background px-1 py-0.5 gap-0.5">
                    <span className="text-muted-foreground px-1">Ende:</span>
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'end', -1)} className="hover:bg-muted rounded px-1.5 font-bold">−1T</button>
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'end', 1)} className="hover:bg-muted rounded px-1.5 font-bold">+1T</button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2.5 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => {
                      handleApplySuggestions(activePreviewBlock.vacationDays, 'vacation', false)
                      setPreviewSuggestions(prev => prev.filter((_, i) => i !== selectedPreviewIndex))
                      setSelectedPreviewIndex(0)
                    }}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Übernehmen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      setPreviewSuggestions(prev => prev.filter((_, i) => i !== selectedPreviewIndex))
                      setSelectedPreviewIndex(0)
                    }}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Verwerfen
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

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
            workDays={workDays}
            compareHolidays={comparison.holidays}
            compareLabels={compareSubdivisions.map(code => subdivisionsData.find((s: { code: string }) => s.code === code)?.name?.find((n: { language: string }) => n.language === 'DE')?.text ?? code)}
            showHeatmap={showHeatmap} showPublicHolidays={showPublicHolidays} showSchoolHolidays={showSchoolHolidays}
            bridgeDaySet={bridgeDaySet} bridgeDayMap={bridgeDayMap}
            showBridgeDays={showBridgeDays} showOtherMonthDays={showOtherMonthDays}
            overBudgetDates={overBudgetDates}
            overlays={sharedOverlays}
            previewSuggestions={previewSuggestions}
            selectedPreviewIndex={selectedPreviewIndex}
            onSelectPreviewBlock={setSelectedPreviewIndex}
            onDragPreviewBlock={handleDragPreviewBlock}
            onToggle={handleToggle}
            onSelectRange={handleSelectRange}
            selectedType={selectedType}
            onHover={setHoveredDay}
            onSelectDate={(date) => setActiveDayKey(getDateKey(date))}
          />
        )}

        {hoveredDay && (
          <div className={`pointer-events-none fixed bottom-4 ${hoveredDay.anchorX !== undefined && hoveredDay.anchorX > window.innerWidth / 2 ? 'left-4' : 'right-4'} z-50 hidden max-w-xs rounded-lg border border-border bg-card p-3 text-sm text-card-foreground shadow-lg supports-[bottom:env(safe-area-inset-bottom)]:bottom-[calc(1rem+env(safe-area-inset-bottom))] md:block`}>
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

        {/* Color & Heatmap Legend */}
        <div className="rounded-xl border bg-card p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-blue-600 shadow-2xs" /> Urlaub</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-red-600" /> Über Budget</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-purple-600" /> Gleittag</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-slate-500 dark:bg-slate-600" /> Notiz</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-emerald-100 border border-emerald-400 dark:bg-emerald-500/30 dark:border-emerald-500/60" /> Feiertag</span>
              {!showHeatmap && (
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-amber-100/85 border border-amber-300 dark:bg-amber-400/20 dark:border-amber-400/50" /> Eigene Schulferien</span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-3.5 rounded-sm bg-orange-50 ring-1 ring-inset ring-orange-400 border-l-[3px] border-l-emerald-500 dark:bg-orange-500/20 flex items-center justify-center text-[8px] font-bold text-orange-600 dark:text-orange-300">←</span>
                <span>Brückentag (Pfeil zeigt zum Feiertag)</span>
              </span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-muted/60 opacity-45 grayscale border" /> Vergangener Tag</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5" />
              <span>
                Mehrfachauswahl: <strong>Gedrückt halten &amp; ziehen</strong> oder <kbd className="rounded border bg-muted px-1 py-0.5">Shift</kbd>+Klick · Kürzel: <kbd className="rounded border bg-muted px-1 py-0.5">U</kbd> <kbd className="rounded border bg-muted px-1 py-0.5">G</kbd> <kbd className="rounded border bg-muted px-1 py-0.5">N</kbd> <kbd className="rounded border bg-muted px-1 py-0.5">P</kbd>
              </span>
            </div>
          </div>

          {showHeatmap && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-foreground">Ferien-Heatmap (Wie viele Regionen haben frei?):</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-sm bg-lime-200 border border-lime-400 dark:bg-lime-500/30" />
                  <span>Wenig (1–25 %)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-sm bg-amber-300 border border-amber-500 dark:bg-amber-500/40" />
                  <span>Mittel (26–50 %)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-sm bg-orange-400 border border-orange-600 dark:bg-orange-500/55" />
                  <span>Viele (51–75 %)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-sm bg-rose-500 border border-rose-700 dark:bg-rose-500/70" />
                  <span>Sehr viele (&gt; 75 %)</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-foreground/85">
                <span className="w-3.5 h-3.5 rounded-sm ring-1 ring-inset ring-foreground/45 border-b-2 border-b-foreground/65 dark:ring-white/60 dark:border-b-white/75 bg-amber-200 dark:bg-amber-500/30" />
                <span>Feiner Rahmen + Unterlinie = Schulferien in deinem eigenen Bundesland</span>
              </div>
            </div>
          )}
        </div>

        {/* Helpful Ratgeber & SEO FAQ Section */}
        <details className="group rounded-xl border bg-card/60 p-4 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground">
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              Tipps zur optimalen Urlaubsplanung {year}, Brückentage &amp; Häufige Fragen
            </span>
            <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs text-muted-foreground leading-relaxed border-t pt-4">
            <div className="space-y-1.5">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Maximale freie Tage durch Brückentage &amp; 4-Tage-Woche
              </h3>
              <p>
                Mit dem Button <strong>„Planen“</strong> (Taste <kbd className="rounded border px-1">P</kbd>) analysiert der smarte Algorithmus alle gesetzlichen Feiertage, deine individuellen Arbeitstage (z.B. 5-Tage- oder 4-Tage-Woche) und Schulferien. Du kannst die Vorschläge anschließend direkt auf dem Kalender verschieben oder an den Enden länger/kürzer ziehen.
              </p>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5 text-primary" />
                Mehrfachauswahl &amp; gemeinsam planen
              </h3>
              <p>
                Halte die Maustaste auf einem Tag gedrückt und ziehe über mehrere Tage (oder nutze <kbd className="rounded border px-1">Shift</kbd> + Klick), um ganze Zeiträume als Urlaub, Gleittag oder mehrtägige Notiz/Event einzutragen. Über <strong>„Teilen“</strong> kannst du Pläne mit Familie oder Kollegen vergleichen und gemeinsam bearbeiten.
              </p>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                <CalendarPlus className="h-3.5 w-3.5 text-primary" />
                Google Kalender, Outlook &amp; Vorgesetzte
              </h3>
              <p>
                Binde deinen Urlaubsplan per Direkt-Button in <strong>Google Kalender</strong>, Apple Kalender oder Outlook ein und entscheide selbst, ob Feiertage, Schulferien oder Notizen enthalten sein sollen. Für deinen Urlaubsantrag beim Arbeitgeber gibt es fertige E-Mail-, Tabellen- und Chat-Vorlagen zum Kopieren.
              </p>
            </div>
          </div>
        </details>
      </main>
    </div>
  )
}
