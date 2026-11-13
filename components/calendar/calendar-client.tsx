'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Toolbar, type SharedPlanStatSummary } from '@/components/calendar/toolbar'
import { YearView, type CalendarInteractionMode } from '@/components/calendar/year-view'
import { SettingsPanel } from '@/components/calendar/settings-panel'
import { SuggestionsPanel } from '@/components/calendar/suggestions-panel'
import { ClipboardExportDialog } from '@/components/calendar/clipboard-export-dialog'
import { ShareDialog, GUEST_OWNED_SHARES_STORAGE_KEY, type StoredShareLink } from '@/components/calendar/share-dialog'
import { SubscribeDialog } from '@/components/calendar/subscribe-dialog'
import { ScorecardDialog } from '@/components/calendar/scorecard-dialog'
import { ApprovalSheetDialog } from '@/components/calendar/approval-sheet-dialog'
import { PrintSummaryHeader, PrintSummaryFooter } from '@/components/calendar/print-summary'
import { ComparisonTimeline } from '@/components/calendar/comparison-timeline'
import { computePlanScorecard } from '@/lib/vacation-scorecard'
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
  formatWorkDaysLabel,
  isStandardFiveDayWeek,
  remainingWorkDays as countRemainingWorkDays,
  summarizeFlex,
  summarizeVacation,
  summarizeCarryover,
  vacationBudget,
  carryoverBudget,
} from '@/lib/vacation-accounting'
import { recalculateSuggestionBlock, type VacationSuggestionBlock } from '@/lib/vacation-suggester'
import { decodeSharePayload, type ImportData } from '@/lib/export'
import { updateAnalyticsContext } from '@/components/analytics/analytics-heartbeat'
import { SEO_REGIONS } from '@/lib/seo-regions'
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
  StickyNote,
  Trophy,
  MapPin,
  BarChart3,
  CalendarDays,
  Undo2,
  ArrowLeftRight,
} from 'lucide-react'
import { useProfile, useUpdatePreferences } from '@/hooks/use-profile'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parsePreferences, parseEntry, countryChangePatch, mergeSharedOverlays } from '@/lib/preferences'
import { parseISO, format, eachDayOfInterval, differenceInCalendarDays } from 'date-fns'
import { de } from 'date-fns/locale'
import type { EntryType, Holiday, LocalConfig, PreferencesPatch, SharedPlanOverlay, UserPreferences } from '@/types'
import type { DayInfo, SharedDayItem } from '@/components/calendar/day-cell'

interface CalendarClientProps {
  userId?: string
  preferences: Record<string, unknown>
  isLoggedIn: boolean
  initialTodayKey?: string
  initialYear?: number
  initialCountry?: string
  initialSubdivision?: string
}

const SHARED_OVERLAYS_STORAGE_KEY = 'urlaubsplaner_shared_overlays_v1'
const GUEST_IMPORT_DISMISSED_KEY = 'urlaubsplaner_guest_import_dismissed_v1'
const OVERLAY_COLORS = ['#0d9488', '#db2777', '#7c3aed', '#ea580c', '#0284c7']
const SHORT_MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

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

