'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import type { VacationSuggestionBlock, PlanningPreferences } from '@/lib/vacation-suggester'
import { DEFAULT_PREFERENCES } from '@/lib/vacation-suggester'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import type { EntryType } from '@/types'

interface SuggestionsPanelProps {
  open: boolean
  onClose: () => void
  year: number
  country: string
  subdivision?: string
  remainingDays: number
  existingVacationDates: string[]
  noteDates: string[]
  onApply: (dates: string[], type: EntryType) => void
}

export function SuggestionsPanel({
  open,
  onClose,
  year,
  country,
  subdivision,
  remainingDays,
  existingVacationDates,
  noteDates,
  onApply,
}: SuggestionsPanelProps) {
  const [prefs, setPrefs] = useState<PlanningPreferences>({ ...DEFAULT_PREFERENCES })
  const [overwrite, setOverwrite] = useState(false)
  const [suggestions, setSuggestions] = useState<VacationSuggestionBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState<Set<number>>(new Set())

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setApplied(new Set())
    try {
      const params = new URLSearchParams({
        country,
        year: String(year),
        remainingDays: String(remainingDays),
        overwrite: String(overwrite),
        preferences: JSON.stringify(prefs),
        existingDates: existingVacationDates.join(','),
        noteDates: noteDates.join(','),
      })
      if (subdivision) params.set('subdivision', subdivision)
      const res = await fetch(`/api/suggestions?${params}`)
      if (!res.ok) throw new Error('Fehler beim Laden der Vorschläge')
      setSuggestions(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyAll = () => {
    const allDates = suggestions.flatMap(s => s.vacationDays)
    onApply(allDates, 'vacation')
    setApplied(new Set(suggestions.map((_, i) => i)))
  }

  const handleApplyOne = (idx: number) => {
    onApply(suggestions[idx].vacationDays, 'vacation')
    setApplied(prev => new Set([...prev, idx]))
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <h2 className="mb-1 pr-10 text-xl font-bold">✨ Optimaler Urlaubsplan</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Konfiguriere deine Präferenzen und lass den Planer optimale Urlaubsblöcke berechnen.
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
              {suggestions.map((s, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{s.label}</span>
                      <Badge variant={s.efficiency >= 2 ? 'default' : 'secondary'} className="text-xs">
                        {s.efficiency.toFixed(1)}x Effizienz
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {s.cost} Urlaubstag{s.cost !== 1 ? 'e' : ''} → {s.freeDaysGained} freie Tage
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {s.vacationDays.map(d => (
                        <li key={d}>{format(parseISO(d), 'dd.MM.yyyy (EEEE)', { locale: de })}</li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    size="sm"
                    variant={applied.has(i) ? 'secondary' : 'default'}
                    onClick={() => handleApplyOne(i)}
                    disabled={applied.has(i)}
                    className="w-full sm:w-auto"
                  >
                    {applied.has(i) ? '✓ Übernommen' : 'Übernehmen'}
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Schließen</Button>
              <Button onClick={handleApplyAll} className="w-full sm:w-auto">Alle übernehmen</Button>
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
