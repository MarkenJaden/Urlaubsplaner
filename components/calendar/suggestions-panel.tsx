'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Calendar,
  Flame,
  Sun,
  Compass,
  SlidersHorizontal,
  Ban,
  Map as MapIcon,
  ChevronLeft,
  ChevronRight,
  Users,
  Zap,
  Copy,
  Check,
  Edit3,
  Eye,
} from 'lucide-react'
import type { VacationSuggestionBlock, PlanningPreferences, PeriodPreference } from '@/lib/vacation-suggester'
import { DEFAULT_PREFERENCES, recalculateSuggestionBlock } from '@/lib/vacation-suggester'
import { format, getISOWeek, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import type {
  EntryType,
  OptimizationGoal,
  SchoolHolidayStrategy,
  NoteHandling,
  PlanStartMode,
  ExcludedDateRange,
  Holiday,
  SharedPlanOverlay,
  PartnerPlanningMode,
  PartnerAlignStrength,
  PartnerOffWeekdayMode,
} from '@/types'
import { formatDays, formatWorkDaysLabel, isStandardFiveDayWeek, DEFAULT_WORK_DAYS } from '@/lib/vacation-accounting'
import type { SharedPlanStatSummary } from '@/components/calendar/toolbar'

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function weekLabel(dates: string[]): string {
  const weeks = [...new Set(dates.map(d => getISOWeek(parseISO(d))))]
  if (weeks.length === 0) return ''
  return weeks.length === 1 ? `KW ${weeks[0]}` : `KW ${weeks[0]}–${weeks[weeks.length - 1]}`
}

function shiftIsoDate(dateStr: string, deltaDays: number, year: number): string {
  const d = parseISO(dateStr)
  const shifted = new Date(d.getTime() + deltaDays * 86400000)
  const minD = new Date(year, 0, 1)
  const maxD = new Date(year, 11, 31)
  const clamped = shifted < minD ? minD : shifted > maxD ? maxD : shifted
  return format(clamped, 'yyyy-MM-dd')
}

interface SuggestionsPanelProps {
  open: boolean
  onClose: () => void
  year: number
  country: string
  subdivision?: string
  group?: string
  remainingDays: number
  totalDays: number
  halfDaysChristmas: boolean
  countWeekendsAsVacation?: boolean
  workDays?: number[]
  publicHolidays?: Holiday[]
  schoolHolidays?: Holiday[]
  existingVacationDates: string[]
  noteDates: string[]
  partnerOverlays?: SharedPlanOverlay[]
  sharedPlanSummaries?: SharedPlanStatSummary[]
  initialPartnerMode?: PartnerPlanningMode
  onApply: (dates: string[], type: EntryType, replace: boolean) => void
  onApplyPartner?: (token: string, dates: string[], replace: boolean) => Promise<void>
  onRemove: (dates: string[]) => void
  onOpenCalendarPreview?: (blocks: VacationSuggestionBlock[], overwrite: boolean) => void
  busy?: boolean
}

export function SuggestionsPanel({
  open,
  onClose,
  year,
  country,
  subdivision,
  group,
  remainingDays,
  totalDays,
  halfDaysChristmas,
  countWeekendsAsVacation = false,
  workDays = DEFAULT_WORK_DAYS,
  publicHolidays = [],
  schoolHolidays = [],
  existingVacationDates,
  noteDates,
  partnerOverlays = [],
  sharedPlanSummaries = [],
  initialPartnerMode,
  onApply,
  onApplyPartner,
  onRemove,
  onOpenCalendarPreview,
  busy = false,
}: SuggestionsPanelProps) {
  const [prefs, setPrefs] = useState<PlanningPreferences>({
    ...DEFAULT_PREFERENCES,
    halfDaysChristmas,
    countWeekendsAsVacation,
    workDays,
  })
  const [overwrite, setOverwrite] = useState(false)
  const [partnerMode, setPartnerMode] = useState<PartnerPlanningMode>('align_to_partner')
  const [partnerStrength, setPartnerStrength] = useState<PartnerAlignStrength>('balanced')
  const [partnerOffWeekdayMode, setPartnerOffWeekdayMode] = useState<PartnerOffWeekdayMode>('bonus_only')
  const [partnerBudgetInput, setPartnerBudgetInput] = useState<string>('')
  const [fillSoloAfterJoint, setFillSoloAfterJoint] = useState<boolean>(true)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('')
  const [suggestions, setSuggestions] = useState<VacationSuggestionBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [partnerApplying, setPartnerApplying] = useState(false)
  const [copiedPartnerKey, setCopiedPartnerKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addedByBlock, setAddedByBlock] = useState<Record<number, string[]>>({})
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null)

  // Inclusion rule builder state
  const [ruleMode, setRuleMode] = useState<'months' | 'dates'>('months')
  const [ruleType, setRuleType] = useState<'must_have' | 'nice_to_have'>('must_have')
  const [ruleMonths, setRuleMonths] = useState<number[]>([7, 8])
  const [ruleDurationMode, setRuleDurationMode] = useState<'min' | 'exact'>('min')
  const [ruleDays, setRuleDays] = useState<number>(10)
  const [ruleStartDate, setRuleStartDate] = useState<string>(`${year}-07-13`)
  const [ruleEndDate, setRuleEndDate] = useState<string>(`${year}-07-24`)
  const [ruleLabel, setRuleLabel] = useState<string>('')

  // Excluded date range builder state
  const [excludeStart, setExcludeStart] = useState<string>(`${year}-05-04`)
  const [excludeEnd, setExcludeEnd] = useState<string>(`${year}-05-08`)
  const [excludeLabel, setExcludeLabel] = useState<string>('')

  const pickedSingle = Object.keys(addedByBlock).length > 0
  const used = totalDays - remainingDays
  const availableBudget = Math.max(0, (overwrite ? totalDays : remainingDays) - (prefs.reserveDaysToKeep ?? 0))

  const lastPlannedVacationDate = useMemo(() => {
    const sorted = [...existingVacationDates].filter(d => d.startsWith(`${year}-`)).sort()
    return sorted.length > 0 ? sorted[sorted.length - 1] : null
  }, [existingVacationDates, year])

  useEffect(() => {
    if (open) {
      setPrefs(p => ({
        ...p,
        halfDaysChristmas,
        countWeekendsAsVacation,
        workDays,
        customStartDate: p.customStartDate?.startsWith(`${year}-`) ? p.customStartDate : `${year}-01-01`,
        customEndDate: p.customEndDate?.startsWith(`${year}-`) ? p.customEndDate : `${year}-12-31`,
      }))
      setRuleStartDate(`${year}-07-13`)
      setRuleEndDate(`${year}-07-24`)
      setExcludeStart(`${year}-05-04`)
      setExcludeEnd(`${year}-05-08`)
      if (initialPartnerMode) setPartnerMode(initialPartnerMode)
    }
  }, [open, halfDaysChristmas, countWeekendsAsVacation, workDays, year, initialPartnerMode])

  const existingVacationSet = useMemo(() => new Set(existingVacationDates), [existingVacationDates])

  const getMissingVacationDays = (suggestion: VacationSuggestionBlock): string[] => {
    return suggestion.vacationDays.filter(date => !existingVacationSet.has(date))
  }

  const updateGoal = (goal: OptimizationGoal) => {
    setPrefs(p => ({
      ...p,
      goal,
      optimizeForEfficiency: goal === 'max_efficiency',
      distributeEvenly: goal === 'distributed' ? true : p.distributeEvenly,
    }))
  }

  const updateSchoolStrategy = (schoolStrategy: SchoolHolidayStrategy) => {
    setPrefs(p => ({
      ...p,
      schoolStrategy,
      preferSchoolHolidays: schoolStrategy === 'prefer',
      avoidSchoolHolidays: schoolStrategy === 'avoid' || schoolStrategy === 'avoid_heatmap',
      avoidAllStatesSchoolHolidays: schoolStrategy === 'avoid_heatmap',
    }))
  }

  const updatePlanStartMode = (planStartMode: PlanStartMode) => {
    setPrefs(p => ({
      ...p,
      planStartMode,
      planFromToday: planStartMode === 'today',
      customStartDate:
        planStartMode === 'custom_date' && !p.customStartDate
          ? `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
          : p.customStartDate,
    }))
  }

  const toggleAvoidMonth = (monthNumber: number) => {
    setPrefs(p => {
      const current = p.avoidMonths ?? []
      const next = current.includes(monthNumber)
        ? current.filter(m => m !== monthNumber)
        : [...current, monthNumber].sort((a, b) => a - b)
      return {
        ...p,
        avoidMonths: next,
        preferredMonths: (p.preferredMonths ?? []).filter(m => !next.includes(m)),
      }
    })
  }

  const togglePreferredMonth = (monthNumber: number) => {
    setPrefs(p => {
      const current = p.preferredMonths ?? []
      const next = current.includes(monthNumber)
        ? current.filter(m => m !== monthNumber)
        : [...current, monthNumber].sort((a, b) => a - b)
      return {
        ...p,
        preferredMonths: next,
        avoidMonths: (p.avoidMonths ?? []).filter(m => !next.includes(m)),
      }
    })
  }

  const applyQuickPreset = (presetId: 'balanced' | 'bridges' | 'family' | 'two_big' | 'mini') => {
    if (presetId === 'balanced') {
      setPrefs(p => ({
        ...p,
        goal: 'balanced',
        optimizeForEfficiency: false,
        schoolStrategy: 'neutral',
        preferSchoolHolidays: false,
        avoidSchoolHolidays: false,
        avoidAllStatesSchoolHolidays: false,
        preferBridgeDays: true,
        allowSingleDayBridges: true,
        distributeEvenly: true,
        requireMainVacationDays: null,
        minDaysPerBlock: 1,
        maxDaysPerBlock: null,
      }))
    } else if (presetId === 'bridges') {
      setPrefs(p => ({
        ...p,
        goal: 'max_efficiency',
        optimizeForEfficiency: true,
        preferBridgeDays: true,
        allowSingleDayBridges: true,
        distributeEvenly: false,
        requireMainVacationDays: null,
        minDaysPerBlock: 1,
        maxDaysPerBlock: null,
      }))
    } else if (presetId === 'family') {
      setPrefs(p => ({
        ...p,
        goal: 'balanced',
        optimizeForEfficiency: false,
        schoolStrategy: 'prefer',
        preferSchoolHolidays: true,
        avoidSchoolHolidays: false,
        avoidAllStatesSchoolHolidays: false,
        preferBridgeDays: true,
        requireMainVacationDays: 8,
        minDaysPerBlock: 1,
        maxDaysPerBlock: null,
      }))
    } else if (presetId === 'two_big') {
      setPrefs(p => ({
        ...p,
        goal: 'long_breaks',
        optimizeForEfficiency: false,
        distributeEvenly: true,
        requireMainVacationDays: 8,
        minDaysPerBlock: 3,
        maxDaysPerBlock: null,
      }))
    } else if (presetId === 'mini') {
      setPrefs(p => ({
        ...p,
        goal: 'mini_breaks',
        optimizeForEfficiency: false,
        distributeEvenly: true,
        allowSingleDayBridges: true,
        preferBridgeDays: true,
        requireMainVacationDays: null,
        minDaysPerBlock: 1,
        maxDaysPerBlock: 4,
      }))
    }
  }

  const toggleRuleMonth = (monthNumber: number) => {
    setRuleMonths(prev =>
      prev.includes(monthNumber) ? prev.filter(m => m !== monthNumber) : [...prev, monthNumber].sort((a, b) => a - b),
    )
  }

  const handleAddRule = () => {
    if (ruleMode === 'months') {
      if (ruleMonths.length === 0) return
      const newRule: PeriodPreference = {
        id: String(Date.now()),
        type: ruleType,
        months: ruleMonths,
        minDuration: ruleDays,
        exactDays: ruleDurationMode === 'exact' ? ruleDays : null,
        label: ruleLabel.trim() || `${ruleType === 'must_have' ? 'Pflichturlaub' : 'Wunschurlaub'} (${ruleMonths.map(m => MONTH_NAMES[m - 1]).join('/')})`,
      }
      setPrefs(p => ({ ...p, periodPreferences: [...p.periodPreferences, newRule] }))
      setRuleLabel('')
    } else {
      if (!ruleStartDate || !ruleEndDate || ruleStartDate > ruleEndDate) return
      const newRule: PeriodPreference = {
        id: String(Date.now()),
        type: 'exact_range',
        months: [parseISO(ruleStartDate).getMonth() + 1],
        startDate: ruleStartDate,
        endDate: ruleEndDate,
        minDuration: ruleDays,
        exactDays: ruleDurationMode === 'exact' ? ruleDays : null,
        label: ruleLabel.trim() || `Fester Zeitraum (${format(parseISO(ruleStartDate), 'dd.MM.')}–${format(parseISO(ruleEndDate), 'dd.MM.')})`,
      }
      setPrefs(p => ({ ...p, periodPreferences: [...p.periodPreferences, newRule] }))
      setRuleLabel('')
    }
  }

  const handleRemoveRule = (index: number) => {
    setPrefs(p => ({
      ...p,
      periodPreferences: p.periodPreferences.filter((_, i) => i !== index),
    }))
  }

  const handleAddExcludeRange = () => {
    if (!excludeStart || !excludeEnd || excludeStart > excludeEnd) return
    const item: ExcludedDateRange = {
      id: String(Date.now()),
      startDate: excludeStart,
      endDate: excludeEnd,
      label:
        excludeLabel.trim() ||
        `Sperrzeitraum (${format(parseISO(excludeStart), 'dd.MM.')}–${format(parseISO(excludeEnd), 'dd.MM.')})`,
    }
    setPrefs(p => ({
      ...p,
      excludedDateRanges: [...(p.excludedDateRanges ?? []), item],
    }))
    setExcludeLabel('')
  }

  const handleRemoveExcludeRange = (index: number) => {
    setPrefs(p => ({
      ...p,
      excludedDateRanges: (p.excludedDateRanges ?? []).filter((_, i) => i !== index),
    }))
  }

  const activePartners = useMemo(() => partnerOverlays.filter(o => o.enabled), [partnerOverlays])
  const selectedPartner = useMemo(
    () => activePartners.find(p => p.id === selectedPartnerId) ?? activePartners[0] ?? null,
    [activePartners, selectedPartnerId],
  )
  const selectedPartnerSummary = useMemo(
    () => (selectedPartner ? sharedPlanSummaries.find(s => s.id === selectedPartner.id) ?? null : null),
    [selectedPartner, sharedPlanSummaries],
  )
  const effectivePartnerRemaining = useMemo(() => {
    if (partnerBudgetInput.trim() !== '' && Number.isFinite(Number(partnerBudgetInput))) {
      return Math.max(0, Number(partnerBudgetInput))
    }
    if (selectedPartnerSummary) {
      return overwrite ? selectedPartnerSummary.total : Math.max(0, selectedPartnerSummary.remaining)
    }
    return selectedPartner?.vacationDays ?? 30
  }, [partnerBudgetInput, selectedPartnerSummary, selectedPartner, overwrite])

  const partnerHasDifferentWorkWeek = useMemo(() => {
    if (!selectedPartner) return false
    const pw = selectedPartner.workDays?.length ? selectedPartner.workDays : DEFAULT_WORK_DAYS
    return !isStandardFiveDayWeek(pw) || pw.length !== workDays.length || pw.some(d => !workDays.includes(d))
  }, [selectedPartner, workDays])

  const effectivePartnerMode: PartnerPlanningMode =
    activePartners.length > 0 && selectedPartner ? partnerMode : 'off'

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setAddedByBlock({})
    try {
      const requestPrefs: PlanningPreferences = {
        ...prefs,
        partnerOptions: {
          mode: effectivePartnerMode,
          strength: partnerStrength,
          offWeekdayMode: partnerOffWeekdayMode,
          maxLongWeekendsOnPartnerOffDay: 3,
          partnerBudget: effectivePartnerMode === 'plan_both' ? effectivePartnerRemaining : null,
          partnerReserveDays: 0,
          fillSoloAfterJoint,
        },
      }
      const params = new URLSearchParams({
        country,
        year: String(year),
        remainingDays: String(Math.max(0, overwrite ? totalDays : remainingDays)),
        overwrite: String(overwrite),
        preferences: JSON.stringify(requestPrefs),
        existingDates: existingVacationDates.join(','),
        noteDates: noteDates.join(','),
      })
      if (subdivision) params.set('subdivision', subdivision)
      if (group) params.set('group', group)
      if (effectivePartnerMode !== 'off' && selectedPartner) {
        params.set('partnerMode', effectivePartnerMode)
        if (effectivePartnerMode === 'align_to_partner') {
          params.set('alignWithPartner', 'true')
        }
        const pDates = selectedPartner.entries
          .filter(e => (e.type === 'vacation' || e.type === 'gleittag' || e.type === 'special') && e.date.startsWith(`${year}-`))
          .map(e => e.date.slice(0, 10))
        if (pDates.length > 0) params.set('partnerDates', [...new Set(pDates)].join(','))
        if (selectedPartner.workDays?.length) params.set('partnerWorkDays', selectedPartner.workDays.join(','))
        if (selectedPartner.country) params.set('partnerCountry', selectedPartner.country)
        if (selectedPartner.subdivision) params.set('partnerSubdivision', selectedPartner.subdivision)
        if (selectedPartner.halfDaysChristmas !== undefined) {
          params.set('partnerHalfDaysChristmas', String(selectedPartner.halfDaysChristmas))
        }
        params.set('partnerRemainingDays', String(effectivePartnerRemaining))
        params.set('partnerLabel', selectedPartner.label)
      }
      const res = await fetch(`/api/suggestions?${params}`)
      if (!res.ok) throw new Error(res.status === 502 ? 'Feiertage konnten nicht geladen werden. Bitte erneut versuchen.' : 'Fehler beim Laden der Vorschläge')
      setSuggestions(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  const handleAdjustBlock = (idx: number, mode: 'move' | 'start' | 'end', deltaDays: number) => {
    const current = suggestions[idx]
    if (!current || current.vacationDays.length === 0) return
    const firstVac = current.vacationDays[0]
    const lastVac = current.vacationDays[current.vacationDays.length - 1]
    const nextStart = mode === 'move' || mode === 'start' ? shiftIsoDate(firstVac, deltaDays, year) : firstVac
    const nextEnd = mode === 'move' || mode === 'end' ? shiftIsoDate(lastVac, deltaDays, year) : lastVac
    if (nextStart > nextEnd) return

    const updated = recalculateSuggestionBlock(
      year,
      nextStart,
      nextEnd,
      publicHolidays,
      schoolHolidays,
      existingVacationSet,
      {
        halfDaysChristmas: prefs.halfDaysChristmas,
        countWeekendsAsVacation: prefs.countWeekendsAsVacation,
        workDays: prefs.workDays,
        overwrite,
      },
      current,
    )
    if (updated) {
      setSuggestions(prev => prev.map((b, i) => (i === idx ? updated : b)))
    }
  }

  const handleApplyAll = () => {
    if (pickedSingle && !confirm('Bist du sicher, dass du alle Vorschläge übernehmen willst?')) return
    setAddedByBlock(added => Object.fromEntries(suggestions.flatMap((s, i) => {
      const dates = added[i] ?? getMissingVacationDays(s)
      return dates.length > 0 ? [[i, dates]] : []
    })))
    if (overwrite) {
      if (!confirm(`Bisherige Urlaubstage in ${year} werden durch die Vorschläge ersetzt. Gleittage und Notizen bleiben erhalten. Fortfahren?`)) return
      onApply([...new Set(suggestions.flatMap(s => s.vacationDays))], 'vacation', true)
      return
    }
    const allDates = [...new Set(suggestions.flatMap(getMissingVacationDays))]
    if (allDates.length === 0) return
    onApply(allDates, 'vacation', false)
  }

  const handleApplyOne = (idx: number) => {
    const missingDates = getMissingVacationDays(suggestions[idx])
    if (missingDates.length === 0) return
    setAddedByBlock(added => ({ ...added, [idx]: missingDates }))
    onApply(missingDates, 'vacation', false)
  }

  const handleRemoveOne = (idx: number) => {
    const dates = addedByBlock[idx]
    if (!dates) return
    setAddedByBlock(({ [idx]: _removed, ...rest }) => rest)
    onRemove(dates)
  }

  const totalSuggestedCost = useMemo(() => suggestions.reduce((sum, s) => sum + s.cost, 0), [suggestions])
  const totalPartnerSuggestedCost = useMemo(() => suggestions.reduce((sum, s) => sum + (s.partnerCost ?? 0), 0), [suggestions])
  const hasPartnerSuggestedDays = useMemo(() => suggestions.some(s => (s.partnerVacationDays?.length ?? 0) > 0), [suggestions])
  const totalFreeDaysGained = useMemo(() => suggestions.reduce((sum, s) => sum + s.freeDaysGained, 0), [suggestions])
  const avgEfficiency = totalSuggestedCost > 0 ? totalFreeDaysGained / totalSuggestedCost : 0

  const handleApplyAllWithPartner = async () => {
    handleApplyAll()
    if (
      selectedPartner?.permission === 'edit' &&
      selectedPartner.token &&
      onApplyPartner &&
      hasPartnerSuggestedDays
    ) {
      const pDates = [...new Set(suggestions.flatMap(s => s.partnerVacationDays ?? []))]
      if (pDates.length > 0) {
        setPartnerApplying(true)
        try {
          await onApplyPartner(selectedPartner.token, pDates, overwrite)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Partner-Kalender konnte nicht aktualisiert werden.')
        } finally {
          setPartnerApplying(false)
        }
      }
    }
  }

  const handleApplyOneBoth = async (idx: number) => {
    handleApplyOne(idx)
    const pDates = suggestions[idx]?.partnerVacationDays ?? []
    if (
      pDates.length > 0 &&
      selectedPartner?.permission === 'edit' &&
      selectedPartner.token &&
      onApplyPartner
    ) {
      setPartnerApplying(true)
      try {
        await onApplyPartner(selectedPartner.token, pDates, false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Partner-Kalender konnte nicht aktualisiert werden.')
      } finally {
        setPartnerApplying(false)
      }
    }
  }

  const handleCopyPartnerDates = async (dates: string[], key: string) => {
    if (dates.length === 0) return
    const formatted = dates.map(d => format(parseISO(d), 'dd.MM.yyyy (EE)', { locale: de })).join('\n')
    try {
      await navigator.clipboard.writeText(formatted)
      setCopiedPartnerKey(key)
      setTimeout(() => setCopiedPartnerKey(null), 2000)
    } catch {
      // ignore clipboard errors
    }
  }

  const activeAdvancedCount =
    (prefs.avoidMonths?.length ?? 0) +
    (prefs.preferredMonths?.length ?? 0) +
    (prefs.excludedDateRanges?.length ?? 0) +
    (prefs.planStartMode && prefs.planStartMode !== 'today' ? 1 : 0) +
    (prefs.maxBlocks ? 1 : 0) +
    (prefs.minEfficiency ? 1 : 0) +
    (prefs.requireMainVacationDays ? 1 : 0)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="mb-1 pr-10 text-xl font-bold leading-tight tracking-normal flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Smart-Urlaubsplaner {year}
        </DialogTitle>
        <p className="text-sm text-muted-foreground mb-3">
          Hole das absolute Maximum aus deinen Urlaubstagen ({(prefs.workDays ?? DEFAULT_WORK_DAYS).length}-Tage-Woche), Feiertagen, Brückentagen und Wunschzeiträumen heraus.
        </p>

        {/* Budget Status Bar */}
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <div>
            Bisher verplant: <strong>{formatDays(used)}</strong> von {formatDays(totalDays)} Tagen ·{' '}
            <span className={remainingDays < 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}>
              {formatDays(remainingDays)} frei verfügbar
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            Für Optimierung: {formatDays(availableBudget)} Tage
          </Badge>
        </div>

        {/* Schnell-Vorlagen (Presets) */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
            Schnell-Vorlagen:
          </span>
          {([
            { id: 'balanced', label: '✨ Ausgewogen' },
            { id: 'bridges', label: '🔥 Brückentag-Profi' },
            { id: 'family', label: '🏫 Familien-Plan' },
            { id: 'two_big', label: '☀️ 2× Großer Urlaub' },
            { id: 'mini', label: '⚡ Kurztrips' },
          ] as const).map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyQuickPreset(preset.id)}
              className="rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium hover:border-primary hover:text-primary transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Paar- & Gemeinsam-Optimierer (wenn Partner-Plan eingeblendet ist) */}
        {activePartners.length > 0 && selectedPartner && (
          <fieldset className="mb-4 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3.5 text-xs space-y-3">
            <legend className="px-1 font-semibold text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>Gemeinsame Urlaubsplanung</span>
            </legend>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 flex-1">
                {([
                  { id: 'off' as const, title: 'Nur für mich', sub: 'Partner ausblenden' },
                  { id: 'align_to_partner' as const, title: `An ${selectedPartner.label} anpassen`, sub: 'Nur dein Kalender' },
                  { id: 'plan_both' as const, title: 'Für BEIDE optimieren', sub: 'Gemeinsamer Jahresplan' },
                ]).map(opt => {
                  const active = partnerMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPartnerMode(opt.id)}
                      aria-pressed={active}
                      className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        active ? 'border-emerald-600 bg-background font-medium ring-1 ring-emerald-600' : 'bg-background/60 hover:bg-background'
                      }`}
                    >
                      <div className="text-xs font-semibold text-foreground">{opt.title}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.sub}</div>
                    </button>
                  )
                })}
              </div>
              {activePartners.length > 1 && (
                <select
                  aria-label="Partner-Plan für Optimierung auswählen"
                  value={selectedPartner.id}
                  onChange={e => setSelectedPartnerId(e.target.value)}
                  disabled={partnerMode === 'off'}
                  className="min-h-9 rounded-md border bg-background px-2.5 py-1 text-xs"
                >
                  {activePartners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {partnerMode === 'align_to_partner' && (
              <div className="space-y-2 rounded-lg border bg-background/80 p-2.5">
                <p className="text-[11px] text-muted-foreground">
                  Plant <strong>nur deinen eigenen Kalender</strong> und richtet deine Urlaubsblöcke bevorzugt nach{' '}
                  <strong>{selectedPartner.label}</strong>s bereits eingetragenem Urlaub und Feiertagen aus.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-medium">Ausrichtung:</span>
                    <select
                      value={partnerStrength}
                      onChange={e => setPartnerStrength(e.target.value as PartnerAlignStrength)}
                      className="rounded border bg-background px-2 py-1 text-xs"
                    >
                      <option value="gentle">Locker (Brücken vorrangig)</option>
                      <option value="balanced">Ausgewogen</option>
                      <option value="strong">Stark (Überschneidungen priorisieren)</option>
                    </select>
                  </label>

                  {partnerHasDifferentWorkWeek && (
                    <label className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-medium">
                        Freie Wochentage ({formatWorkDaysLabel(selectedPartner.workDays)}):
                      </span>
                      <select
                        value={partnerOffWeekdayMode}
                        onChange={e => setPartnerOffWeekdayMode(e.target.value as PartnerOffWeekdayMode)}
                        className="rounded border bg-background px-2 py-1 text-xs"
                      >
                        <option value="bonus_only">Nur als Bonus bei echten Urlauben</option>
                        <option value="allow_few_weekends">Max. 3 lange Wochenenden vorschlagen</option>
                        <option value="ignore">Ignorieren (kein extra Bonus)</option>
                      </select>
                    </label>
                  )}
                </div>
              </div>
            )}

            {partnerMode === 'plan_both' && (
              <div className="space-y-2 rounded-lg border bg-background/80 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Berechnet einen <strong>gemeinsamen Urlaubsplan für dich &amp; {selectedPartner.label}</strong> unter Berücksichtigung beider Budgets und Arbeitswochen ({formatWorkDaysLabel(selectedPartner.workDays)}).
                  </p>
                  {selectedPartner.permission === 'edit' && selectedPartner.token ? (
                    <Badge variant="default" className="text-[10px] bg-emerald-600 text-white gap-1">
                      <Edit3 className="h-3 w-3" /> Direkt in beide Kalender übernehmbar
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Eye className="h-3 w-3" /> Nur Lesezugriff (Partner-Tage kopierbar)
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-medium">Budget {selectedPartner.label}:</span>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={partnerBudgetInput}
                      placeholder={String(effectivePartnerRemaining)}
                      onChange={e => setPartnerBudgetInput(e.target.value)}
                      className="w-16 rounded border bg-background px-2 py-1 text-center text-xs"
                    />
                    <span className="text-muted-foreground">UT</span>
                  </label>

                  {partnerHasDifferentWorkWeek && (
                    <label className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-medium">
                        Freie Wochentage ({formatWorkDaysLabel(selectedPartner.workDays)}):
                      </span>
                      <select
                        value={partnerOffWeekdayMode}
                        onChange={e => setPartnerOffWeekdayMode(e.target.value as PartnerOffWeekdayMode)}
                        className="rounded border bg-background px-2 py-1 text-xs"
                      >
                        <option value="bonus_only">Kein Einzel-Freitag-Spam</option>
                        <option value="allow_few_weekends">Max. 3 lange Wochenenden</option>
                        <option value="ignore">Ignorieren</option>
                      </select>
                    </label>
                  )}

                  <label className="flex cursor-pointer items-center gap-1.5">
                    <Switch checked={fillSoloAfterJoint} onCheckedChange={setFillSoloAfterJoint} />
                    <span className="text-muted-foreground">Rest-Budget danach alleine verplanen</span>
                  </label>
                </div>
              </div>
            )}
          </fieldset>
        )}

        {/* 1. Optimierungs-Strategie */}
        <div className="mb-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">1. Optimierungs-Ziel</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {([
              { id: 'balanced', icon: Sparkles, title: 'Smart & Ausgewogen', desc: 'Top-Brückentage + Haupturlaub' },
              { id: 'max_efficiency', icon: Flame, title: 'Max. freie Tage', desc: 'Höchste Effizienz pro Tag' },
              { id: 'long_breaks', icon: Sun, title: 'Lange Auszeiten', desc: 'Fokus auf 1–3 Wochen am Stück' },
              { id: 'distributed', icon: Compass, title: 'Regelmäßige Pausen', desc: 'Gleichmäßig übers Jahr verteilt' },
              { id: 'mini_breaks', icon: Zap, title: 'Viele Kurztrips', desc: 'Verlängerte Wochenenden (3–5T)' },
            ] as const).map(item => {
              const Icon = item.icon
              const active = (prefs.goal ?? 'balanced') === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => updateGoal(item.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors ${
                    active ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className="h-3.5 w-3.5 text-primary" /> {item.title}
                  </span>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">{item.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Schulferien-Strategie */}
        <div className="mb-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">2. Umgang mit Schulferien</span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {([
              { id: 'neutral', label: 'Neutral / Egal', sub: 'Nicht gewichten' },
              { id: 'prefer', label: 'Ferien bevorzugen', sub: 'Ideal für Familien' },
              { id: 'avoid', label: 'Eigene Ferien meiden', sub: 'Nebensaison nutzen' },
              { id: 'avoid_heatmap', label: 'Bundesweit meiden', sub: 'Wenig Ferien-Andrang' },
            ] as const).map(opt => {
              const active = (prefs.schoolStrategy ?? 'neutral') === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateSchoolStrategy(opt.id)}
                  aria-pressed={active}
                  className={`rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                    active ? 'border-primary bg-primary/10 font-medium ring-1 ring-primary' : 'hover:bg-muted/60'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.sub}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. Pflicht- & Wunschzeiträume (Einschlüsse) */}
        <div className="mb-4 rounded-xl border bg-muted/20 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> 3. Wunsch- &amp; Pflicht-Zeiträume einschließen (Optional)
            </span>
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => setRuleMode('months')}
                className={`rounded px-2 py-1 ${ruleMode === 'months' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground'}`}
              >
                Bestimmte Monate
              </button>
              <button
                type="button"
                onClick={() => setRuleMode('dates')}
                className={`rounded px-2 py-1 ${ruleMode === 'dates' ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground'}`}
              >
                Exakter Zeitraum / Tage
              </button>
            </div>
          </div>

          {ruleMode === 'months' ? (
            <div className="space-y-2.5 text-xs">
              <div className="flex flex-wrap gap-1">
                {MONTH_NAMES.map((name, idx) => {
                  const m = idx + 1
                  const active = ruleMonths.includes(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleRuleMonth(m)}
                      className={`rounded px-2 py-1 font-medium transition-colors ${
                        active ? 'bg-primary text-primary-foreground' : 'border bg-background hover:bg-muted'
                      }`}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Priorität"
                  value={ruleType}
                  onChange={e => setRuleType(e.target.value as 'must_have' | 'nice_to_have')}
                  className="rounded border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="must_have">Muss (Pflicht)</option>
                  <option value="nice_to_have">Wunsch (Bevorzugt)</option>
                </select>
                <select
                  aria-label="Dauer-Art"
                  value={ruleDurationMode}
                  onChange={e => setRuleDurationMode(e.target.value as 'min' | 'exact')}
                  className="rounded border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="min">Mindestens</option>
                  <option value="exact">Genau</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={ruleDays}
                  onChange={e => setRuleDays(Math.max(1, Number(e.target.value)))}
                  aria-label="Anzahl Urlaubstage"
                  className="w-16 rounded border bg-background px-2 py-1.5 text-center text-xs"
                />
                <span className="text-muted-foreground">Urlaubstage</span>
                <input
                  type="text"
                  placeholder="Bezeichnung (z.B. Sommerurlaub)"
                  value={ruleLabel}
                  onChange={e => setRuleLabel(e.target.value)}
                  className="min-w-0 w-full sm:w-auto sm:min-w-[140px] sm:flex-1 rounded border bg-background px-2.5 py-2 sm:px-2 sm:py-1.5 text-xs"
                />
                <Button type="button" size="sm" variant="secondary" onClick={handleAddRule} className="w-full sm:w-auto min-h-9 sm:min-h-0">
                  <Plus className="h-3.5 w-3.5" /> Einschließen
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                <span className="text-muted-foreground">Von:</span>
                <input
                  type="date"
                  value={ruleStartDate}
                  onChange={e => setRuleStartDate(e.target.value)}
                  className="rounded border bg-background px-2 py-1.5 text-xs"
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-muted-foreground">Bis:</span>
                <input
                  type="date"
                  value={ruleEndDate}
                  onChange={e => setRuleEndDate(e.target.value)}
                  className="rounded border bg-background px-2 py-1.5 text-xs"
                />
              </label>
              <select
                aria-label="Zeitraum-Modus"
                value={ruleDurationMode}
                onChange={e => setRuleDurationMode(e.target.value as 'min' | 'exact')}
                className="rounded border bg-background px-2 py-1.5 text-xs"
              >
                <option value="min">Kompletter Zeitraum frei</option>
                <option value="exact">Genau X Urlaubstage darin</option>
              </select>
              {ruleDurationMode === 'exact' && (
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={ruleDays}
                  onChange={e => setRuleDays(Math.max(1, Number(e.target.value)))}
                  className="w-14 rounded border bg-background px-2 py-1.5 text-center text-xs"
                />
              )}
              <input
                type="text"
                placeholder="Name (z.B. Betriebsferien)"
                value={ruleLabel}
                onChange={e => setRuleLabel(e.target.value)}
                className="min-w-0 w-full sm:w-auto sm:min-w-[130px] sm:flex-1 rounded border bg-background px-2.5 py-2 sm:px-2 sm:py-1.5 text-xs"
              />
              <Button type="button" size="sm" variant="secondary" onClick={handleAddRule} className="w-full sm:w-auto min-h-9 sm:min-h-0">
                <Plus className="h-3.5 w-3.5" /> Einschließen
              </Button>
            </div>
          )}

          {prefs.periodPreferences.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {prefs.periodPreferences.map((r, idx) => (
                <div key={r.id ?? idx} className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={r.type === 'nice_to_have' ? 'secondary' : 'default'} className="text-[10px]">
                      {r.type === 'exact_range' ? 'Fester Zeitraum' : r.type === 'must_have' ? 'Pflicht' : 'Wunsch'}
                    </Badge>
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted-foreground">
                      {r.type === 'exact_range'
                        ? r.exactDays
                          ? `(${r.exactDays} Tage in ${r.startDate} – ${r.endDate})`
                          : `(${r.startDate} bis ${r.endDate})`
                        : `(${r.exactDays ? `Genau ${r.exactDays}` : `Mind. ${r.minDuration}`} Urlaubstage in ${r.months.map(m => MONTH_NAMES[m - 1]).join(', ')})`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(idx)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label="Vorgabe entfernen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Grund-Toggles */}
        <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {([
            { key: 'preferBridgeDays', label: 'Brückentage bevorzugen' },
            { key: 'distributeEvenly', label: 'Gleichmäßig verteilen' },
            { key: 'halfDaysChristmas', label: '½ Tage Heiligabend/Silvester' },
            { key: 'allowSingleDayBridges', label: 'Einzelne Brückentage erlauben' },
          ] as const).map(({ key, label }) => (
            <label key={key} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-1 text-xs sm:text-sm">
              <Switch
                checked={Boolean(prefs[key])}
                onCheckedChange={v => setPrefs(p => ({ ...p, [key]: v }))}
              />
              <span className="min-w-0">{label}</span>
            </label>
          ))}
          <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-1 text-xs sm:text-sm">
            <Switch checked={overwrite} onCheckedChange={setOverwrite} />
            <span className="min-w-0">Vorhandene überschreiben</span>
          </label>
        </div>

        {/* 5. Aufklappbare Erweiterte Profi-Konfiguration (<details> / <summary>) */}
        <details className="group mb-4 rounded-xl border bg-muted/20 p-3 text-xs">
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-foreground">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Erweiterte Konfiguration: Planungs-Startdatum, Sperrzeiträume, Blockgrößen &amp; Effizienz
              {activeAdvancedCount > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {activeAdvancedCount} aktiv
                </span>
              )}
            </span>
            <span className="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
          </summary>

          <div className="mt-3.5 space-y-4 border-t pt-3.5">
            {/* A. Planungs-Zeitfenster / Startpunkt */}
            <div className="space-y-2">
              <span className="font-semibold text-foreground block">
                Ab wann soll der Algorithmus das Maximum herausholen?
              </span>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  { id: 'today', label: 'Ab heute', sub: 'Standard für laufendes Jahr' },
                  { id: 'year_start', label: `Ab Jahresbeginn`, sub: `01.01.${year} – 31.12.${year}` },
                  {
                    id: 'after_last_vacation',
                    label: 'Nach letztem Urlaub',
                    sub: lastPlannedVacationDate ? `Ab nach dem ${format(parseISO(lastPlannedVacationDate), 'dd.MM.')}` : 'Noch kein Urlaub geplant',
                  },
                  { id: 'custom_date', label: 'Ab Wunsch-Datum', sub: 'Freier Start- & Endtag' },
                ] as const).map(opt => {
                  const active = (prefs.planStartMode ?? 'today') === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePlanStartMode(opt.id)}
                      aria-pressed={active}
                      className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        active ? 'border-primary bg-primary/10 font-medium ring-1 ring-primary' : 'bg-background hover:bg-muted/60'
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.sub}</div>
                    </button>
                  )
                })}
              </div>

              {(prefs.planStartMode === 'custom_date' || prefs.customEndDate) && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-2.5">
                  <label className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Startdatum:</span>
                    <input
                      type="date"
                      min={`${year}-01-01`}
                      max={`${year}-12-31`}
                      value={prefs.customStartDate ?? `${year}-01-01`}
                      onChange={e => setPrefs(p => ({ ...p, planStartMode: 'custom_date', customStartDate: e.target.value }))}
                      className="rounded border bg-background px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Planen bis (optional):</span>
                    <input
                      type="date"
                      min={`${year}-01-01`}
                      max={`${year}-12-31`}
                      value={prefs.customEndDate ?? `${year}-12-31`}
                      onChange={e => setPrefs(p => ({ ...p, customEndDate: e.target.value || null }))}
                      className="rounded border bg-background px-2 py-1"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* B. Exakte Sperrzeiträume & Tage ausschließen */}
            <div className="space-y-2">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5 text-destructive" />
                Genaue Tage oder Zeiträume ausschließen (Urlaubssperre / wichtige Termine)
              </span>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2.5">
                <label className="flex items-center gap-1">
                  <span className="text-muted-foreground">Von:</span>
                  <input
                    type="date"
                    value={excludeStart}
                    onChange={e => {
                      setExcludeStart(e.target.value)
                      if (e.target.value > excludeEnd) setExcludeEnd(e.target.value)
                    }}
                    className="rounded border bg-background px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-muted-foreground">Bis:</span>
                  <input
                    type="date"
                    value={excludeEnd}
                    onChange={e => setExcludeEnd(e.target.value)}
                    className="rounded border bg-background px-2 py-1"
                  />
                </label>
                <input
                  type="text"
                  placeholder="Grund (z.B. Projekt-Phase, Messe)"
                  value={excludeLabel}
                  onChange={e => setExcludeLabel(e.target.value)}
                  className="min-w-0 w-full sm:w-auto sm:min-w-[140px] sm:flex-1 rounded border bg-background px-2.5 py-2 sm:px-2 sm:py-1 text-xs"
                />
                <Button type="button" size="sm" variant="outline" onClick={handleAddExcludeRange} className="h-9 sm:h-7 w-full sm:w-auto text-xs">
                  <Plus className="h-3.5 w-3.5" /> Zeitraum sperren
                </Button>
              </div>

              {(prefs.excludedDateRanges?.length ?? 0) > 0 && (
                <div className="space-y-1">
                  {prefs.excludedDateRanges!.map((ex, idx) => (
                    <div key={ex.id ?? idx} className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/5 px-2.5 py-1">
                      <span>
                        <strong>{ex.label}</strong>: {format(parseISO(ex.startDate), 'dd.MM.yyyy')} – {format(parseISO(ex.endDate), 'dd.MM.yyyy')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExcludeRange(idx)}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                        aria-label="Sperrzeitraum löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <span className="block text-muted-foreground mb-1">Oder ganze Monate ausschließen:</span>
                <div className="flex flex-wrap gap-1">
                  {MONTH_NAMES.map((name, idx) => {
                    const m = idx + 1
                    const avoided = (prefs.avoidMonths ?? []).includes(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleAvoidMonth(m)}
                        className={`rounded px-2 py-1 font-medium transition-colors ${
                          avoided ? 'bg-destructive text-destructive-foreground' : 'border bg-background hover:bg-muted'
                        }`}
                      >
                        {avoided ? `✕ ${name}` : name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <span className="block text-muted-foreground mb-1">Bevorzugte Reisemonate (weiche Priorität):</span>
                <div className="flex flex-wrap gap-1">
                  {MONTH_NAMES.map((name, idx) => {
                    const m = idx + 1
                    const preferred = (prefs.preferredMonths ?? []).includes(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => togglePreferredMonth(m)}
                        className={`rounded px-2 py-1 font-medium transition-colors ${
                          preferred ? 'bg-emerald-600 text-white' : 'border bg-background hover:bg-muted'
                        }`}
                      >
                        {preferred ? `★ ${name}` : name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Hinweis: Pflicht-Zeiträume (Abschnitt 3) haben immer Vorrang vor Sperrzeiträumen und ausgeschlossenen Monaten.
              </p>
            </div>

            {/* C. Block-Längen, Reserve, Mindestabstand, Mindest-Effizienz & Haupturlaub */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <label className="space-y-1">
                <span className="text-muted-foreground block">Min. Tage/Block</span>
                <input
                  type="number" min={1} max={30}
                  value={prefs.minDaysPerBlock}
                  onChange={e => setPrefs(p => ({ ...p, minDaysPerBlock: Math.max(1, Number(e.target.value)) }))}
                  className="min-h-9 w-full rounded border bg-background px-2 py-1 text-center"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground block">Max. Tage/Block</span>
                <input
                  type="number" min={1} max={60}
                  value={prefs.maxDaysPerBlock ?? ''}
                  placeholder="∞"
                  onChange={e => setPrefs(p => ({ ...p, maxDaysPerBlock: e.target.value ? Number(e.target.value) : null }))}
                  className="min-h-9 w-full rounded border bg-background px-2 py-1 text-center"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground block">Reserve zurückhalten</span>
                <input
                  type="number" min={0} max={30}
                  value={prefs.reserveDaysToKeep ?? 0}
                  onChange={e => setPrefs(p => ({ ...p, reserveDaysToKeep: Math.max(0, Number(e.target.value)) }))}
                  className="min-h-9 w-full rounded border bg-background px-2 py-1 text-center"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground block">Mindestabstand (Tage)</span>
                <input
                  type="number" min={0} max={120}
                  value={prefs.minGapDaysBetweenBlocks ?? 14}
                  onChange={e => setPrefs(p => ({ ...p, minGapDaysBetweenBlocks: Math.max(0, Number(e.target.value)) }))}
                  className="min-h-9 w-full rounded border bg-background px-2 py-1 text-center"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground block">Max. Anzahl Urlaube</span>
                <input
                  type="number" min={1} max={25}
                  value={prefs.maxBlocks ?? ''}
                  placeholder="∞"
                  onChange={e => setPrefs(p => ({ ...p, maxBlocks: e.target.value ? Math.max(1, Number(e.target.value)) : null }))}
                  className="min-h-9 w-full rounded border bg-background px-2 py-1 text-center"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground block">Min. Effizienz-Faktor</span>
                <select
                  value={prefs.minEfficiency ?? ''}
                  onChange={e => setPrefs(p => ({ ...p, minEfficiency: e.target.value ? Number(e.target.value) : null }))}
                  className="min-h-9 w-full rounded border bg-background px-2 py-1"
                >
                  <option value="">Alle zulassen</option>
                  <option value="1.5">Mind. 1,5x</option>
                  <option value="2">Mind. 2,0x</option>
                  <option value="2.5">Mind. 2,5x</option>
                  <option value="3">Mind. 3,0x (nur Top-Brücken)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground block">Haupturlaub erzwingen</span>
                <select
                  value={prefs.requireMainVacationDays ?? ''}
                  onChange={e => setPrefs(p => ({ ...p, requireMainVacationDays: e.target.value ? Number(e.target.value) : null }))}
                  className="min-h-9 w-full rounded border bg-background px-2 py-1"
                >
                  <option value="">Automatisch</option>
                  <option value="5">Mind. 1 Woche (5 UT)</option>
                  <option value="8">Mind. 2 Wochen (8+ UT)</option>
                  <option value="12">Mind. 3 Wochen (12+ UT)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground block">Notizen im Kalender</span>
                <select
                  value={prefs.noteHandling}
                  onChange={e => setPrefs(p => ({ ...p, noteHandling: e.target.value as NoteHandling }))}
                  className="min-h-9 w-full rounded border bg-background px-2 py-1"
                >
                  <option value="avoid">Bei Urlaub meiden</option>
                  <option value="prefer">Für Urlaub bevorzugen</option>
                  <option value="ignore">Ignorieren</option>
                </select>
              </label>
            </div>
          </div>
        </details>

        <Button onClick={handleGenerate} disabled={loading} className="w-full mb-4">
          {loading ? 'Optimaler Plan wird berechnet…' : '✨ Optimalen Urlaubsplan berechnen'}
        </Button>

        {error && <p className="text-destructive text-sm mb-3">{error}</p>}

        {suggestions.length > 0 && (
          <>
            {/* Gesamt-Zusammenfassung + Interaktive Kalender-Vorschau Button */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <div>
                <span className="font-semibold text-primary">Ergebnis:</span>{' '}
                Aus <strong>{formatDays(totalSuggestedCost)} Urlaubstagen</strong>
                {hasPartnerSuggestedDays && selectedPartner && (
                  <span>
                    {' '}
                    (+ <strong>{formatDays(totalPartnerSuggestedCost)} UT</strong> von {selectedPartner.label})
                  </span>
                )}{' '}
                holst du{' '}
                <strong className="text-green-600 dark:text-green-400">{totalFreeDaysGained} freie Tage</strong> heraus!
                <span className="ml-2 text-xs text-muted-foreground">
                  (Ø {avgEfficiency.toFixed(1)}x Effizienz · {suggestions.length} {suggestions.length === 1 ? 'Zeitraum' : 'Zeiträume'})
                </span>
              </div>
              {onOpenCalendarPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                  onClick={() => onOpenCalendarPreview(suggestions, overwrite)}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Auf Kalender interaktiv ziehen &amp; prüfen
                </Button>
              )}
            </div>

            <div className="space-y-2.5 mb-4">
              {suggestions.map((s, i) => {
                const isApplied = s.vacationDays.length > 0 && getMissingVacationDays(s).length === 0
                const removable = isApplied && Boolean(addedByBlock[i])
                const isExpanded = expandedBlock === i
                const partnerDays = s.partnerVacationDays ?? []
                const hasPartnerDays = partnerDays.length > 0
                const partnerCanEdit = Boolean(selectedPartner?.permission === 'edit' && selectedPartner?.token && onApplyPartner)
                const spanText = s.startDate && s.endDate
                  ? `${format(parseISO(s.startDate), 'dd.MM.yyyy', { locale: de })} – ${format(parseISO(s.endDate), 'dd.MM.yyyy', { locale: de })}`
                  : ''

                return (
                  <div key={s.id ?? i} className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{s.label}</span>
                        <span className="text-xs text-muted-foreground">{weekLabel(s.vacationDays.length > 0 ? s.vacationDays : partnerDays)}</span>
                        <Badge variant={s.efficiency >= 2 ? 'default' : 'secondary'} className="text-xs">
                          {s.efficiency.toFixed(1)}x Effizienz
                        </Badge>
                        {s.highlights?.map(tag => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                        {s.inSchoolHolidays && !(s.highlights ?? []).includes('Schulferien') && (
                          <Badge variant="outline" className="text-[11px] border-amber-400 text-amber-700 dark:text-amber-300">
                            🏫 In den Schulferien
                          </Badge>
                        )}
                        {Boolean(s.partnerFreeOverlapDays && s.partnerFreeOverlapDays > 0) && (
                          <Badge variant="outline" className="text-[11px] border-emerald-500/50 text-emerald-700 dark:text-emerald-300">
                            🤝 {s.partnerFreeOverlapDays} Tage gemeinsam frei
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-medium text-foreground/90 mb-0.5">
                        {hasPartnerDays && selectedPartner ? (
                          <>
                            Du: {formatDays(s.cost)} UT · {selectedPartner.label}: {formatDays(s.partnerCost ?? 0)} UT →{' '}
                            <span className="text-green-600 dark:text-green-400 font-semibold">{s.freeDaysGained} Tage gemeinsam frei</span>
                          </>
                        ) : (
                          <>
                            {formatDays(s.cost)} Urlaubstag{s.cost !== 1 ? 'e' : ''} → <span className="text-green-600 dark:text-green-400 font-semibold">{s.freeDaysGained} freie Tage am Stück</span>
                          </>
                        )}
                        {spanText && <span className="text-muted-foreground font-normal"> ({spanText})</span>}
                      </p>
                      {s.reason && (
                        <p className="text-xs text-muted-foreground mb-1.5">{s.reason}</p>
                      )}

                      {/* Quick interactive resize/move controls right inside the dialog */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-0.5">
                        {s.vacationDays.length > 0 && (
                          <>
                            <div className="inline-flex items-center rounded border bg-muted/40 px-1 py-0.5 gap-0.5" title="Starttag verschieben">
                              <span className="text-muted-foreground px-1">Start:</span>
                              <button type="button" onClick={() => handleAdjustBlock(i, 'start', -1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-background rounded px-1.5 font-bold" title="1 Tag früher starten">−1T</button>
                              <button type="button" onClick={() => handleAdjustBlock(i, 'start', 1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-background rounded px-1.5 font-bold" title="1 Tag später starten">+1T</button>
                            </div>
                            <div className="inline-flex items-center rounded border bg-muted/40 px-1 py-0.5 gap-0.5" title="Gesamten Block verschieben">
                              <button type="button" onClick={() => handleAdjustBlock(i, 'move', -1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-background rounded px-1.5 flex items-center justify-center" title="Block 1 Tag nach vorne schieben"><ChevronLeft className="h-3 w-3" /></button>
                              <span className="text-muted-foreground px-1">Schieben</span>
                              <button type="button" onClick={() => handleAdjustBlock(i, 'move', 1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-background rounded px-1.5 flex items-center justify-center" title="Block 1 Tag nach hinten schieben"><ChevronRight className="h-3 w-3" /></button>
                            </div>
                            <div className="inline-flex items-center rounded border bg-muted/40 px-1 py-0.5 gap-0.5" title="Endtag verschieben">
                              <span className="text-muted-foreground px-1">Ende:</span>
                              <button type="button" onClick={() => handleAdjustBlock(i, 'end', -1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-background rounded px-1.5 font-bold" title="1 Tag kürzer">−1T</button>
                              <button type="button" onClick={() => handleAdjustBlock(i, 'end', 1)} className="min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 hover:bg-background rounded px-1.5 font-bold" title="1 Tag länger">+1T</button>
                            </div>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedBlock(isExpanded ? null : i)}
                          className="ml-1 text-primary hover:underline"
                        >
                          {isExpanded ? 'Tage ausblenden ▲' : `Alle ${s.vacationDays.length + partnerDays.length} Tage ▼`}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                          {s.vacationDays.length > 0 && (
                            <ul className="text-xs text-muted-foreground space-y-0.5 border-l-2 border-primary/30 pl-2">
                              {hasPartnerDays && (
                                <li className="font-semibold text-foreground">Deine Tage ({s.vacationDays.length}):</li>
                              )}
                              {s.vacationDays.map(d => (
                                <li key={d}>{format(parseISO(d), 'dd.MM.yyyy (EEEE)', { locale: de })} · KW {getISOWeek(parseISO(d))}</li>
                              ))}
                            </ul>
                          )}
                          {hasPartnerDays && selectedPartner && (
                            <ul className="text-xs text-muted-foreground space-y-0.5 border-l-2 border-emerald-500/40 pl-2">
                              <li className="font-semibold text-foreground">
                                Tage für {selectedPartner.label} ({partnerDays.length}):
                              </li>
                              {partnerDays.map(d => (
                                <li key={d}>{format(parseISO(d), 'dd.MM.yyyy (EEEE)', { locale: de })} · KW {getISOWeek(parseISO(d))}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 w-full sm:w-auto shrink-0">
                      {hasPartnerDays && partnerCanEdit ? (
                        <>
                          <Button
                            size="sm"
                            variant={isApplied ? 'secondary' : 'default'}
                            onClick={() => void handleApplyOneBoth(i)}
                            disabled={busy || partnerApplying || isApplied}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {isApplied ? '✓ Übernommen' : 'Beide übernehmen'}
                          </Button>
                          {!isApplied && s.vacationDays.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApplyOne(i)}
                              disabled={busy}
                              className="w-full sm:w-auto text-xs"
                            >
                              Nur meine
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          {s.vacationDays.length > 0 && (
                            <Button
                              size="sm"
                              variant={isApplied ? 'secondary' : 'default'}
                              onClick={() => removable ? handleRemoveOne(i) : handleApplyOne(i)}
                              disabled={busy || (isApplied && !removable)}
                              aria-pressed={isApplied}
                              title={removable ? 'Klicken, um den Vorschlag wieder zu entfernen' : undefined}
                              className="w-full sm:w-auto shrink-0"
                            >
                              {removable ? <>✓ Übernommen <X className="h-3.5 w-3.5" /></> : isApplied ? '✓ Bereits geplant' : 'Übernehmen'}
                            </Button>
                          )}
                          {hasPartnerDays && selectedPartner && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleCopyPartnerDates(partnerDays, `blk-${i}`)}
                              className="w-full sm:w-auto text-xs gap-1"
                            >
                              {copiedPartnerKey === `blk-${i}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              {copiedPartnerKey === `blk-${i}` ? 'Kopiert!' : `${selectedPartner.label}-Tage kopieren`}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              {onOpenCalendarPreview && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenCalendarPreview(suggestions, overwrite)}
                  className="w-full sm:w-auto gap-1.5 border-teal-500/50 text-teal-700 dark:text-teal-300"
                >
                  <MapIcon className="h-4 w-4" />
                  Auf dem Kalender einblenden &amp; ziehen
                </Button>
              )}
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                {hasPartnerSuggestedDays && selectedPartner?.permission === 'edit' && selectedPartner?.token && onApplyPartner ? (
                  <>
                    <Button
                      onClick={() => void handleApplyAllWithPartner()}
                      disabled={busy || partnerApplying}
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {partnerApplying ? 'Wird übertragen…' : 'Alle in beide Kalender übernehmen'}
                    </Button>
                    <Button variant="outline" onClick={handleApplyAll} disabled={busy} className="w-full sm:w-auto">
                      Nur in meinen Kalender
                    </Button>
                  </>
                ) : (
                  <>
                    {hasPartnerSuggestedDays && selectedPartner && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          void handleCopyPartnerDates(
                            [...new Set(suggestions.flatMap(s => s.partnerVacationDays ?? []))].sort(),
                            'all-partner',
                          )
                        }
                        className="w-full sm:w-auto gap-1"
                      >
                        {copiedPartnerKey === 'all-partner' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedPartnerKey === 'all-partner' ? 'Kopiert!' : `${selectedPartner.label}-Tage kopieren`}
                      </Button>
                    )}
                    <Button variant="outline" onClick={handleApplyAll} disabled={busy} className="w-full sm:w-auto">
                      {hasPartnerSuggestedDays ? 'Meine Tage übernehmen' : 'Alle übernehmen'}
                    </Button>
                  </>
                )}
                <Button onClick={onClose} className="w-full sm:w-auto">Schließen</Button>
              </div>
            </div>
          </>
        )}

        {suggestions.length === 0 && !loading && !error && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Wähle deine Strategie und klicke auf „Optimalen Urlaubsplan berechnen“.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