function hasVisibleDayInfo(day: DayInfo | null): boolean {
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
  const viewerHasVacationOrFlex = day.entry?.type === 'vacation' || day.entry?.type === 'gleittag' || day.entry?.type === 'special'
  const partnerHasFree = Boolean(
    day.sharedItems?.some(s => s.type === 'vacation' || s.type === 'gleittag' || s.type === 'special' || s.type === 'off_day'),
  )

  return (
    <>
      <p className="font-semibold">{format(day.date, 'dd.MM.yyyy (EEEE)', { locale: de })}</p>
      {day.suggestionPreview && (
        <div className="my-1 rounded-md border border-teal-500/40 bg-teal-500/10 p-1.5 text-xs text-teal-700 dark:text-teal-300">
          <p className="font-semibold">✨ Vorschlag: {day.suggestionPreview.label}</p>
          <p>
            {formatDays(day.suggestionPreview.cost)} UT → <strong>{day.suggestionPreview.freeDaysGained} Tage frei</strong> ({day.suggestionPreview.efficiency.toFixed(1)}x Effizienz)
          </p>
          <p className="text-[10px] opacity-85">Ziehe ◀ / ▶ an den Enden oder verschiebe den Block direkt im Kalender.</p>
        </div>
      )}
      {day.publicHoliday && (
        <div className="flex flex-wrap items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
          <span>🎉 {day.publicHoliday}</span>
          {day.isPublicHolidayRegional && (
            <span className="text-[10px] rounded bg-emerald-500/15 px-1 py-0.5 text-emerald-700 dark:text-emerald-300 font-semibold">
              Bundesland-Feiertag
            </span>
          )}
        </div>
      )}
      {viewerHasVacationOrFlex && day.publicHoliday && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1.5 text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
          <p className="font-semibold">💡 Gesetzlicher Feiertag</p>
          <p>An diesem Tag hast du bereits einen Feiertag. Wenn du hier arbeitsfrei hast, sparst du deinen Urlaubstag!</p>
        </div>
      )}
      {day.schoolHoliday && (
        <p className="text-sky-600 dark:text-sky-400 font-medium">
          🏫 Eigene Schulferien: {day.schoolHoliday}
          {day.entry?.type === 'vacation' && <span className="ml-1 text-[11px] text-sky-500 dark:text-sky-300">(im Urlaubszeitraum)</span>}
        </p>
      )}
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
        <p
          className={
            day.entry.type === 'vacation'
              ? 'text-blue-500 font-medium'
              : day.entry.type === 'gleittag'
                ? 'text-purple-500 font-medium'
                : day.entry.type === 'special'
                  ? 'text-cyan-600 dark:text-cyan-400 font-medium'
                  : 'text-muted-foreground'
          }
        >
          {day.entry.type === 'vacation'
            ? '🌴 Geplanter Urlaub'
            : day.entry.type === 'gleittag'
              ? '⏰ Geplanter Gleittag'
              : day.entry.type === 'special'
                ? `✨ Sonderurlaub / Frei${day.entry.title ? `: ${day.entry.title}` : ''}`
                : `📝 ${day.entry.title ?? 'Notiz'}`}
        </p>
      )}
      {day.noteEntry && day.noteEntry !== day.entry && (
        <p className="text-xs text-muted-foreground">
          📝 Notiz: {day.noteEntry.title ?? ''}
        </p>
      )}
      {Boolean(day.sharedItems?.length) && (
        <div className="mt-1.5 border-t pt-1.5 space-y-1">
          {viewerHasVacationOrFlex && partnerHasFree && (
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              🤝 Gemeinsam frei an diesem Tag
            </p>
          )}
          {day.sharedItems!.map((shared, i) => (
            <p key={i} className="text-xs flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                  shared.type === 'off_day' ? 'border border-dashed bg-transparent' : ''
                }`}
                style={
                  shared.type === 'off_day'
                    ? { borderColor: shared.color }
                    : { backgroundColor: shared.color }
                }
              />
              <span className="font-medium">{shared.label}:</span>
              <span>
                {shared.type === 'vacation'
                  ? 'Urlaub'
                  : shared.type === 'gleittag'
                    ? 'Gleittag'
                    : shared.type === 'off_day'
                      ? `Regulär frei (${shared.title || 'Teilzeit/4-Tage'})`
                      : shared.title || 'Notiz'}
              </span>
            </p>
          ))}
        </div>
      )}
    </>
  )
}

function mapApiShareToOverlay(
  shareToken: string,
  data: Record<string, unknown>,
  color: string,
  enabled: boolean,
): SharedPlanOverlay {
  const id = `token-${shareToken.slice(0, 10)}`
  const rawEntries = Array.isArray(data.entries) ? data.entries : []
  const mappedEntries = rawEntries.map((e: { date: string; type: EntryType; title?: string | null }) => ({
    date: String(e.date).slice(0, 10),
    type: e.type,
    ...(e.title ? { title: e.title } : {}),
  }))
  const ownerName = typeof data.ownerName === 'string' && data.ownerName ? data.ownerName : undefined
  const baseLabel = typeof data.label === 'string' && data.label ? data.label : 'Geteilter Plan'
  const label = ownerName && !baseLabel.includes(ownerName) ? `${baseLabel} (${ownerName})` : baseLabel

  return {
    id,
    label,
    ownerName,
    token: shareToken,
    permission: data.permission === 'edit' ? 'edit' : 'view',
    color,
    enabled,
    country: typeof data.country === 'string' ? data.country : undefined,
    subdivision: typeof data.subdivision === 'string' ? data.subdivision : undefined,
    workDays: Array.isArray(data.workDays) ? (data.workDays as number[]) : undefined,
    vacationDays: typeof data.vacationDays === 'number' ? data.vacationDays : undefined,
    vacationDaysPerYear:
      data.vacationDaysPerYear && typeof data.vacationDaysPerYear === 'object'
        ? (data.vacationDaysPerYear as Record<string, number>)
        : undefined,
    halfDaysChristmas: typeof data.halfDaysChristmas === 'boolean' ? data.halfDaysChristmas : undefined,
    countWeekendsAsVacation:
      typeof data.countWeekendsAsVacation === 'boolean' ? data.countWeekendsAsVacation : undefined,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    entries: mappedEntries,
  }
}

export function CalendarClient({
  preferences: serverPrefs,
  isLoggedIn,
  initialTodayKey,
  initialYear,
  initialCountry,
  initialSubdivision,
}: CalendarClientProps) {
  const [todayKey, setTodayKey] = useState(() => initialTodayKey ?? format(new Date(), 'yyyy-MM-dd'))
  const [year, setYear] = useState(
    () => initialYear ?? Number((initialTodayKey ?? format(new Date(), 'yyyy-MM-dd')).slice(0, 4))
  )

  // Align todayKey with the browser's local calendar date after hydration and across midnight
  // without causing an SSR/client hydration mismatch when UTC and local dates differ.
  useEffect(() => {
    const syncToday = () => {
      const localToday = format(new Date(), 'yyyy-MM-dd')
      setTodayKey(prev => (prev === localToday ? prev : localToday))
    }
    syncToday()
    const timer = window.setInterval(syncToday, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const [selectedType, setSelectedType] = useState<EntryType>('vacation')
  const [localConfig, setConfig] = useState<LocalConfig | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showClipboardDialog, setShowClipboardDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false)
  const [showScorecardDialog, setShowScorecardDialog] = useState(false)
  const [showApprovalSheetDialog, setShowApprovalSheetDialog] = useState(false)
  const [printMode, setPrintMode] = useState<'calendar' | 'request'>('calendar')
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid')
  const [arrivedViaShareLabel, setArrivedViaShareLabel] = useState<string | null>(null)
  const [hoveredDay, setHoveredDay] = useState<DayInfo | null>(null)
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const [mobileMode, setMobileMode] = useState<'inspect' | 'edit' | 'range'>('inspect')
  const [rangeAnchorKey, setRangeAnchorKey] = useState<string | null>(null)
  const [mobileNoteDraft, setMobileNoteDraft] = useState('')
  const [mobilePreviewExpanded, setMobilePreviewExpanded] = useState(false)
  const [defaultNoteText, setDefaultNoteText] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsCompactViewport(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setRangeAnchorKey(null)
    setActiveDayKey(null)
  }, [year])

  useEffect(() => {
    if (mobileMode !== 'range') setRangeAnchorKey(null)
  }, [mobileMode])
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([])
  const [undoBusy, setUndoBusy] = useState(false)
  const [sharedOverlays, setSharedOverlays] = useState<SharedPlanOverlay[]>(() => {
    const initial = (serverPrefs as UserPreferences | undefined)?.sharedOverlays
    return Array.isArray(initial) ? initial : []
  })
  const [activeCollab, setActiveCollab] = useState<{
    token: string
    label: string
    ownerName: string
    entries: Array<{ id?: string; date: string; type: EntryType; title?: string | null }>
  } | null>(null)
  const [collabMode, setCollabMode] = useState<'overlay' | 'edit'>('overlay')
  const [guestEntriesCount, setGuestEntriesCount] = useState(0)
  const [guestImportDismissed, setGuestImportDismissed] = useState(false)

  const profile = useProfile(isLoggedIn)
  const updatePreferences = useUpdatePreferences()
  const queryClient = useQueryClient()
  const [importBusy, setImportBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const prefs = profile.data?.preferences ?? serverPrefs

  // Interactive Calendar Suggestion Preview state
  const [previewSuggestions, setPreviewSuggestions] = useState<VacationSuggestionBlock[]>([])
  const [previewOverwrite, setPreviewOverwrite] = useState(false)
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0)

  const persistOverlays = useCallback(
    (next: SharedPlanOverlay[]) => {
      try {
        localStorage.setItem(SHARED_OVERLAYS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      if (isLoggedIn) {
        updatePreferences.mutate({ sharedOverlays: next })
      } else {
        setConfig(prev => {
          const updated = applyConfigPatch(prev ?? loadConfig(), { sharedOverlays: next })
          saveConfig(updated)
          return updated
        })
      }
    },
    [isLoggedIn, updatePreferences],
  )

  useEffect(() => {
    const loaded = loadConfig()
    if (!isLoggedIn) {
      if (initialCountry || initialSubdivision) {
        setConfig({
          ...loaded,
          ...(initialCountry ? { country: initialCountry } : {}),
          ...(initialSubdivision
            ? { subdivision: initialSubdivision, holidayGroup: undefined }
            : initialCountry && initialCountry !== loaded.country
              ? { subdivision: undefined, holidayGroup: undefined }
              : {}),
        })
      } else {
        setConfig(loaded)
      }
    } else {
      setGuestEntriesCount(loaded.entries?.length ?? 0)
      try {
        setGuestImportDismissed(localStorage.getItem(GUEST_IMPORT_DISMISSED_KEY) === '1')
      } catch {
        // ignore
      }
    }
  }, [isLoggedIn, initialCountry, initialSubdivision])

  // Load saved shared plan overlays from localStorage and sync with account preferences across devices
  const initialOverlaySyncRef = useRef(false)
  const lastServerOverlaysSigRef = useRef<string | null>(null)
  const serverOverlays = (prefs as UserPreferences | undefined)?.sharedOverlays

  useEffect(() => {
    let localOverlays: SharedPlanOverlay[] = []
    try {
      const raw = localStorage.getItem(SHARED_OVERLAYS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) localOverlays = parsed
      }
    } catch {
      // ignore
    }

    if (!isLoggedIn) {
      if (!initialOverlaySyncRef.current) {
        initialOverlaySyncRef.current = true
        const fromConfig = loadConfig().sharedOverlays ?? []
        const merged = mergeSharedOverlays(fromConfig, localOverlays)
        if (merged.length > 0) setSharedOverlays(merged)
      }
      return
    }

    const accountList = Array.isArray(serverOverlays) ? serverOverlays : []
    const serverSig = JSON.stringify(accountList.map(o => [o.id, o.token, o.enabled, o.color, o.label]))

    if (!initialOverlaySyncRef.current) {
      if (profile.isLoading) return
      initialOverlaySyncRef.current = true
      lastServerOverlaysSigRef.current = serverSig
      const merged = mergeSharedOverlays(accountList, localOverlays)
      setSharedOverlays(merged)
      try {
        localStorage.setItem(SHARED_OVERLAYS_STORAGE_KEY, JSON.stringify(merged))
      } catch {
        // ignore
      }
      // If this browser had local overlays not yet stored in the account, upload them once
      if (merged.length > accountList.length) {
        updatePreferences.mutate({ sharedOverlays: merged })
      }
      return
    }

    if (serverSig !== lastServerOverlaysSigRef.current) {
      lastServerOverlaysSigRef.current = serverSig
      setSharedOverlays(accountList)
      try {
        localStorage.setItem(SHARED_OVERLAYS_STORAGE_KEY, JSON.stringify(accountList))
      } catch {
        // ignore
      }
    }
  }, [isLoggedIn, profile.isLoading, serverOverlays, updatePreferences])

  const saveSharedOverlays = useCallback(
    (next: SharedPlanOverlay[]) => {
      setSharedOverlays(next)
      persistOverlays(next)
    },
    [persistOverlays],
  )

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
      } else if (trimmed.length > 48 && !trimmed.startsWith('g_')) {
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
            country: decoded.country,
            subdivision: decoded.subdivision,
            workDays: decoded.workDays,
            vacationDays: decoded.vacationDays,
            entries: decoded.entries,
          }
          const updated = exists ? prev.map(o => o.id === id ? nextOverlay : o) : [...prev, nextOverlay]
          persistOverlays(updated)
          return updated
        })
        return true
      }

      if (shareToken) {
        const res = await fetch(`/api/shares/${encodeURIComponent(shareToken)}?_t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!res.ok) return false
        const data = (await res.json()) as Record<string, unknown>
        const id = `token-${shareToken.slice(0, 10)}`
        setSharedOverlays(prev => {
          const exists = prev.find(o => o.id === id || o.token === shareToken)
          const color = exists?.color ?? OVERLAY_COLORS[prev.length % OVERLAY_COLORS.length]
          const nextOverlay = mapApiShareToOverlay(shareToken, data, color, true)
          const updated = exists
            ? prev.map(o => (o.id === id || o.token === shareToken ? nextOverlay : o))
            : [...prev, nextOverlay]
          persistOverlays(updated)
          return updated
        })
        if (data.permission === 'edit') {
          setActiveCollab({
            token: shareToken,
            label: typeof data.label === 'string' ? data.label : 'Geteilter Plan',
            ownerName: typeof data.ownerName === 'string' ? data.ownerName : 'Partner',
            entries: (Array.isArray(data.entries) ? data.entries : []) as Array<{
              id?: string
              date: string
              type: EntryType
              title?: string | null
            }>,
          })
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }, [persistOverlays])

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
            country: decoded.country,
            subdivision: decoded.subdivision,
            workDays: decoded.workDays,
            vacationDays: decoded.vacationDays,
            entries: decoded.entries,
          }
          const updated = exists ? prev.map(o => o.id === id ? nextOverlay : o) : [...prev, nextOverlay]
          persistOverlays(updated)
          return updated
        })
        setArrivedViaShareLabel(decoded.label)
        setSyncMessage(`Geteilter Plan „${decoded.label}“ wurde im Kalender eingeblendet.`)
      }
    }

    if (shareToken) {
      void (async () => {
        try {
          const res = await fetch(`/api/shares/${encodeURIComponent(shareToken)}?_t=${Date.now()}`, {
            cache: 'no-store',
          })
          if (!res.ok) return
          const data = (await res.json()) as Record<string, unknown>
          const id = `token-${shareToken.slice(0, 10)}`
          setSharedOverlays(prev => {
            const exists = prev.find(o => o.id === id || o.token === shareToken)
            const color = exists?.color ?? OVERLAY_COLORS[prev.length % OVERLAY_COLORS.length]
            const nextOverlay = mapApiShareToOverlay(shareToken, data, color, true)
            const updated = exists
              ? prev.map(o => (o.id === id || o.token === shareToken ? nextOverlay : o))
              : [...prev, nextOverlay]
            persistOverlays(updated)
            return updated
          })
          const label = typeof data.label === 'string' ? data.label : 'Geteilter Plan'
          const ownerName = typeof data.ownerName === 'string' ? data.ownerName : 'Partner'
          setArrivedViaShareLabel(`${label} (${ownerName})`)
          if (data.permission === 'edit') {
            setActiveCollab({
              token: shareToken,
              label,
              ownerName,
              entries: (Array.isArray(data.entries) ? data.entries : []) as Array<{
                id?: string
                date: string
                type: EntryType
                title?: string | null
              }>,
            })
            setSyncMessage(`Geteilter Plan „${label}“ von ${ownerName} geladen. Du kannst ihn vergleichen oder direkt gemeinsam bearbeiten!`)
          } else {
            setSyncMessage(`Geteilter Plan „${label}“ von ${ownerName} wurde zum Vergleichen eingeblendet.`)
          }
        } catch {
          // ignore
        }
      })()
    }
  }, [persistOverlays])

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
  const baseVacationDaysTotal = vacationBudget(config ?? {}, year)
  const carryoverDaysTotal = carryoverBudget(config ?? {}, year)
  const vacationDaysTotal = baseVacationDaysTotal + carryoverDaysTotal

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
  } , [activeCollab, collabMode, baseEntries, year])

  // Sync active region and planned entry count with the global AnalyticsHeartbeat
  useEffect(() => {
    updateAnalyticsContext({
      country,
      subdivision,
      plannedDaysCount: baseEntries.length,
    })
  }, [country, subdivision, baseEntries.length])

  const { data: publicHolidays = [], isError: holidaysError, refetch: refetchHolidays } = useHolidays({
    country, subdivision, year, type: 'public', enabled: locationReady,
  })
  const { data: schoolHolidays = [], isError: schoolError, isLoading: schoolLoading, refetch: refetchSchool } = useHolidays({
    country, subdivision, group: region.group, year, type: 'school', enabled: showSchoolHolidays && locationReady && !groupsLoading,
  })
  const groupCodes = useMemo(() => new Set(groupsData.map(g => g.code)), [groupsData])
  const compareRegions = useMemo(() => compareSubdivisions.map(code => ({ code, kind: groupCodes.has(code) ? 'group' as const : 'subdivision' as const })), [compareSubdivisions, groupCodes])
  const comparison = useCompareHolidays(country, compareRegions, year, (showHeatmap || viewMode === 'timeline') && !groupsLoading)
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
  const carryoverSummary = useMemo(
    () => summarizeCarryover(entries, carryoverDaysTotal, year, { holidayDates, halfDaysChristmas, countWeekendsAsVacation, workDays }),
    [entries, carryoverDaysTotal, year, holidayDates, halfDaysChristmas, countWeekendsAsVacation, workDays]
  )
  const overBudgetDates = summary.overBudget
  const vacationDaysUsed = summary.used
  const gleittageCount = entries.filter(e => e.type === 'gleittag').length
  const flex = summarizeFlex(gleittageCount, config ?? {}, year)
  const remainingWorkDays = countRemainingWorkDays(year, entries, { holidayDates, countWeekendsAsVacation, workDays }, todayKey)
  const vacationDateSet = useMemo(
    () => new Set(entries.filter(e => e.type === 'vacation').map(e => e.date.split('T')[0])),
    [entries]
  )

  // ── Real-time synchronization of shared plans ──────────────────────────────
  // Server-Sent Events push changes instantly; BroadcastChannel syncs other tabs
  // of the same browser; a short visibility-aware poll covers proxies that buffer SSE.
  const liveTokens = useMemo(
    () => [...new Set(sharedOverlays.map(o => o.token).filter((t): t is string => Boolean(t)))].sort(),
    [sharedOverlays],
  )
  const liveTokensKey = liveTokens.join(',')
  const lastOverlaySignatureRef = useRef(new Map<string, string>())
  const broadcastRef = useRef<BroadcastChannel | null>(null)

  const refreshLiveOverlays = useCallback(async (onlyTokens?: string[]) => {
    const targets = onlyTokens?.length ? onlyTokens.filter(t => liveTokens.includes(t)) : liveTokens
    if (targets.length === 0) return
    const results = await Promise.all(targets.map(async token => {
      try {
        const res = await fetch(`/api/shares/${encodeURIComponent(token)}?_t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return null
        return { token, data: (await res.json()) as Record<string, unknown> }
      } catch {
        return null
      }
    }))
    const fresh = results.filter((r): r is { token: string; data: Record<string, unknown> } => Boolean(r))
    if (fresh.length === 0) return

    // Skip state updates when nothing changed to avoid needless re-renders.
    const changed = fresh.filter(({ token, data }) => {
      const signature = JSON.stringify([data.entries, data.workDays, data.vacationDays, data.vacationDaysPerYear, data.label, data.permission, data.halfDaysChristmas, data.countWeekendsAsVacation])
      if (lastOverlaySignatureRef.current.get(token) === signature) return false
      lastOverlaySignatureRef.current.set(token, signature)
      return true
    })
    if (changed.length === 0) return

    setSharedOverlays(prev => {
      const updated = prev.map(overlay => {
        const match = overlay.token ? changed.find(c => c.token === overlay.token) : undefined
        return match ? mapApiShareToOverlay(match.token, match.data, overlay.color, overlay.enabled) : overlay
      })
      try {
        localStorage.setItem(SHARED_OVERLAYS_STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // ignore
      }
      return updated
    })
    setActiveCollab(prev => {
      if (!prev) return prev
      const match = changed.find(c => c.token === prev.token)
      if (!match) return prev
      return {
        ...prev,
        entries: (Array.isArray(match.data.entries) ? match.data.entries : []) as typeof prev.entries,
      }
    })
  }, [liveTokens])

  const refreshLiveOverlaysRef = useRef(refreshLiveOverlays)
  useEffect(() => {
    refreshLiveOverlaysRef.current = refreshLiveOverlays
  }, [refreshLiveOverlays])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tokens = liveTokensKey ? liveTokensKey.split(',') : []
    const refresh = (only?: string[]) => void refreshLiveOverlaysRef.current(only)
    if (tokens.length > 0) refresh()

    let eventSource: EventSource | null = null
    if ((tokens.length > 0 || isLoggedIn) && typeof EventSource !== 'undefined') {
      eventSource = new EventSource(`/api/shares/stream?tokens=${encodeURIComponent(liveTokensKey)}`)
      eventSource.onmessage = event => {
        try {
          const payload = JSON.parse(event.data) as { type?: string; tokens?: string[]; selfUpdated?: boolean }
          if (payload.type !== 'plan-updated') return
          if (payload.tokens?.length) refresh(payload.tokens)
          if (payload.selfUpdated) {
            void queryClient.invalidateQueries({ queryKey: ['vacations'] })
            void queryClient.invalidateQueries({ queryKey: ['profile'] })
          }
        } catch {
          // ignore malformed events
        }
      }
    }

    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('urlaubsplaner-live-sync')
      channel.onmessage = event => {
        const data = event.data as { type?: string; tokens?: string[] } | null
        if (data?.type !== 'plan-updated') return
        refresh(data.tokens)
        if (isLoggedIn) void queryClient.invalidateQueries({ queryKey: ['vacations'] })
      }
      broadcastRef.current = channel
    }

    const poll = tokens.length > 0
      ? window.setInterval(() => {
          if (document.visibilityState === 'visible') refresh()
        }, 2500)
      : undefined
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      eventSource?.close()
      channel?.close()
      if (broadcastRef.current === channel) broadcastRef.current = null
      if (poll) window.clearInterval(poll)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [liveTokensKey, isLoggedIn, queryClient])

  // Tell other tabs of this browser that our own plan changed.
  const ownPlanSignature = useMemo(
    () => JSON.stringify(baseEntries.map(e => [e.date.slice(0, 10), e.type, e.title ?? ''])),
    [baseEntries],
  )
  const lastOwnPlanSignatureRef = useRef<string | null>(null)
  useEffect(() => {
    if (lastOwnPlanSignatureRef.current === null) {
      lastOwnPlanSignatureRef.current = ownPlanSignature
      return
    }
    if (lastOwnPlanSignatureRef.current === ownPlanSignature) return
    lastOwnPlanSignatureRef.current = ownPlanSignature
    broadcastRef.current?.postMessage({ type: 'plan-updated', ts: Date.now() })
  }, [ownPlanSignature])

  // Guests: push local changes to their own live share links so viewers update instantly.
  const [guestShareVersion, setGuestShareVersion] = useState(0)
  useEffect(() => {
    if (isLoggedIn || !localConfig) return
    let owned: StoredShareLink[] = []
    try {
      const raw = localStorage.getItem(GUEST_OWNED_SHARES_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) owned = parsed.filter((s: StoredShareLink) => s?.token?.startsWith('g_') && s.ownerSecret)
    } catch {
      return
    }
    if (owned.length === 0) return
    const { entries: allEntries } = localConfig
    // Only send the fields a viewer needs; the server validates them strictly.
    const guestPreferences = Object.fromEntries(
      Object.entries({
        country: localConfig.country,
        subdivision: localConfig.subdivision,
        holidayGroup: localConfig.holidayGroup,
        workDays: localConfig.workDays,
        vacationDaysPerYear: localConfig.vacationDaysPerYear,
        halfDaysChristmas: localConfig.halfDaysChristmas,
        countWeekendsAsVacation: localConfig.countWeekendsAsVacation,
      }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    )
    const timer = window.setTimeout(() => {
      for (const share of owned) {
        const sharedEntries = share.includeNotes === false ? allEntries.filter(e => e.type !== 'note') : allEntries
        void fetch(`/api/shares/${encodeURIComponent(share.token)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerSecret: share.ownerSecret, entries: sharedEntries, preferences: guestPreferences }),
        }).catch(() => {})
      }
      broadcastRef.current?.postMessage({ type: 'plan-updated', tokens: owned.map(s => s.token), ts: Date.now() })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [isLoggedIn, localConfig, guestShareVersion])

  // Remaining vacation claim and workweek model of every embedded shared plan.
  const sharedPlanSummaries = useMemo<SharedPlanStatSummary[]>(() => sharedOverlays.map(overlay => {
    const overlayWorkDays = overlay.workDays?.length ? overlay.workDays : DEFAULT_WORK_DAYS
    const total = vacationBudget({ vacationDays: overlay.vacationDays, vacationDaysPerYear: overlay.vacationDaysPerYear }, year)
    const yearEntries = overlay.entries
      .filter(e => e.date.startsWith(`${year}-`))
      .map((e, i) => ({
        id: `${overlay.id}-${i}`,
        userId: 'shared',
        date: e.date,
        type: e.type,
        title: e.title ?? undefined,
        year,
        createdAt: '',
        updatedAt: '',
      }))
    // Partner and viewer share the same country in most cases; holidays of the viewer are the best local estimate.
    const partnerSummary = summarizeVacation(yearEntries, total, {
      holidayDates: !overlay.country || overlay.country === country ? holidayDates : new Set<string>(),
      halfDaysChristmas: overlay.halfDaysChristmas ?? true,
      countWeekendsAsVacation: overlay.countWeekendsAsVacation ?? false,
      workDays: overlayWorkDays,
    })
    const isDifferentWorkWeek = overlayWorkDays.length !== workDays.length || overlayWorkDays.some(d => !workDays.includes(d))
    return {
      id: overlay.id,
      label: overlay.label,
      color: overlay.color,
      used: partnerSummary.used,
      total,
      remaining: total - partnerSummary.used,
      workDaysLabel: !isStandardFiveDayWeek(overlayWorkDays) || isDifferentWorkWeek ? formatWorkDaysLabel(overlayWorkDays) : undefined,
      isDifferentWorkWeek,
      isLive: Boolean(overlay.token),
    }
  }), [sharedOverlays, year, country, holidayDates, workDays])

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
      if (showSuggestions || showClipboardDialog || showShareDialog || showSubscribeDialog || showScorecardDialog) {
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
      } else if (key === 's' || key === '3') {
        e.preventDefault()
        setSelectedType('special')
      } else if (key === 'n' || key === '4') {
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
    showScorecardDialog,
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

  const handleToggle = useCallback((date: Date, type: EntryType, explicitTitle?: string) => {
    const dateKey = getDateKey(date)

    // Collaborative live-edit mode on a shared plan
    if (activeCollab && collabMode === 'edit') {
      const matching = (key: string) => (e: { date: string; type: string }) => e.type === type && e.date.slice(0, 10) === key
      const existing = activeCollab.entries.find(matching(dateKey))
      const title =
        !existing && type === 'note'
          ? (explicitTitle ?? (defaultNoteText || prompt('Notiz-Text (optional):') || undefined))
          : undefined
      void (async () => {
        try {
          const res = await fetch(`/api/shares/${encodeURIComponent(activeCollab.token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle', date: dateKey, type, title }),
          })
          if (!res.ok) throw new Error()
          broadcastRef.current?.postMessage({ type: 'plan-updated', tokens: [activeCollab.token], ts: Date.now() })
          const refreshed = await fetch(`/api/shares/${encodeURIComponent(activeCollab.token)}?_t=${Date.now()}`, { cache: 'no-store' })
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
    const title =
      !existing && type === 'note'
        ? (explicitTitle ?? (defaultNoteText || prompt('Notiz-Text (optional):') || undefined))
        : undefined
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
  const handleSelectRange = useCallback((startDateDateKey: string, endDateDateKey: string, type: EntryType) => {
    const firstKey = startDateDateKey < endDateDateKey ? startDateDateKey : endDateDateKey
    const lastKey = startDateDateKey < endDateDateKey ? endDateDateKey : startDateDateKey
    const allRangeKeys = eachDayOfInterval({
      start: parseISO(firstKey),
      end: parseISO(lastKey),
    }).map(d => format(d, 'yyyy-MM-dd'))

    // For vacation and gleittag, skip public holidays and non-working weekdays; for special, allow weekends (shift workers) but skip public holidays
    const targetKeys =
      type === 'note'
        ? allRangeKeys
        : type === 'special'
          ? allRangeKeys.filter(k => !holidayDates.has(k))
          : allRangeKeys.filter(k => !holidayDates.has(k) && !isOffDayKey(k, workDays))

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
  }, [holidayDates, workDays, isLoggedIn, entries, localConfig, recordUndo, serverEntries, removeMutation, updateLocalEntries, defaultNoteText, importSavedData])

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
    let localOverlays: SharedPlanOverlay[] = []
    try {
      const raw = localStorage.getItem(SHARED_OVERLAYS_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) localOverlays = parsed
    } catch {
      // ignore
    }
    const mergedOverlays = mergeSharedOverlays(preferences.sharedOverlays ?? [], localOverlays)
    const prefsWithOverlays = {
      ...preferences,
      ...(mergedOverlays.length > 0 ? { sharedOverlays: mergedOverlays } : {}),
    }
    void importSavedData(entries, prefsWithOverlays as Record<string, unknown>, 'Deine lokal gespeicherten Tage und geteilten Pläne wurden in dein Konto übernommen.')
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

  const scorecard = useMemo(
    () =>
      computePlanScorecard({
        year,
        entries,
        totalDays: vacationDaysTotal,
        publicHolidays: combinedPublicHolidays,
        halfDaysChristmas,
        countWeekendsAsVacation,
        workDays,
      }),
    [year, entries, vacationDaysTotal, combinedPublicHolidays, halfDaysChristmas, countWeekendsAsVacation, workDays],
  )

  const triggerPrint = useCallback((mode: 'calendar' | 'request') => {
    setPrintMode(mode)
    window.setTimeout(() => {
      window.print()
    }, 60)
  }, [])

  const todayCalendarYear = Number(todayKey.slice(0, 4))
  const todayMonth = Number(todayKey.slice(5, 7))
  const isFourthQuarterCurrentYear = todayMonth >= 10 && year === todayCalendarYear
  const activeRegionLabel = subdivision ? regionName(subdivision) : country

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
    const map = new Map<string, SharedDayItem[]>()
    for (const overlay of sharedOverlays) {
      if (!overlay.enabled) continue
      if (activeCollab && collabMode === 'edit' && overlay.token === activeCollab.token) continue
      const entryDates = new Set<string>()
      for (const e of overlay.entries) {
        const key = e.date.slice(0, 10)
        entryDates.add(key)
        const list = map.get(key) ?? []
        list.push({ label: overlay.label, color: overlay.color, type: e.type, title: e.title ?? undefined })
        map.set(key, list)
      }
      // Different workweek (e.g. partner Mo–Do, viewer Mo–Fr): mark the partner's regular off-days.
      const overlayWorkDays = overlay.workDays?.length ? overlay.workDays : DEFAULT_WORK_DAYS
      const differs = overlayWorkDays.length !== workDays.length || overlayWorkDays.some(d => !workDays.includes(d))
      if (!differs) continue
      const label = formatWorkDaysLabel(overlayWorkDays)
      for (const day of eachDayOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) })) {
        const key = format(day, 'yyyy-MM-dd')
        if (entryDates.has(key) || !isOffDayKey(key, overlayWorkDays) || isOffDayKey(key, workDays)) continue
        const list = map.get(key) ?? []
        list.push({ label: overlay.label, color: overlay.color, type: 'off_day', title: label })
        map.set(key, list)
      }
    }
    return map
  }, [sharedOverlays, activeCollab, collabMode, workDays, year])

  const activeDayInfo = useMemo(() => {
    if (!activeDayKey) return null

    const date = parseISO(activeDayKey)
    const vacation = entries.find(e => e.type === 'vacation' && e.date.split('T')[0] === activeDayKey)
    const gleittag = entries.find(e => e.type === 'gleittag' && e.date.split('T')[0] === activeDayKey)
    const special = entries.find(e => e.type === 'special' && e.date.split('T')[0] === activeDayKey)
    const note = entries.find(e => e.type === 'note' && e.date.split('T')[0] === activeDayKey)
    const entry = vacation ?? gleittag ?? special ?? note
    const publicHoliday = getHolidayForDate(combinedPublicHolidays, date)
    const schoolHoliday = getHolidayForDate(schoolHolidays, date)
    const bridgeDayInfo = bridgeDayMap.get(activeDayKey)
    const sharedItems = sharedOverlayMap.get(activeDayKey)

    const previewIndex = previewSuggestions.findIndex(block =>
      block.startDate && block.endDate && activeDayKey >= block.startDate && activeDayKey <= block.endDate,
    )
    const matchedPreview = previewIndex >= 0 ? previewSuggestions[previewIndex] : undefined
    const firstVac = matchedPreview?.vacationDays[0]
    const lastVac = matchedPreview?.vacationDays[matchedPreview.vacationDays.length - 1]
    const suggestionPreview = matchedPreview
      ? {
          blockIndex: previewIndex,
          label: matchedPreview.label,
          isVacationDay: matchedPreview.vacationDays.includes(activeDayKey),
          isFirstVacationDay: activeDayKey === firstVac,
          isLastVacationDay: activeDayKey === lastVac,
          isSelectedBlock: previewIndex === selectedPreviewIndex,
          cost: matchedPreview.cost,
          freeDaysGained: matchedPreview.freeDaysGained,
          efficiency: matchedPreview.efficiency,
        }
      : undefined

    const day: DayInfo = {
      date,
      comparisonStates: showHeatmap ? comparison.holidays.flatMap((holidays, i) => getHolidayForDate(holidays, date) ? [regionName(compareSubdivisions[i])] : []) : [],
      publicHoliday: publicHoliday ? getHolidayName(publicHoliday) : undefined,
      isPublicHolidayRegional: Boolean(publicHoliday && !publicHoliday.nationwide),
      schoolHoliday: schoolHoliday ? getHolidayName(schoolHoliday) : undefined,
      isBridgeDay: showBridgeDays && bridgeDaySet.has(activeDayKey),
      bridgeDayInfo,
      entry,
      noteEntry: note,
      sharedItems,
      suggestionPreview,
    }

    return day
  }, [activeDayKey, entries, combinedPublicHolidays, schoolHolidays, bridgeDayMap, bridgeDaySet, showBridgeDays, showHeatmap, comparison.holidays, compareSubdivisions, regionName, sharedOverlayMap, previewSuggestions, selectedPreviewIndex])

  const plannedMonthsSet = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      if (e.date.startsWith(`${year}-`)) {
        set.add(e.date.slice(0, 7))
      }
    }
    return set
  }, [entries, year])

  const handleRangeStep = useCallback((dateKey: string) => {
    if (!rangeAnchorKey) {
      setRangeAnchorKey(dateKey)
      setActiveDayKey(null)
      return
    }
    if (rangeAnchorKey === dateKey) {
      handleToggle(parseISO(dateKey), selectedType)
      setRangeAnchorKey(null)
      return
    }
    handleSelectRange(rangeAnchorKey, dateKey, selectedType)
    setRangeAnchorKey(null)
  }, [rangeAnchorKey, handleToggle, selectedType, handleSelectRange])

  const scrollToMonth = useCallback((targetYear: number, monthIndex: number) => {
    const mm = String(monthIndex + 1).padStart(2, '0')
    if (targetYear !== year) {
      setYear(targetYear)
      window.setTimeout(() => {
        document.getElementById(`month-${targetYear}-${mm}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 120)
      return
    }
    document.getElementById(`month-${targetYear}-${mm}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [year])

  const effectiveInteractionMode: CalendarInteractionMode = isCompactViewport ? mobileMode : 'auto'

  useEffect(() => {
    setMobileNoteDraft(activeDayInfo?.noteEntry?.title ?? '')
  }, [activeDayKey, activeDayInfo?.noteEntry?.title])

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
        partnerOverlays={sharedOverlays}
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

      <ScorecardDialog
        open={showScorecardDialog}
        onClose={() => setShowScorecardDialog(false)}
        regionLabel={activeRegionLabel}
        workDaysLabel={formatWorkDaysLabel(workDays)}
        scorecard={scorecard}
        onOpenSuggestions={() => setShowSuggestions(true)}
      />

      <ApprovalSheetDialog
        open={showApprovalSheetDialog}
        onOpenChange={setShowApprovalSheetDialog}
        year={year}
        regionLabel={activeRegionLabel}
        workDaysLabel={formatWorkDaysLabel(workDays)}
        scorecard={scorecard}
        carryoverDays={carryoverDaysTotal}
        entries={entries}
        config={config?.approvalSheetConfig}
        isLoggedIn={isLoggedIn}
        onSaveConfig={next => updateConfig({ approvalSheetConfig: next })}
        onTriggerPrint={() => triggerPrint('request')}
      />

      <ClipboardExportDialog
        open={showClipboardDialog}
        onClose={() => setShowClipboardDialog(false)}
        entries={entries}
        year={year}
        vacationDaysUsed={vacationDaysUsed}
        vacationDaysTotal={vacationDaysTotal}
        workDays={workDays}
      />

      <ShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        isLoggedIn={isLoggedIn}
        country={country}
        subdivision={subdivision}
        workDays={workDays}
        vacationDaysTotal={vacationDaysTotal}
        preferences={isLoggedIn ? (prefs as Record<string, unknown>) : ((config ?? {}) as unknown as Record<string, unknown>)}
        entries={entries}
        overlays={sharedOverlays}
        sharedPlanSummaries={sharedPlanSummaries}
        onRefreshOverlays={() => refreshLiveOverlays()}
        onGuestShareCreated={() => setGuestShareVersion(v => v + 1)}
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
              ownerName: match.ownerName ?? match.label,
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

      <main className="container space-y-3 sm:space-y-4 py-2.5 sm:py-4 pb-24 md:pb-4">
        <h1 className="sr-only">
          Urlaubsplaner {year} – Brückentage, Schulferien &amp; Optimale Urlaubsplanung
        </h1>
        {/* Guest Welcome & Quick Actions Bar */}
        {!isLoggedIn && (
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 rounded-xl border border-blue-200/80 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/30 px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm text-blue-900 dark:text-blue-100 print:hidden">
            <div className="flex items-start sm:items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0 text-blue-600 dark:text-blue-400" />
              <span className="leading-snug">
                <span className="sm:hidden">
                  Lokal gespeichert.{' '}
                  <a href="/login" className="underline font-semibold hover:text-blue-700 dark:hover:text-blue-300">
                    Anmelden
                  </a>{' '}
                  für Sync.
                </span>
                <span className="hidden sm:inline">
                  Dein Plan wird automatisch <strong>auf diesem Gerät gespeichert</strong>.{' '}
                  <a href="/login" className="underline font-semibold hover:text-blue-700 dark:hover:text-blue-300">
                    Kostenlos anmelden
                  </a>
                  , um ihn auch am Handy oder anderen PCs zu synchronisieren.
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-7 px-2.5 text-xs bg-background/80"
                onClick={() => setShowShareDialog(true)}
              >
                <Share2 className="mr-1.5 h-3.5 w-3.5" />
                <span className="sm:hidden">Teilen</span>
                <span className="hidden sm:inline">Plan teilen</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-7 px-2.5 text-xs bg-background/80"
                onClick={() => setShowSubscribeDialog(true)}
              >
                <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                <span className="sm:hidden">Kalender-Abo</span>
                <span className="hidden sm:inline">In Kalender einbinden</span>
              </Button>
            </div>
          </div>
        )}

        {/* Logged-in Friendly Account Status & Optional Guest Plan Import */}
        {isLoggedIn && !hasSyncError && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card/70 px-3.5 py-2 text-xs text-muted-foreground print:hidden">
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-teal-500/40 bg-teal-50/70 dark:bg-teal-950/30 p-3 text-sm print:hidden">
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

        {/* Guided 1-Click Partner Welcome Card when opening a shared link */}
        {arrivedViaShareLabel && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-emerald-500/45 bg-emerald-500/10 p-3.5 text-sm print:hidden">
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">
                👋 Geteilter Urlaubsplan „{arrivedViaShareLabel}“ ist eingeblendet!
              </p>
              <p className="text-xs text-muted-foreground">
                Wähle in einem Klick, wie du deinen Urlaub für {year} danebenlegen oder gemeinsam abstimmen möchtest:
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => {
                  setArrivedViaShareLabel(null)
                  setShowSuggestions(true)
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Meinen Plan passend dazu optimieren
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 bg-background"
                onClick={() => {
                  setArrivedViaShareLabel(null)
                  setViewMode('timeline')
                }}
              >
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                Vergleichs-Timeline &amp; Überschneidungen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => setArrivedViaShareLabel(null)}
                aria-label="Willkommenskarte schließen"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Shared Overlays Quick Bar when overlays exist */}
        {sharedOverlays.length > 0 && !activeCollab && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-xs print:hidden">
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
              {entries.length === 0 && (
                <span className="text-teal-700 dark:text-teal-300 font-medium">
                  · Deinen Plan danebenlegen? Klicke Tage im Kalender an oder starte den Paar-Optimierer:
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                className="h-6 px-2.5 text-xs gap-1"
                onClick={() => setShowSuggestions(true)}
              >
                <Sparkles className="h-3 w-3 text-teal-600" />
                Gemeinsam planen
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowShareDialog(true)}>
                Verwalten
              </Button>
            </div>
          </div>
        )}

        {/* Compact Quick-Start & Q4 Next-Year Planning Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-teal-500/5 px-2.5 py-2 sm:px-3 text-xs print:hidden">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground shrink-0">
              <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="hidden sm:inline">Region:</span>
            </span>
            {subdivisionsData.length > 0 ? (
              <select
                aria-label="Schnellauswahl Bundesland oder Region"
                value={subdivision ?? ''}
                onChange={e => updateConfig({ subdivision: e.target.value || undefined, holidayGroup: null })}
                className="h-8 sm:h-7 max-w-[11.5rem] sm:max-w-none rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground"
              >
                <option value="">{country === 'DE' ? 'Bundesland wählen…' : 'Region wählen…'}</option>
                {subdivisionsData.map(s => (
                  <option key={s.code} value={s.code}>
                    {localizedName(s.name, s.code)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-medium">{activeRegionLabel}</span>
            )}
            {isFourthQuarterCurrentYear && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-800 dark:text-emerald-200">
                <span>🎯 Jetzt schon für {year + 1} vorplanen:</span>
                <button
                  type="button"
                  onClick={() => setYear(year + 1)}
                  className="underline font-semibold hover:text-emerald-600"
                >
                  Zu {year + 1} wechseln
                </button>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center rounded-lg border bg-background p-0.5" role="group" aria-label="Ansicht wechseln">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sm:hidden">Gitter</span>
                <span className="hidden sm:inline">Jahresgitter</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                aria-pressed={viewMode === 'timeline'}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sm:hidden">Timeline</span>
                <span className="hidden sm:inline">Vergleichs-Timeline &amp; Ferien-Check</span>
              </button>
            </div>
            {isFourthQuarterCurrentYear && (
              <Button
                type="button"
                size="sm"
                className="h-8 sm:h-7 px-2.5 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  setYear(year + 1)
                  setShowSuggestions(true)
                }}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {year + 1} optimal planen
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 sm:h-7 px-2 sm:px-2.5 text-xs gap-1"
              onClick={() => setShowApprovalSheetDialog(true)}
            >
              <StickyNote className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="sm:hidden">Antrag</span>
              <span className="hidden sm:inline">Urlaubsantrag (Vorschau &amp; PDF)</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 sm:h-7 px-2 sm:px-2.5 text-xs gap-1"
              onClick={() => setShowScorecardDialog(true)}
            >
              <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              <span className="sm:hidden">Score ({scorecard.totalFreeDaysInBlocks}T)</span>
              <span className="hidden sm:inline">Urlaubs-Score ({scorecard.totalFreeDaysInBlocks}T frei)</span>
            </Button>
          </div>
        </div>

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
          vacationDaysTotal={baseVacationDaysTotal}
          onVacationDaysChange={(n) => updateConfig({ vacationDaysPerYear: { [year]: n } })}
          carryoverDaysTotal={carryoverDaysTotal}
          onCarryoverDaysChange={(n) => updateConfig({ carryoverDaysPerYear: { [year]: n } })}
          carryoverExpiringDays={carryoverSummary.expiringAfterMarch31}
          workDays={workDays}
          onWorkDaysChange={(days) => updateConfig({ workDays: days })}
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
          onOpenApprovalSheet={() => setShowApprovalSheetDialog(true)}
        />

        <Toolbar
          year={year} onYearChange={setYear}
          workDays={workDays}
          selectedType={selectedType} onTypeChange={setSelectedType}
          showHeatmap={showHeatmap} onToggleHeatmap={(v) => updateConfig({ showHeatmap: v })}
          showPublicHolidays={showPublicHolidays} onTogglePublicHolidays={(v) => updateConfig({ showPublicHolidays: v })}
          showSchoolHolidays={showSchoolHolidays} onToggleSchoolHolidays={(v) => updateConfig({ showSchoolHolidays: v })}
          showBridgeDays={showBridgeDays} onToggleBridgeDays={(v) => updateConfig({ showBridgeDays: v })}
          vacationDaysUsed={vacationDaysUsed} vacationDaysTotal={vacationDaysTotal}
          workDaysLabel={!isStandardFiveDayWeek(workDays) ? formatWorkDaysLabel(workDays) : undefined}
          sharedPlanSummaries={sharedPlanSummaries.filter(s => sharedOverlays.find(o => o.id === s.id)?.enabled)}
          flex={flex} remainingWorkDays={remainingWorkDays}
          canUndo={canUndo}
          onUndo={() => void handleUndo()}
          entries={entries} preferences={isLoggedIn ? (prefs as Record<string, unknown>) : ((config ?? {}) as unknown as Record<string, unknown>)}
          localConfig={isLoggedIn ? null : config}
          onOpenSuggestions={() => setShowSuggestions(true)}
          onOpenClipboardExport={() => setShowClipboardDialog(true)}
          onOpenShare={() => setShowShareDialog(true)}
          onOpenSubscribe={() => setShowSubscribeDialog(true)}
          onOpenScorecard={() => setShowScorecardDialog(true)}
          onPrintCalendar={() => triggerPrint('calendar')}
          onPrintRequestSheet={() => setShowApprovalSheetDialog(true)}
          onImport={handleImport}
          onImportConfig={handleImportConfig}
          onReset={handleReset}
        />

        {/* Interactive Calendar Suggestion Preview & Live Drag Bar */}
        {previewSuggestions.length > 0 && (
          <div className="sticky top-[3.25rem] sm:top-14 z-40 rounded-xl border-2 border-teal-500/70 bg-card/95 p-2.5 sm:p-3 shadow-lg backdrop-blur space-y-2 sm:space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Badge className="bg-teal-600 text-white hover:bg-teal-600">
                  <Sparkles className="mr-1 h-3 w-3" />
                  <span className="sm:hidden">Vorschau</span>
                  <span className="hidden sm:inline">Interaktive Kalender-Vorschau</span>
                </Badge>
                <span className="font-medium">
                  <span className="hidden sm:inline">Gesamt: </span>
                  <strong>{formatDays(previewTotalCost)} UT</strong> →{' '}
                  <strong className="text-teal-600 dark:text-teal-400">{previewTotalFree} freie Tage</strong>{' '}
                  <span className="hidden sm:inline">(Ø {previewAvgEff.toFixed(1)}x Effizienz)</span>
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
                  className="h-8 sm:h-7 px-2 text-xs md:hidden"
                  onClick={() => setMobilePreviewExpanded(v => !v)}
                >
                  {mobilePreviewExpanded ? 'Weniger ▲' : 'Details ▼'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 sm:h-7 px-2 text-xs"
                  onClick={() => setShowSuggestions(true)}
                >
                  <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
                  Optionen
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 sm:h-7 px-2.5 text-xs bg-teal-600 hover:bg-teal-700 text-white"
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
                  className="h-8 sm:h-7 px-2 text-xs"
                  onClick={() => setPreviewSuggestions([])}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Beenden</span>
                </Button>
              </div>
            </div>

            {/* Block Selector Pills */}
            <div className={`${mobilePreviewExpanded ? 'flex' : 'hidden'} md:flex mobile-scroller items-center gap-1.5 overflow-x-auto border-t pt-2 md:flex-wrap`}>
              {previewSuggestions.map((b, idx) => {
                const active = idx === selectedPreviewIndex
                return (
                  <button
                    key={b.id ?? idx}
                    type="button"
                    onClick={() => setSelectedPreviewIndex(idx)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 sm:py-1 transition-colors ${
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
              <div className={`${mobilePreviewExpanded ? 'flex' : 'hidden'} md:flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-2.5 py-2 sm:px-3`}>
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
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'start', -1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-muted rounded px-1.5 font-bold">−1T</button>
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'start', 1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-muted rounded px-1.5 font-bold">+1T</button>
                  </div>
                  <div className="inline-flex items-center rounded border bg-background px-1 py-0.5 gap-0.5">
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'move', -1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-muted rounded px-1.5 flex items-center justify-center" aria-label="Block 1 Tag vor"><ChevronLeft className="h-3.5 w-3.5" /></button>
                    <span className="text-muted-foreground px-1">Verschieben</span>
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'move', 1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-muted rounded px-1.5 flex items-center justify-center" aria-label="Block 1 Tag zurück"><ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="inline-flex items-center rounded border bg-background px-1 py-0.5 gap-0.5">
                    <span className="text-muted-foreground px-1">Ende:</span>
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'end', -1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-muted rounded px-1.5 font-bold">−1T</button>
                    <button type="button" onClick={() => handleNudgePreviewBlock(selectedPreviewIndex, 'end', 1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-muted rounded px-1.5 font-bold">+1T</button>
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

        <PrintSummaryHeader
          year={year}
          regionLabel={activeRegionLabel}
          workDaysLabel={formatWorkDaysLabel(workDays)}
          scorecard={scorecard}
          carryoverDays={carryoverDaysTotal}
          entries={entries}
          approvalConfig={config?.approvalSheetConfig}
          mode={printMode}
        />

        {entriesLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 print:hidden">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : viewMode === 'timeline' ? (
          <div className="print:hidden">
            <ComparisonTimeline
              year={year}
              todayKey={todayKey}
              entries={entries}
              workDays={workDays}
              publicHolidays={combinedPublicHolidays}
              schoolHolidays={schoolHolidays}
              homeRegionLabel={activeRegionLabel}
              compareHolidays={comparison.holidays}
              compareLabels={compareSubdivisions.map(code => subdivisionsData.find((s: { code: string }) => s.code === code)?.name?.find((n: { language: string }) => n.language === 'DE')?.text ?? code)}
              overlays={sharedOverlays}
              selectedType={selectedType}
              onToggle={handleToggle}
              onOpenSuggestions={() => setShowSuggestions(true)}
            />
          </div>
        ) : (
          <div className={printMode === 'request' ? 'print:hidden' : ''}>
            {/* Mobile Month Jump Strip */}
            <div className="md:hidden -mx-1 px-1 pb-2 print:hidden">
              <div className="mobile-scroller flex items-center gap-1.5 overflow-x-auto pb-1" role="navigation" aria-label="Monatsschnellnavigation">
                <button
                  type="button"
                  onClick={() => scrollToMonth(Number(todayKey.slice(0, 4)), Number(todayKey.slice(5, 7)) - 1)}
                  className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                >
                  Heute
                </button>
                {SHORT_MONTH_LABELS.map((label, idx) => {
                  const mm = `${year}-${String(idx + 1).padStart(2, '0')}`
                  const hasPlanned = plannedMonthsSet.has(mm)
                  return (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => scrollToMonth(year, idx)}
                      className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        hasPlanned
                          ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                          : 'border-border bg-card text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{label}</span>
                      {hasPlanned && <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <YearView
              year={year} todayKey={todayKey} entries={entries}
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
              selectedDayKey={activeDayKey}
              rangeAnchorKey={rangeAnchorKey}
              interactionMode={effectiveInteractionMode}
              onRangeStep={handleRangeStep}
            />
          </div>
        )}

        {hoveredDay && (
          <div className={`pointer-events-none fixed bottom-4 ${hoveredDay.anchorX !== undefined && hoveredDay.anchorX > window.innerWidth / 2 ? 'left-4' : 'right-4'} z-50 hidden max-w-xs rounded-lg border border-border bg-card p-3 text-sm text-card-foreground shadow-lg supports-[bottom:env(safe-area-inset-bottom)]:bottom-[calc(1rem+env(safe-area-inset-bottom))] md:block`}>
            <DayInfoDetails day={hoveredDay} />
          </div>
        )}

        {activeDayInfo && (
          <div
            role="dialog"
            aria-label="Tagesdetails und Schnellaktionen"
            className="fixed inset-x-3 z-50 rounded-xl border border-border bg-card p-3 pr-11 text-sm text-card-foreground shadow-xl bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:hidden space-y-2.5 max-h-[65dvh] overflow-y-auto print:hidden"
          >
            <div>
              <DayInfoDetails day={activeDayInfo} />
              {!hasVisibleDayInfo(activeDayInfo) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {isOffDayKey(getDateKey(activeDayInfo.date), workDays) ? 'Arbeitsfreier Tag' : 'Regulärer Arbeitstag'}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2">
              {([
                { type: 'vacation' as const, label: 'Urlaub', activeClass: 'bg-blue-600 text-white border-blue-600' },
                { type: 'gleittag' as const, label: 'Gleittag', activeClass: 'bg-purple-600 text-white border-purple-600' },
                { type: 'special' as const, label: 'Sonderurlaub', activeClass: 'bg-cyan-600 text-white border-cyan-600' },
              ]).map(opt => {
                const isActive = activeDayInfo.entry?.type === opt.type
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => handleToggle(activeDayInfo.date, opt.type)}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive ? opt.activeClass : 'border-border bg-background text-foreground hover:bg-muted'
                    }`}
                  >
                    {opt.label}
                    {isActive && <span className="text-[10px] opacity-90">✕</span>}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => {
                  setMobileMode('range')
                  setRangeAnchorKey(getDateKey(activeDayInfo.date))
                  setActiveDayKey(null)
                }}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Zeitraum ab hier
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-t border-border/70 pt-2">
              {activeDayInfo.noteEntry ? (
                <>
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    📝 {activeDayInfo.noteEntry.title || 'Notiz'}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 px-2.5 text-xs text-destructive"
                    onClick={() => handleToggle(activeDayInfo.date, 'note')}
                  >
                    Notiz entfernen
                  </Button>
                </>
              ) : (
                <form
                  className="flex flex-1 items-center gap-1.5"
                  onSubmit={e => {
                    e.preventDefault()
                    handleToggle(activeDayInfo.date, 'note', mobileNoteDraft.trim() || 'Notiz')
                  }}
                >
                  <input
                    type="text"
                    value={mobileNoteDraft}
                    onChange={e => setMobileNoteDraft(e.target.value)}
                    placeholder="Notiz hinzufügen (z.B. Arzt, Reise)…"
                    aria-label="Notiz für diesen Tag"
                    className="min-h-9 flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 text-xs"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="h-9 px-2.5 text-xs shrink-0">
                    Notiz +
                  </Button>
                </form>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveDayKey(null)}
              className="absolute right-1.5 top-1.5 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Tagesinfo schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Single-Row Sticky Mobile Bottom Dock */}
        {viewMode === 'grid' && (
          <div
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:hidden print:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
            role="region"
            aria-label="Mobile Kalendermodus-Leiste"
          >
            {mobileMode === 'range' && rangeAnchorKey ? (
              <div className="flex items-center justify-between gap-2 min-h-10">
                <span className="text-xs font-medium text-foreground truncate">
                  <strong>Start {format(parseISO(rangeAnchorKey), 'dd.MM.')}</strong> → Endtag im Kalender tippen
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 px-2.5 text-xs shrink-0"
                  onClick={() => setRangeAnchorKey(null)}
                >
                  Abbrechen
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1">
                <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 shrink-0" role="group" aria-label="Touch-Modus">
                  <button
                    type="button"
                    onClick={() => setMobileMode('inspect')}
                    aria-pressed={mobileMode === 'inspect'}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors ${
                      mobileMode === 'inspect' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Ansehen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileMode('edit')}
                    aria-pressed={mobileMode === 'edit'}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors ${
                      mobileMode === 'edit' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Edit3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Tippen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileMode('range')}
                    aria-pressed={mobileMode === 'range'}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors ${
                      mobileMode === 'range' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Zeitraum</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 min-w-0">
                  <select
                    aria-label="Aktiver Eintragstyp"
                    value={selectedType}
                    onChange={e => setSelectedType(e.target.value as EntryType)}
                    className="h-9 max-w-[5.25rem] rounded-md border border-input bg-background px-1.5 text-[11px] font-medium text-foreground"
                  >
                    <option value="vacation">Urlaub</option>
                    <option value="gleittag">Gleittag</option>
                    <option value="special">Sonder</option>
                    <option value="note">Notiz</option>
                  </select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={!canUndo}
                    onClick={() => void handleUndo()}
                    className="h-9 w-9 shrink-0"
                    aria-label="Rückgängig"
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => setShowSuggestions(true)}
                    className="h-9 w-9 shrink-0 bg-teal-600 hover:bg-teal-700 text-white"
                    aria-label="Urlaub planen"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Color & Heatmap Legend */}
        <div className={`rounded-xl border bg-card p-3.5 space-y-3 ${printMode === 'request' ? 'print:hidden' : 'print:p-2 print:text-[10px]'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-blue-600 shadow-2xs" /> Urlaub</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-red-600" /> Über Budget</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-purple-600" /> Gleittag</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-cyan-600 shadow-2xs" /> Sonderurlaub / Frei</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-slate-500 dark:bg-slate-600 flex items-center justify-center"><StickyNote className="h-2.5 w-2.5 text-amber-200 fill-amber-300/40" /></span> Notiz</span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-emerald-100 ring-1 ring-inset ring-emerald-700/50 dark:ring-white/80 border border-emerald-400 dark:bg-emerald-500/35 dark:border-emerald-500/60" />
                <span>Feiertag</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="relative w-3.5 h-3.5 rounded-sm bg-blue-600 ring-1 ring-inset ring-white border-b-2 border-b-amber-300">
                  <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-emerald-400 ring-0.5 ring-white" />
                </span>
                <span>Urlaub auf Feiertag/Ferien</span>
              </span>
              {!showHeatmap && (
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-amber-100/85 border border-amber-300 border-b-2 border-b-amber-400 dark:bg-amber-400/20 dark:border-amber-400/50" /> Eigene Schulferien</span>
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
                Mehrfachauswahl: <strong>Gedrückt halten &amp; ziehen</strong> oder <kbd className="rounded border bg-muted px-1 py-0.5">Shift</kbd>+Klick · Kürzel: <kbd className="rounded border bg-muted px-1 py-0.5">U</kbd> <kbd className="rounded border bg-muted px-1 py-0.5">G</kbd> <kbd className="rounded border bg-muted px-1 py-0.5">S</kbd> <kbd className="rounded border bg-muted px-1 py-0.5">N</kbd> <kbd className="rounded border bg-muted px-1 py-0.5">P</kbd>
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
                <span>Unterlinie = Eigene Schulferien &amp; regionale Feiertage</span>
              </div>
            </div>
          )}
        </div>

        <PrintSummaryFooter />

        {/* Helpful Ratgeber & SEO FAQ Section */}
        <details className="group rounded-xl border bg-card/60 p-4 text-sm print:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground">
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              Tipps zur optimalen Urlaubsplanung {year}, Brückentage nach Bundesland &amp; Häufige Fragen
            </span>
            <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform" aria-hidden="true">▼</span>
          </summary>
          <div className="mt-4 space-y-5 text-xs text-muted-foreground leading-relaxed border-t pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <h2 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Maximale freie Tage durch Brückentage &amp; 4-Tage-Woche
                </h2>
                <p>
                  Mit dem Button <strong>„Planen“</strong> (Taste <kbd className="rounded border px-1">P</kbd>) analysiert der smarte Algorithmus alle gesetzlichen Feiertage, deine individuellen Arbeitstage (z.B. 5-Tage- oder 4-Tage-Woche) und Schulferien. Du kannst die Vorschläge anschließend direkt auf dem Kalender verschieben oder an den Enden länger/kürzer ziehen.
                </p>
              </div>
              <div className="space-y-1.5">
                <h2 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                  <Share2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Mehrfachauswahl &amp; gemeinsam planen
                </h2>
                <p>
                  Halte die Maustaste auf einem Tag gedrückt und ziehe über mehrere Tage (oder nutze <kbd className="rounded border px-1">Shift</kbd> + Klick), um ganze Zeiträume als Urlaub, Gleittag oder mehrtägige Notiz/Event einzutragen. Über <strong>„Teilen“</strong> kannst du Pläne mit Familie oder Kollegen vergleichen und gemeinsam bearbeiten.
                </p>
              </div>
              <div className="space-y-1.5">
                <h2 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                  <CalendarPlus className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Mehrere Kalender-Abos für Google, Apple &amp; Outlook
                </h2>
                <p>
                  Binde deinen Urlaubsplan per Direkt-Button in <strong>Google Kalender</strong>, Apple Kalender oder Outlook ein. Mit einem kostenlosen Konto kannst du mehrere getrennte Kalender-Feeds mit eigenen Filtern anlegen – z. B. einen Feed fürs Büro ohne private Notizen und einen privaten Feed mit Feiertagen &amp; Schulferien.
                </p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-foreground text-xs">
                  Brückentage &amp; Schulferien {year} nach Bundesland (Direktübersicht)
                </h2>
                <div className="flex items-center gap-2">
                  <Link href={`/brueckentage/${year}`} className="text-primary underline font-medium">
                    Alle Brückentage {year}
                  </Link>
                  <span>·</span>
                  <Link href={`/brueckentage/${year + 1}`} className="text-primary underline font-medium">
                    Vorschau {year + 1}
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SEO_REGIONS.map(r => (
                  <Link
                    key={r.slug}
                    href={`/brueckentage/${year}/${r.slug}`}
                    className="rounded-md border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    {r.name} {year}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </details>
      </main>
    </div>
  )
}
