'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { X, Plus, Trash2, Sparkles, Calendar, Flame, Sun, Compass, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import type { VacationSuggestionBlock, PlanningPreferences, PeriodPreference } from '@/lib/vacation-suggester'
import { DEFAULT_PREFERENCES } from '@/lib/vacation-suggester'
import { format, getISOWeek, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import type { EntryType, OptimizationGoal, SchoolHolidayStrategy, NoteHandling } from '@/types'
import { formatDays } from '@/lib/vacation-accounting'

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function weekLabel(dates: string[]): string {
  const weeks = [...new Set(dates.map(d => getISOWeek(parseISO(d))))]
  if (weeks.length === 0) return ''
  return weeks.length === 1 ? `KW ${weeks[0]}` : `KW ${weeks[0]}–${weeks[weeks.length - 1]}`
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
  existingVacationDates: string[]
  noteDates: string[]
  onApply: (dates: string[], type: EntryType, replace: boolean) => void
  onRemove: (dates: string[]) => void
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
  existingVacationDates,
  noteDates,
  onApply,
  onRemove,
  busy = false,
}: SuggestionsPanelProps) {
  const [prefs, setPrefs] = useState<PlanningPreferences>({ ...DEFAULT_PREFERENCES, halfDaysChristmas })
  const [overwrite, setOverwrite] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [suggestions, setSuggestions] = useState<VacationSuggestionBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addedByBlock, setAddedByBlock] = useState<Record<number, string[]>>({})
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null)

  // New rule builder state
  const [ruleMode, setRuleMode] = useState<'months' | 'dates'>('months')
  const [ruleType, setRuleType] = useState<'must_have' | 'nice_to_have'>('must_have')
  const [ruleMonths, setRuleMonths] = useState<number[]>([7, 8])
  const [ruleDurationMode, setRuleDurationMode] = useState<'min' | 'exact'>('min')
  const [ruleDays, setRuleDays] = useState<number>(10)
  const [ruleStartDate, setRuleStartDate] = useState<string>(`${year}-07-13`)
  const [ruleEndDate, setRuleEndDate] = useState<string>(`${year}-07-24`)
  const [ruleLabel, setRuleLabel] = useState<string>('')

  const pickedSingle = Object.keys(addedByBlock).length > 0
  const used = totalDays - remainingDays
  const availableBudget = Math.max(0, (overwrite ? totalDays : remainingDays) - (prefs.reserveDaysToKeep ?? 0))

  useEffect(() => {
    if (open) {
      setPrefs(p => ({ ...p, halfDaysChristmas }))
      setRuleStartDate(`${year}-07-13`)
      setRuleEndDate(`${year}-07-24`)
    }
  }, [open, halfDaysChristmas, year])

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

  const toggleAvoidMonth = (monthNumber: number) => {
    setPrefs(p => {
      const current = p.avoidMonths ?? []
      const next = current.includes(monthNumber)
        ? current.filter(m => m !== monthNumber)
        : [...current, monthNumber].sort((a, b) => a - b)
      return { ...p, avoidMonths: next }
    })
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

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setAddedByBlock({})
    try {
      const params = new URLSearchParams({
        country,
        year: String(year),
        remainingDays: String(Math.max(0, overwrite ? totalDays : remainingDays)),
        overwrite: String(overwrite),
        preferences: JSON.stringify(prefs),
        existingDates: existingVacationDates.join(','),
        noteDates: noteDates.join(','),
      })
      if (subdivision) params.set('subdivision', subdivision)
      if (group) params.set('group', group)
      const res = await fetch(`/api/suggestions?${params}`)
      if (!res.ok) throw new Error(res.status === 502 ? 'Feiertage konnten nicht geladen werden. Bitte erneut versuchen.' : 'Fehler beim Laden der Vorschläge')
      setSuggestions(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
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
  const totalFreeDaysGained = useMemo(() => suggestions.reduce((sum, s) => sum + s.freeDaysGained, 0), [suggestions])
  const avgEfficiency = totalSuggestedCost > 0 ? totalFreeDaysGained / totalSuggestedCost : 0

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="mb-1 pr-10 text-xl font-bold leading-tight tracking-normal flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Smart-Urlaubsplaner {year}
        </DialogTitle>
        <p className="text-sm text-muted-foreground mb-3">
          Hole das absolute Maximum aus deinen Urlaubstagen, Feiertagen, Brückentagen und Wunschzeiträumen heraus.
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

        {/* 1. Optimierungs-Strategie */}
        <div className="mb-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">1. Optimierungs-Ziel</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              { id: 'balanced', icon: Sparkles, title: 'Smart & Ausgewogen', desc: 'Top-Brückentage + Haupturlaub' },
              { id: 'max_efficiency', icon: Flame, title: 'Max. freie Tage', desc: 'Höchste Effizienz pro Tag' },
              { id: 'long_breaks', icon: Sun, title: 'Lange Auszeiten', desc: 'Fokus auf 1–3 Wochen am Stück' },
              { id: 'distributed', icon: Compass, title: 'Regelmäßige Pausen', desc: 'Gleichmäßig übers Jahr verteilt' },
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

        {/* 2. Schulferien-Strategie (Konsistent, kein Widerspruch möglich!) */}
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

        {/* 3. Pflicht- & Wunschzeiträume (Individuelle Vorgaben) */}
        <div className="mb-4 rounded-xl border bg-muted/20 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> 3. Wunsch- & Pflicht-Zeiträume (Optional)
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
                Fester Zeitraum (Datum)
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
                  className="min-w-[140px] flex-1 rounded border bg-background px-2 py-1.5 text-xs"
                />
                <Button type="button" size="sm" variant="secondary" onClick={handleAddRule}>
                  <Plus className="h-3.5 w-3.5" /> Hinzufügen
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
                className="min-w-[130px] flex-1 rounded border bg-background px-2 py-1.5 text-xs"
              />
              <Button type="button" size="sm" variant="secondary" onClick={handleAddRule}>
                <Plus className="h-3.5 w-3.5" /> Hinzufügen
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

        {/* 4. Grund-Toggles & Erweiterte Einstellungen */}
        <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {([
            { key: 'preferBridgeDays', label: 'Brückentage bevorzugen' },
            { key: 'distributeEvenly', label: 'Gleichmäßig verteilen' },
            { key: 'halfDaysChristmas', label: '½ Tage Heiligabend/Silvester' },
            { key: 'planFromToday', label: 'Ab heute planen' },
            { key: 'allowSingleDayBridges', label: 'Einzelne Brückentage erlauben' },
          ] as const).map(({ key, label }) => (
            <label key={key} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-1 text-xs sm:text-sm">
              <Switch
                checked={Boolean(prefs[key])}
                onCheckedChange={v => setPrefs(p => ({ ...p, [key]: v }))}
              />
              <span className="min-w-0">{label}</span>
            </label>
          ))}
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-1 text-xs sm:text-sm">
            <Switch checked={overwrite} onCheckedChange={setOverwrite} />
            <span className="min-w-0">Vorhandene überschreiben</span>
          </label>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <label className="space-y-1">
            <span className="text-muted-foreground block">Min. Tage/Block</span>
            <input
              type="number" min={1} max={30}
              value={prefs.minDaysPerBlock}
              onChange={e => setPrefs(p => ({ ...p, minDaysPerBlock: Math.max(1, Number(e.target.value)) }))}
              className="min-h-10 w-full rounded border bg-background px-2 py-1.5 text-center text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground block">Max. Tage/Block</span>
            <input
              type="number" min={1} max={60}
              value={prefs.maxDaysPerBlock ?? ''}
              placeholder="∞"
              onChange={e => setPrefs(p => ({ ...p, maxDaysPerBlock: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-10 w-full rounded border bg-background px-2 py-1.5 text-center text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground block">Reserve zurückhalten</span>
            <input
              type="number" min={0} max={30}
              value={prefs.reserveDaysToKeep ?? 0}
              onChange={e => setPrefs(p => ({ ...p, reserveDaysToKeep: Math.max(0, Number(e.target.value)) }))}
              className="min-h-10 w-full rounded border bg-background px-2 py-1.5 text-center text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground block">Notizen im Kalender</span>
            <select
              value={prefs.noteHandling}
              onChange={e => setPrefs(p => ({ ...p, noteHandling: e.target.value as NoteHandling }))}
              className="min-h-10 w-full rounded border bg-background px-2 py-1.5 text-xs"
            >
              <option value="avoid">Bei Urlaub meiden</option>
              <option value="prefer">Für Urlaub bevorzugen</option>
              <option value="ignore">Ignorieren</option>
            </select>
          </label>
        </div>

        {/* Collapsible: Monate ausschließen */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Monate ausschließen / Mindestabstand ({(prefs.avoidMonths?.length ?? 0) > 0 ? `${prefs.avoidMonths!.length} ausgeschlossen` : 'optional'})
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showAdvanced && (
            <div className="mt-2 rounded-lg border bg-muted/20 p-3 space-y-3 text-xs">
              <div>
                <span className="block text-muted-foreground mb-1.5">Keinen Urlaub in diesen Monaten vorschlagen:</span>
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
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">Mindestabstand zwischen zwei Urlaubsblöcken (Tage):</span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={prefs.minGapDaysBetweenBlocks ?? 14}
                  onChange={e => setPrefs(p => ({ ...p, minGapDaysBetweenBlocks: Math.max(0, Number(e.target.value)) }))}
                  className="w-16 rounded border bg-background px-2 py-1 text-center"
                />
              </label>
            </div>
          )}
        </div>

        <Button onClick={handleGenerate} disabled={loading} className="w-full mb-4">
          {loading ? 'Optimaler Plan wird berechnet…' : '✨ Optimalen Urlaubsplan berechnen'}
        </Button>

        {error && <p className="text-destructive text-sm mb-3">{error}</p>}

        {suggestions.length > 0 && (
          <>
            {/* Gesamt-Zusammenfassung */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <div>
                <span className="font-semibold text-primary">Ergebnis:</span>{' '}
                Aus <strong>{formatDays(totalSuggestedCost)} Urlaubstagen</strong> holst du{' '}
                <strong className="text-green-600 dark:text-green-400">{totalFreeDaysGained} freie Tage</strong> heraus!
              </div>
              <Badge variant="default" className="text-xs">
                Ø {avgEfficiency.toFixed(1)}x Effizienz · {suggestions.length} {suggestions.length === 1 ? 'Zeitraum' : 'Zeiträume'}
              </Badge>
            </div>

            <div className="space-y-2.5 mb-4">
              {suggestions.map((s, i) => {
                const isApplied = getMissingVacationDays(s).length === 0
                const removable = isApplied && Boolean(addedByBlock[i])
                const isExpanded = expandedBlock === i
                const spanText = s.startDate && s.endDate
                  ? `${format(parseISO(s.startDate), 'dd.MM.yyyy', { locale: de })} – ${format(parseISO(s.endDate), 'dd.MM.yyyy', { locale: de })}`
                  : ''

                return (
                  <div key={i} className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{s.label}</span>
                        <span className="text-xs text-muted-foreground">{weekLabel(s.vacationDays)}</span>
                        <Badge variant={s.efficiency >= 2 ? 'default' : 'secondary'} className="text-xs">
                          {s.efficiency.toFixed(1)}x Effizienz
                        </Badge>
                        {s.inSchoolHolidays && (
                          <Badge variant="outline" className="text-[11px] border-amber-400 text-amber-700 dark:text-amber-300">
                            🏫 In den Schulferien
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-medium text-foreground/90 mb-0.5">
                        {formatDays(s.cost)} Urlaubstag{s.cost !== 1 ? 'e' : ''} → <span className="text-green-600 dark:text-green-400 font-semibold">{s.freeDaysGained} freie Tage am Stück</span>
                        {spanText && <span className="text-muted-foreground font-normal"> ({spanText})</span>}
                      </p>
                      {s.reason && (
                        <p className="text-xs text-muted-foreground mb-1">{s.reason}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedBlock(isExpanded ? null : i)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {isExpanded ? 'Urlaubstage ausblenden ▲' : `Alle ${s.vacationDays.length} Urlaubstage anzeigen ▼`}
                      </button>
                      {isExpanded && (
                        <ul className="mt-1.5 text-xs text-muted-foreground space-y-0.5 border-l-2 border-primary/30 pl-2">
                          {s.vacationDays.map(d => (
                            <li key={d}>{format(parseISO(d), 'dd.MM.yyyy (EEEE)', { locale: de })} · KW {getISOWeek(parseISO(d))}</li>
                          ))}
                        </ul>
                      )}
                    </div>
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
                  </div>
                )
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleApplyAll} disabled={busy} className="w-full sm:w-auto">Alle übernehmen</Button>
              <Button onClick={onClose} className="w-full sm:w-auto">Schließen</Button>
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
