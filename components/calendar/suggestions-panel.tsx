'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import type { VacationSuggestionBlock, PlanningPreferences } from '@/lib/vacation-suggester'
import { DEFAULT_PREFERENCES } from '@/lib/vacation-suggester'
import { format, getISOWeek, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import type { EntryType } from '@/types'
import { formatDays } from '@/lib/vacation-accounting'

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
  /** Budget left after the planned days (shared vacation accounting). */
  remainingDays: number
  /** Full budget; used when existing vacation days are replaced. */
  totalDays: number
  halfDaysChristmas: boolean
  existingVacationDates: string[]
  noteDates: string[]
  onApply: (dates: string[], type: EntryType, replace: boolean) => void
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
}: SuggestionsPanelProps) {
  const [prefs, setPrefs] = useState<PlanningPreferences>({ ...DEFAULT_PREFERENCES, halfDaysChristmas })
  const [overwrite, setOverwrite] = useState(false)
  const [suggestions, setSuggestions] = useState<VacationSuggestionBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Once single blocks are picked, "Alle übernehmen" would add the rest too, so it is hidden.
  const [pickedSingle, setPickedSingle] = useState(false)
  const used = totalDays - remainingDays
  // Follow the half-day setting of the plan whenever the dialog opens.
  useEffect(() => { if (open) setPrefs(p => ({ ...p, halfDaysChristmas })) }, [open, halfDaysChristmas])
  const existingVacationSet = useMemo(() => new Set(existingVacationDates), [existingVacationDates])

  const getMissingVacationDays = (suggestion: VacationSuggestionBlock): string[] => {
    return suggestion.vacationDays.filter(date => !existingVacationSet.has(date))
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setPickedSingle(false)
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
    setPickedSingle(true)
    onApply(missingDates, 'vacation', false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="mb-1 pr-10 text-xl font-bold leading-tight tracking-normal">✨ Optimaler Urlaubsplan</DialogTitle>
        <p className="text-sm text-muted-foreground mb-2">
          Konfiguriere deine Präferenzen und lass den Planer optimale Urlaubsblöcke berechnen.
        </p>
        <p role="status" className="mb-4 text-sm">
          Verbraucht: <strong>{formatDays(used)}</strong> von {formatDays(totalDays)} Tagen ·{' '}
          <span className={remainingDays < 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}>{formatDays(remainingDays)} übrig</span>
        </p>

        {/* Preferences */}
        <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:gap-3">
          {([
            { key: 'preferBridgeDays', label: 'Brückentage bevorzugen' },
            { key: 'distributeEvenly', label: 'Gleichmäßig verteilen' },
            { key: 'preferSchoolHolidays', label: 'Schulferien bevorzugen' },
            { key: 'avoidSchoolHolidays', label: 'Schulferien meiden' },
            { key: 'halfDaysChristmas', label: '½ Tage Heiligabend/Silvester' },
            { key: 'planFromToday', label: 'Ab heute planen' },
          ] as const).map(({ key, label }) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1">
              <Switch
                checked={prefs[key] as boolean}
                onCheckedChange={v => setPrefs(p => ({ ...p, [key]: v }))}
              />
              <span className="min-w-0">{label}</span>
            </label>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr] lg:items-center">
          <label className="grid gap-1 sm:grid-cols-[1fr_4rem] sm:items-center">
            <span className="text-muted-foreground">Min. Tage/Block:</span>
            <input
              type="number" min={1} max={30}
              value={prefs.minDaysPerBlock}
              onChange={e => setPrefs(p => ({ ...p, minDaysPerBlock: Number(e.target.value) }))}
              className="min-h-11 w-full rounded border bg-background px-2 py-2 text-center sm:w-16"
            />
          </label>
          <label className="grid gap-1 sm:grid-cols-[1fr_4rem] sm:items-center">
            <span className="text-muted-foreground">Max. Tage/Block:</span>
            <input
              type="number" min={1} max={30}
              value={prefs.maxDaysPerBlock ?? ''}
              placeholder="∞"
              onChange={e => setPrefs(p => ({ ...p, maxDaysPerBlock: e.target.value ? Number(e.target.value) : null }))}
              className="min-h-11 w-full rounded border bg-background px-2 py-2 text-center sm:w-16"
            />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1 sm:col-span-2 lg:col-span-1">
            <Switch checked={overwrite} onCheckedChange={setOverwrite} />
            <span className="min-w-0">Vorhandene überschreiben</span>
          </label>
        </div>

        <Button onClick={handleGenerate} disabled={loading} className="w-full mb-4">
          {loading ? 'Berechne...' : '📅 Vorschläge berechnen'}
        </Button>

        {error && <p className="text-destructive text-sm mb-3">{error}</p>}

        {suggestions.length > 0 && (
          <>
            <div className="space-y-3 mb-4">
              {suggestions.map((s, i) => {
                const isApplied = getMissingVacationDays(s).length === 0
                return (
                  <div key={i} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{s.label}</span>
                        <span className="text-xs text-muted-foreground">{weekLabel(s.vacationDays)}</span>
                        <Badge variant={s.efficiency >= 2 ? 'default' : 'secondary'} className="text-xs">
                          {s.efficiency.toFixed(1)}x Effizienz
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {s.cost} Urlaubstag{s.cost !== 1 ? 'e' : ''} → {s.freeDaysGained} freie Tage
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {s.vacationDays.map(d => (
                          <li key={d}>{format(parseISO(d), 'dd.MM.yyyy (EEEE)', { locale: de })} · KW {getISOWeek(parseISO(d))}</li>
                        ))}
                      </ul>
                    </div>
                    <Button
                      size="sm"
                      variant={isApplied ? 'secondary' : 'default'}
                      onClick={() => handleApplyOne(i)}
                      disabled={isApplied}
                      className="w-full sm:w-auto"
                    >
                      {isApplied ? '✓ Übernommen' : 'Übernehmen'}
                    </Button>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {!pickedSingle && <Button variant="outline" onClick={handleApplyAll} className="w-full sm:w-auto">Alle übernehmen</Button>}
              <Button onClick={onClose} className="w-full sm:w-auto">Schließen</Button>
            </div>
          </>
        )}

        {suggestions.length === 0 && !loading && !error && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Klicke auf „Vorschläge berechnen“ um zu starten.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
