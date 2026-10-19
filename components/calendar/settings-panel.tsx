'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MultiCombobox } from '@/components/ui/combobox'
import { LocationFields } from './location-fields'
import type { ComboboxOption } from '@/components/ui/combobox'
import { localizedName } from '@/lib/holiday-regions'
import { formatDays } from '@/lib/vacation-accounting'
import type { Subdivision, Country, HolidayGroup } from '@/types'

interface SettingsPanelProps {
  country: string
  onCountryChange: (code: string) => void
  subdivisions: Subdivision[]
  subdivision?: string
  onSubdivisionChange: (code: string) => void
  /** Holiday groups that apply to the selected subdivision. */
  groups: HolidayGroup[]
  holidayGroup?: string
  onHolidayGroupChange: (code: string) => void
  compareOptions: ComboboxOption[]
  compareSubdivisions: string[]
  onCompareChange: (codes: string[]) => void
  defaultCompareSelection: string[]
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

function getCountryName(c: Country): string {
  return localizedName(c.name, c.isoCode)
}

export function SettingsPanel({
  country, onCountryChange,
  subdivisions, subdivision, onSubdivisionChange,
  groups, holidayGroup, onHolidayGroupChange,
  compareOptions, compareSubdivisions, onCompareChange, defaultCompareSelection,
  countries, selectedCountries, onCountriesChange,
  vacationDaysTotal, onVacationDaysChange,
  countWeekendsAsVacation, onCountWeekendsChange,
  halfDaysChristmas, onHalfDaysChange,
  vacationDaysUsed, gleittageCount, remainingWorkDays,
  defaultNoteText, onDefaultNoteTextChange,
  apiError, onRetryApi,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(true)
  // Lets the field be emptied while typing without saving 0 as the budget.
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null)
  const remaining = vacationDaysTotal - vacationDaysUsed

  const countryOptions: ComboboxOption[] = useMemo(() =>
    countries.filter(c => c.isoCode !== country).map(c => ({ value: c.isoCode, label: getCountryName(c), aliases: [c.isoCode] })),
  [countries, country])

  const allRegionsLabel = country === 'DE' && defaultCompareSelection.length === 16 ? 'Alle 16 Bundesländer' : 'Alle Regionen'

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Einstellungen & Statistik</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-4 p-3 pt-0 text-sm">
          {apiError && (
            <div className="flex flex-col gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-2 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 sm:flex-row sm:items-center">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">Ferien oder Feiertage konnten nicht vollständig geladen werden. Bitte erneut versuchen.</span>
              {onRetryApi && (
                <Button size="sm" variant="outline" onClick={onRetryApi} className="w-full sm:w-auto">
                  <RefreshCw className="h-3 w-3 mr-1" /> Erneut versuchen
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Spalte 1: Standort */}
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground">Standort & Regionen</h4>

              <LocationFields
                countries={countries} country={country} onCountryChange={onCountryChange}
                subdivisions={subdivisions} subdivision={subdivision} onSubdivisionChange={onSubdivisionChange}
                groups={groups} holidayGroup={holidayGroup} onHolidayGroupChange={onHolidayGroupChange}
              />

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ferien in anderen Regionen vergleichen</label>
                <MultiCombobox
                  options={compareOptions}
                  value={compareSubdivisions}
                  onChange={onCompareChange}
                  placeholder="Regionen auswählen..."
                  searchPlaceholder={country === 'DE' ? 'z.B. NRW, Bayern...' : 'Suchen...'}
                  emptyText="Keine Region gefunden"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {defaultCompareSelection.length > 0 && <Button size="sm" variant="outline" onClick={() => onCompareChange(defaultCompareSelection)}>{allRegionsLabel}</Button>}
                {compareSubdivisions.length > 0 && <Button size="sm" variant="ghost" onClick={() => onCompareChange([])}>Auswahl leeren</Button>}
              </div>

              {countryOptions.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Zusätzliche Länder</label>
                  <MultiCombobox
                    options={countryOptions}
                    value={selectedCountries}
                    onChange={onCountriesChange}
                    placeholder="Länder hinzufügen..."
                    searchPlaceholder="z.B. Österreich, AT..."
                    emptyText="Kein Land gefunden"
                  />
                </div>
              )}
            </div>

            {/* Spalte 2: Berechnungsoptionen */}
            <div className="space-y-2">
              <h4 className="font-medium text-muted-foreground">Berechnungsoptionen</h4>

              <label className="flex min-h-11 cursor-pointer items-start gap-2 py-1">
                <input type="checkbox" checked={countWeekendsAsVacation}
                  onChange={e => onCountWeekendsChange(e.target.checked)} className="mt-1 h-5 w-5 rounded" />
                <span className="text-xs">Wochenende als Urlaubstage zählen</span>
              </label>

              <label className="flex min-h-11 cursor-pointer items-start gap-2 py-1">
                <input type="checkbox" checked={halfDaysChristmas}
                  onChange={e => onHalfDaysChange(e.target.checked)} className="mt-1 h-5 w-5 rounded" />
                <span className="text-xs">24./31.12. als halbe Tage zählen (0,5)</span>
              </label>

              <div className="mt-3 space-y-1">
                <label htmlFor="vacation-days-total" className="block text-xs text-muted-foreground">Urlaubsanspruch (Tage)</label>
                <input id="vacation-days-total" type="number" min={0} max={366} step={0.5} value={budgetDraft ?? String(vacationDaysTotal)}
                  onChange={e => { setBudgetDraft(e.target.value); const days = e.target.valueAsNumber; if (Number.isFinite(days) && days >= 0 && days <= 366) onVacationDaysChange(days) }}
                  onBlur={() => setBudgetDraft(null)}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-right text-sm sm:w-24" />
              </div>

              <div className="mt-3">
                <label htmlFor="default-note-text" className="text-xs text-muted-foreground">Standard-Notiztext</label>
                <input id="default-note-text" type="text" placeholder="z.B. Arzt, Geburtstag" value={defaultNoteText}
                  onChange={e => onDefaultNoteTextChange(e.target.value)}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <p className="text-xs text-muted-foreground mt-0.5">Wird beim Erstellen neuer Notizen verwendet</p>
              </div>
            </div>

            {/* Spalte 3: Statistik */}
            <div className="space-y-2">
              <h4 className="font-medium text-muted-foreground">Statistik</h4>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-2">
                  <div className="text-xs text-muted-foreground">Verplant</div>
                  <div className="text-lg font-bold text-blue-600">{formatDays(vacationDaysUsed)}</div>
                </div>
                <div className={`rounded-md p-2 ${remaining < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                  <div className="text-xs text-muted-foreground">Verbleibend</div>
                  <div className={`text-lg font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatDays(remaining)}</div>
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
