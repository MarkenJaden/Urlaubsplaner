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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">✨ Optimaler Urlaubsplan</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Konfiguriere deine Präferenzen und lass den Planer optimale Urlaubsblöcke berechnen.
        </p>

        {/* Preferences */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          {([
            { key: 'preferBridgeDays', label: 'Brückentage bevorzugen' },
            { key: 'distributeEvenly', label: 'Gleichmäßig verteilen' },
            { key: 'preferSchoolHolidays', label: 'Schulferien bevorzugen' },
            { key: 'avoidSchoolHolidays', label: 'Schulferien meiden' },
            { key: 'halfDaysChristmas', label: '½ Tage Heiligabend/Silvester' },
            { key: 'planFromToday', label: 'Ab heute planen' },
          ] as const).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={prefs[key] as boolean}
                onCheckedChange={v => setPrefs(p => ({ ...p, [key]: v }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Min. Tage/Block:</span>
            <input
              type="number" min={1} max={30}
              value={prefs.minDaysPerBlock}
              onChange={e => setPrefs(p => ({ ...p, minDaysPerBlock: Number(e.target.value) }))}
              className="w-16 border rounded px-2 py-1 bg-background text-center"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Max. Tage/Block:</span>
            <input
              type="number" min={1} max={30}
              value={prefs.maxDaysPerBlock ?? ''}
              placeholder="∞"
              onChange={e => setPrefs(p => ({ ...p, maxDaysPerBlock: e.target.value ? Number(e.target.value) : null }))}
              className="w-16 border rounded px-2 py-1 bg-background text-center"
            />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={overwrite} onCheckedChange={setOverwrite} />
            <span>Vorhandene überschreiben</span>
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
                <div key={i} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{s.label}</span>
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
                  >
                    {applied.has(i) ? '✓ Übernommen' : 'Übernehmen'}
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>Schließen</Button>
              <Button onClick={handleApplyAll}>Alle übernehmen</Button>
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
