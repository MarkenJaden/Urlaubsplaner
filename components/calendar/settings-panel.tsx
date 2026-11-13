'use client'

import { useState, useMemo, useEffect } from 'react'
import { AlertTriangle, RefreshCw, Settings2, CalendarDays, Share2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MultiCombobox } from '@/components/ui/combobox'
import { LocationFields } from './location-fields'
import type { ComboboxOption } from '@/components/ui/combobox'
import { localizedName } from '@/lib/holiday-regions'
import { formatDays, DEFAULT_WORK_DAYS, type FlexSummary, type FlexUnit } from '@/lib/vacation-accounting'
import type { Subdivision, Country, HolidayGroup } from '@/types'

const WEEKDAYS_CONFIG = [
  { day: 1, short: 'Mo', full: 'Montag' },
  { day: 2, short: 'Di', full: 'Dienstag' },
  { day: 3, short: 'Mi', full: 'Mittwoch' },
  { day: 4, short: 'Do', full: 'Donnerstag' },
  { day: 5, short: 'Fr', full: 'Freitag' },
  { day: 6, short: 'Sa', full: 'Samstag' },
  { day: 0, short: 'So', full: 'Sonntag' },
] as const

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
  carryoverDaysTotal?: number
  onCarryoverDaysChange?: (n: number) => void
  carryoverExpiringDays?: number
  workDays?: number[]
  onWorkDaysChange?: (days: number[]) => void
  countWeekendsAsVacation?: boolean
  onCountWeekendsChange?: (v: boolean) => void
  halfDaysChristmas: boolean
  onHalfDaysChange: (v: boolean) => void
  showOtherMonthDays?: boolean
  onShowOtherMonthDaysChange?: (v: boolean) => void
  vacationDaysUsed: number
  gleittageCount: number
  flex: FlexSummary
  flexHoursPerDay: number
  onFlexUnitChange: (unit: FlexUnit) => void
  onFlexHoursPerDayChange: (hours: number) => void
  onFlexBudgetChange: (amount: number) => void
  remainingWorkDays: number
  defaultNoteText: string
  onDefaultNoteTextChange: (text: string) => void
  onOpenSubscribe?: () => void
  onOpenShare?: () => void
  onOpenApprovalSheet?: () => void
  apiError?: boolean
  onRetryApi?: () => void
}

function getCountryName(c: Country): string {
  return localizedName(c.name, c.isoCode)
}

function sameDays(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort((x, y) => x - y)
  const sortedB = [...b].sort((x, y) => x - y)
  return sortedA.every((v, i) => v === sortedB[i])
}

