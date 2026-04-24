'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Combobox, MultiCombobox } from '@/components/ui/combobox'
import type { ComboboxOption } from '@/components/ui/combobox'
import { getSubdivisionAliases } from '@/lib/subdivision-aliases'
import type { Subdivision, Country } from '@/types'

interface SettingsPanelProps {
  subdivisions: Subdivision[]
  subdivision?: string
  onSubdivisionChange: (code: string) => void
  compareSubdivisions: string[]
  onCompareChange: (codes: string[]) => void
  countries: Country[]
  selectedCountries: string[]
  onCountriesChange: (codes: string[]) => void
  vacationDaysTotal: number
  onVacationDaysChange: (n: number) => void
  countWeekendsAsVacation: boolean
  onCountWeekendsChange: (v: boolean) => void
  halfDaysChristmas: boolean
  onHalfDaysChange: (v: boolean) => void
  vacationDaysUsed: number
  gleittageCount: number
  remainingWorkDays: number
  defaultNoteText: string
  onDefaultNoteTextChange: (text: string) => void
  apiError?: boolean
  onRetryApi?: () => void
}

function getSubName(sub: Subdivision): string {
  return sub.name.find(n => n.language === 'DE')?.text ?? sub.shortName ?? sub.code
}

function getCountryName(c: Country): string {
  return c.name.find(n => n.language === 'DE')?.text ?? c.isoCode
}

export function SettingsPanel({
  subdivisions, subdivision, onSubdivisionChange,
  compareSubdivisions, onCompareChange,
  countries, selectedCountries, onCountriesChange,
  vacationDaysTotal, onVacationDaysChange,
  countWeekendsAsVacation, onCountWeekendsChange,
  halfDaysChristmas, onHalfDaysChange,
  vacationDaysUsed, gleittageCount, remainingWorkDays,
  defaultNoteText, onDefaultNoteTextChange,
  apiError, onRetryApi,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(true)
  const remaining = vacationDaysTotal - vacationDaysUsed

  const subdivisionOptions: ComboboxOption[] = useMemo(() =>
    subdivisions.map(s => ({
      value: s.code,
      label: getSubName(s),
      aliases: getSubdivisionAliases(s.code),
    })),
  [subdivisions])

  const compareOptions: ComboboxOption[] = useMemo(() =>
    subdivisions.map(s => ({
      value: s.code,
      label: getSubName(s),
      aliases: getSubdivisionAliases(s.code),
    })),
  [subdivisions])

  const countryOptions: ComboboxOption[] = useMemo(() =>
    countries
      .filter(c => c.isoCode !== 'DE')
      .map(c => ({
        value: c.isoCode,
        label: getCountryName(c),
        aliases: [c.isoCode],
      })),
  [countries])

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>\u2699\ufe0f Einstellungen & Statistik</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="p-3 pt-0 space-y-4 text-sm">
          {apiError && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">OpenHolidays API nicht erreichbar. Feiertage/Ferien nicht verf\u00fcgbar.</span>
              {onRetryApi && (
                <Button size="sm" variant="outline" onClick={onRetryApi}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Erneut versuchen
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Spalte 1: Standort */}
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground">Standort & Regionen</h4>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mein Bundesland</label>
                <Combobox
                  options={subdivisionOptions}
                  value={subdivision}
                  onChange={onSubdivisionChange}
                  placeholder="Bundesland w\u00e4hlen..."
                  searchPlaceholder="z.B. NRW, Bayern..."
                  emptyText="Kein Bundesland gefunden"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Vergleichs-Regionen (Heatmap)</label>
                <MultiCombobox
                  options={compareOptions}
                  value={compareSubdivisions}
                  onChange={onCompareChange}
                  placeholder="Regionen vergleichen..."
                  searchPlaceholder="z.B. NRW, Bayern..."
                  emptyText="Kein Bundesland gefunden"
                />
              </div>

              {countryOptions.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Zus\u00e4tzliche L\u00e4nder</label>
                  <MultiCombobox
                    options={countryOptions}
                    value={selectedCountries}
                    onChange={onCountriesChange}
                    placeholder="L\u00e4nder hinzuf\u00fcgen..."
                    searchPlaceholder="z.B. \u00d6sterreich, AT..."
                    emptyText="Kein Land gefunden"
                  />
                </div>
              )}
            </div>

            {/* Spalte 2: Berechnungsoptionen */}
            <div className="space-y-2">
              <h4 className="font-medium text-muted-foreground">Berechnungsoptionen</h4>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={countWeekendsAsVacation}
                  onChange={e => onCountWeekendsChange(e.target.checked)} className="rounded" />
                <span className="text-xs">Wochenende als Urlaubstage z\u00e4hlen</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={halfDaysChristmas}
                  onChange={e => onHalfDaysChange(e.target.checked)} className="rounded" />
                <span className="text-xs">24./31.12. als halbe Tage z\u00e4hlen (0,5)</span>
              </label>

              <div className="mt-3">
                <label className="text-xs text-muted-foreground">Urlaubsanspruch (Tage)</label>
                <input type="number" min={0} max={60} value={vacationDaysTotal}
                  onChange={e => onVacationDaysChange(Number(e.target.value) || 30)}
                  className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-right" />
              </div>

              <div className="mt-3">
                <label className="text-xs text-muted-foreground">Standard-Notiztext</label>
                <input type="text" placeholder="z.B. Arzt, Geburtstag" value={defaultNoteText}
                  onChange={e => onDefaultNoteTextChange(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
                <p className="text-xs text-muted-foreground mt-0.5">Wird beim Erstellen neuer Notizen verwendet</p>
              </div>
            </div>

            {/* Spalte 3: Statistik */}
            <div className="space-y-2">
              <h4 className="font-medium text-muted-foreground">Statistik</h4>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-2">
                  <div className="text-xs text-muted-foreground">Verplant</div>
                  <div className="text-lg font-bold text-blue-600">{vacationDaysUsed}</div>
                </div>
                <div className={`rounded-md p-2 ${remaining < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                  <div className="text-xs text-muted-foreground">Verbleibend</div>
                  <div className={`text-lg font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>{remaining}</div>
                </div>
                <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 p-2">
                  <div className="text-xs text-muted-foreground">Gleittage</div>
                  <div className="text-lg font-bold text-purple-600">{gleittageCount}</div>
                </div>
                <div className="rounded-md bg-orange-50 dark:bg-orange-900/20 p-2">
                  <div className="text-xs text-muted-foreground">Arbeitstage</div>
                  <div className="text-lg font-bold text-orange-600">{remainingWorkDays}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