export function SettingsPanel({
  country, onCountryChange,
  subdivisions, subdivision, onSubdivisionChange,
  groups, holidayGroup, onHolidayGroupChange,
  compareOptions, compareSubdivisions, onCompareChange, defaultCompareSelection,
  countries, selectedCountries, onCountriesChange,
  vacationDaysTotal, onVacationDaysChange,
  carryoverDaysTotal = 0, onCarryoverDaysChange, carryoverExpiringDays = 0,
  workDays = DEFAULT_WORK_DAYS, onWorkDaysChange,
  halfDaysChristmas, onHalfDaysChange,
  showOtherMonthDays = false, onShowOtherMonthDaysChange,
  vacationDaysUsed, gleittageCount, remainingWorkDays,
  flex, flexHoursPerDay, onFlexUnitChange, onFlexHoursPerDayChange, onFlexBudgetChange,
  defaultNoteText, onDefaultNoteTextChange,
  onOpenSubscribe, onOpenShare, onOpenApprovalSheet,
  apiError, onRetryApi,
}: SettingsPanelProps) {
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null)
  const [carryoverDraft, setCarryoverDraft] = useState<string | null>(null)
  const [flexDraft, setFlexDraft] = useState<string | null>(null)
  // Short "Respekt" animation when someone enters a really big allowance.
  const [respect, setRespect] = useState(0)
  useEffect(() => {
    if (!respect) return
    const timer = setTimeout(() => setRespect(0), 1800)
    return () => clearTimeout(timer)
  }, [respect])
  const effectiveTotal = vacationDaysTotal + carryoverDaysTotal
  const remaining = effectiveTotal - vacationDaysUsed
  const progressPercent = effectiveTotal > 0 ? Math.min(100, Math.round((vacationDaysUsed / effectiveTotal) * 100)) : 0

  const countryOptions: ComboboxOption[] = useMemo(() =>
    countries.filter(c => c.isoCode !== country).map(c => ({ value: c.isoCode, label: getCountryName(c), aliases: [c.isoCode] })),
  [countries, country])

  const allRegionsLabel = country === 'DE' && defaultCompareSelection.length === 16 ? 'Alle 16 Bundesländer' : 'Alle Regionen'
  const activeRegionLabel = useMemo(() => {
    if (subdivision) {
      const match = subdivisions.find(s => s.code === subdivision)
      if (match) return localizedName(match.name, match.code)
    }
    const c = countries.find(item => item.isoCode === country)
    return c ? getCountryName(c) : country
  }, [subdivision, subdivisions, countries, country])

  const toggleWorkDay = (day: number) => {
    if (!onWorkDaysChange) return
    const exists = workDays.includes(day)
    if (exists && workDays.length <= 1) return // Keep at least 1 workday
    const next = exists
      ? workDays.filter(d => d !== day)
      : [...workDays, day].sort((a, b) => a - b)
    onWorkDaysChange(next)
  }

  return (
    <>
      {respect > 0 && (
        <div key={respect} role="status" className="respect-pop pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <span className="rounded-2xl bg-card/95 px-6 py-4 text-3xl font-bold shadow-xl">Respekt 👊</span>
        </div>
      )}
      <details className="group rounded-xl border border-border bg-card shadow-2xs print:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-2.5 sm:p-3 text-sm font-medium hover:bg-muted/50 transition-colors rounded-xl after:shrink-0 after:content-['▾'] after:text-xs after:text-muted-foreground after:transition-transform group-open:after:rotate-180">
          <span className="flex flex-1 min-w-0 flex-wrap items-center justify-between gap-1.5 sm:gap-2">
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>Einstellungen, Arbeitszeit, Standort &amp; Statistik</span>
            </span>
            <span className="flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground sm:ml-auto sm:mr-2">
              <span className="rounded-md border bg-muted/40 px-2 py-0.5 text-foreground font-medium">{activeRegionLabel}</span>
              <span className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-0.5 text-foreground">
                <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                  <span
                    className={`block h-full ${remaining < 0 ? 'bg-red-500' : 'bg-blue-600'}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </span>
                <span>
                  <strong>{formatDays(vacationDaysUsed)}</strong>/{formatDays(effectiveTotal)} verplant ·{' '}
                  <strong className={remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {formatDays(remaining)} frei
                  </strong>
                </span>
              </span>
              {carryoverExpiringDays > 0 && (
                <span className="rounded-md border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-amber-800 dark:text-amber-200 font-medium">
                  ⚠️ {formatDays(carryoverExpiringDays)} Resturlaub bis 31.03.
                </span>
              )}
              <span className="hidden sm:inline rounded-md border bg-muted/40 px-2 py-0.5">{workDays.length}-Tage-Woche</span>
            </span>
          </span>
        </summary>

        <div className="space-y-4 border-t border-border/50 p-3 text-sm">
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
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-3">
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Standort & Ferien-Vergleich</h4>

              <LocationFields
                countries={countries} country={country} onCountryChange={onCountryChange}
                subdivisions={subdivisions} subdivision={subdivision} onSubdivisionChange={onSubdivisionChange}
                groups={groups} holidayGroup={holidayGroup} onHolidayGroupChange={onHolidayGroupChange}
              />

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ferien-Heatmap (Regionen vergleichen)</label>
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
                  <label className="text-xs text-muted-foreground mb-1 block">Zusätzliche Länder (Feiertage einblenden)</label>
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

            {/* Spalte 2: Berechnungsoptionen & Arbeitszeitmodell */}
            <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/15 p-3">
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Kontingent & Arbeitszeit</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor="vacation-days-total" className="block text-xs text-muted-foreground">Urlaubsanspruch (Tage)</label>
                  <input id="vacation-days-total" type="number" min={0} max={366} step={0.5} value={budgetDraft ?? String(vacationDaysTotal)}
                    onChange={e => {
                      setBudgetDraft(e.target.value); const days = e.target.valueAsNumber
                      if (!Number.isFinite(days) || days < 0 || days > 366) return
                      if (days > 45 && vacationDaysTotal <= 45) setRespect(Date.now())
                      onVacationDaysChange(days)
                    }}
                    onBlur={() => setBudgetDraft(null)}
                    className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-1.5 text-right text-sm" />
                </div>

                <div className="space-y-1">
                  <span className="block text-xs text-muted-foreground">Gleitzeit-Kontingent</span>
                  <div className="flex items-center gap-1.5">
                    <input id="flex-budget" type="number" min={0} max={flex.unit === 'hours' ? 8784 : 366} step={0.5} placeholder="—" aria-label="Gleitzeit-Kontingent"
                      value={flexDraft ?? (flex.total !== undefined ? String(flex.total) : '')}
                      onChange={e => { setFlexDraft(e.target.value); const amount = e.target.valueAsNumber; if (Number.isFinite(amount) && amount >= 0 && amount <= (flex.unit === 'hours' ? 8784 : 366)) onFlexBudgetChange(amount) }}
                      onBlur={() => setFlexDraft(null)}
                      className="min-h-10 w-full rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm" />
                    <select aria-label="Einheit" value={flex.unit} onChange={e => onFlexUnitChange(e.target.value as FlexUnit)}
                      className="min-h-10 rounded-md border border-input bg-background px-2 py-1.5 text-xs">
                      <option value="days">Tage</option>
                      <option value="hours">Std.</option>
                    </select>
                  </div>
                </div>
              </div>

              {flex.unit === 'hours' && (
                <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
                  <span>Stunden pro Gleittag</span>
                  <input type="number" min={0.5} max={24} step={0.5} value={flexHoursPerDay}
                    onChange={e => { const hours = e.target.valueAsNumber; if (Number.isFinite(hours) && hours > 0 && hours <= 24) onFlexHoursPerDayChange(hours) }}
                    className="min-h-9 w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm text-foreground" />
                </label>
              )}

              {onCarryoverDaysChange && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="carryover-days-total" className="text-xs text-muted-foreground">
                      Resturlaub aus Vorjahr (gültig bis 31.03.)
                    </label>
                    <input
                      id="carryover-days-total"
                      type="number"
                      min={0}
                      max={366}
                      step={0.5}
                      value={carryoverDraft ?? String(carryoverDaysTotal)}
                      onChange={e => {
                        setCarryoverDraft(e.target.value)
                        const days = e.target.valueAsNumber
                        if (Number.isFinite(days) && days >= 0 && days <= 366) {
                          onCarryoverDaysChange(days)
                        }
                      }}
                      onBlur={() => setCarryoverDraft(null)}
                      className="min-h-8 w-20 rounded-md border border-input bg-background px-2 py-1 text-right text-sm"
                    />
                  </div>
                  {carryoverExpiringDays > 0 && (
                    <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                      ⚠️ Noch {formatDays(carryoverExpiringDays)} Tage Resturlaub sollten bis zum 31.03. verplant werden.
                    </p>
                  )}
                </div>
              )}

              {/* Arbeitszeitmodell / Arbeitstage (z.B. 4-Tage-Woche) */}
              {onWorkDaysChange && (
                <div className="space-y-1.5 rounded-lg border border-border/60 bg-background/60 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-medium text-foreground">Arbeitswoche ({workDays.length}-Tage-Woche)</span>
                    <div className="flex flex-wrap gap-1">
                      {([
                        { label: 'Mo–Fr (5T)', days: [1, 2, 3, 4, 5] },
                        { label: 'Mo–Do (4T)', days: [1, 2, 3, 4] },
                        { label: 'Di–Fr (4T)', days: [2, 3, 4, 5] },
                      ] as const).map(preset => {
                        const active = sameDays(workDays, [...preset.days])
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => onWorkDaysChange([...preset.days])}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'border bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {preset.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 pt-0.5">
                    {WEEKDAYS_CONFIG.map(({ day, short, full }) => {
                      const active = workDays.includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleWorkDay(day)}
                          aria-pressed={active}
                          aria-label={`Arbeitstag ${full}`}
                          title={`${full}: ${active ? 'Arbeitstag' : 'Frei (Wochenende)'}`}
                          className={`h-7 rounded text-xs font-medium transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground shadow-2xs'
                              : 'border border-dashed bg-muted/40 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {short}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Abgewählte Tage (z.B. Fr–So bei einer 4-Tage-Woche) gelten als arbeitsfrei und kosten keinen Urlaubstag.
                  </p>
                </div>
              )}

              <div className="pt-0.5 space-y-1">
                <label className="flex min-h-8 cursor-pointer items-center gap-2 py-0.5">
                  <input type="checkbox" checked={halfDaysChristmas}
                    onChange={e => onHalfDaysChange(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
                  <span className="text-xs">24./31.12. als halbe Tage zählen (0,5)</span>
                </label>


                {onShowOtherMonthDaysChange && (
                  <label className="flex min-h-8 cursor-pointer items-center gap-2 py-0.5">
                    <input type="checkbox" checked={showOtherMonthDays}
                      onChange={e => onShowOtherMonthDaysChange(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
                    <span className="text-xs">Randtage der Nachbarmonate im Gitter zeigen</span>
                  </label>
                )}
              </div>

              <div className="pt-0.5">
                <label htmlFor="default-note-text" className="text-xs text-muted-foreground block mb-1">Standard-Notiztext</label>
                <input id="default-note-text" type="text" placeholder="z.B. Homeoffice, Arzt, Geburtstag" value={defaultNoteText}
                  onChange={e => onDefaultNoteTextChange(e.target.value)}
                  className="min-h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs" />
              </div>
            </div>

            {/* Spalte 3: Statistik & Schnellzugriff */}
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-3 flex flex-col justify-between">
              <div className="space-y-2.5">
                <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Jahres-Übersicht & Status</h4>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Urlaubsbudget verplant</span>
                    <span className="font-medium">{progressPercent}% ({formatDays(vacationDaysUsed)} / {formatDays(effectiveTotal)})</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${remaining < 0 ? 'bg-red-500' : 'bg-blue-600'}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-2">
                    <div className="text-xs text-muted-foreground">Verplant</div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatDays(vacationDaysUsed)}</div>
                  </div>
                  <div className={`rounded-md p-2 ${remaining < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                    <div className="text-xs text-muted-foreground">Verbleibend</div>
                    <div className={`text-lg font-bold ${remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatDays(remaining)}</div>
                  </div>
                  <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 p-2">
                    <div className="text-xs text-muted-foreground">{flex.unit === 'hours' ? 'Gleitstunden' : 'Gleittage'}</div>
                    <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                      {flex.unit === 'hours' ? `${formatDays(flex.used)} h` : gleittageCount}
                      {flex.total !== undefined && <span className="text-xs font-normal text-muted-foreground"> / {formatDays(flex.total)}{flex.unit === 'hours' && ' h'}</span>}
                    </div>
                  </div>
                  <div className="rounded-md bg-orange-50 dark:bg-orange-900/20 p-2">
                    <div className="text-xs text-muted-foreground">Arbeitstage übrig</div>
                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{remainingWorkDays}</div>
                  </div>
                </div>
              </div>

              {(onOpenSubscribe || onOpenShare) && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                  {onOpenSubscribe && (
                    <Button type="button" variant="outline" size="sm" onClick={onOpenSubscribe} className="w-full text-xs gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" /> Kalender-Abo
                    </Button>
                  )}
                  {onOpenShare && (
                    <Button type="button" variant="outline" size="sm" onClick={onOpenShare} className="w-full text-xs gap-1.5">
                      <Share2 className="h-3.5 w-3.5 text-primary" /> Plan teilen
                    </Button>
                  )}
                </div>
              )}

              {onOpenApprovalSheet && (
                <div className="pt-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenApprovalSheet}
                    className="w-full text-xs gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-medium"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Urlaubsantrag konfigurieren &amp; drucken (A4)
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </details>
    </>
  )
}
