import type { EntryType, PreferencesPatch, UserPreferences } from '@/types'
import { DEFAULT_COUNTRY, isCountryCode, isRegionCode } from './holiday-regions'

const booleanKeys = new Set(['showHeatmap', 'showPublicHolidays', 'showSchoolHolidays', 'showBridgeDays', 'showOtherMonthDays', 'countWeekendsAsVacation', 'halfDaysChristmas', 'feedIncludePublicHolidays', 'feedIncludeSchoolHolidays', 'feedIncludeNotes'])
// Location values that a patch may clear with null (e.g. after a country change).
const clearableKeys = new Set(['subdivision', 'holidayGroup'])

function validBudget(value: unknown, max = 366): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
}

function validBudgetPerYear(value: unknown, max: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(([year, amount]) => /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 2200 && validBudget(amount, max))
}

/**
 * Validates a preference patch. Codes are format-checked here; whether a code
 * exists is checked by the holiday API, and normalizePreferences() drops codes
 * that do not belong to the selected country.
 */
export function parsePreferences(input: unknown): PreferencesPatch | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === null && clearableKeys.has(key)) { result[key] = null; continue }
    if (booleanKeys.has(key)) { if (typeof value !== 'boolean') return null }
    else if (key === 'subdivision' || key === 'holidayGroup') { if (!isRegionCode(value)) return null }
    else if (key === 'country') { if (!isCountryCode(value)) return null }
    else if (key === 'vacationDays') { if (!validBudget(value)) return null }
    else if (key === 'vacationDaysPerYear') { if (!validBudgetPerYear(value, 366)) return null }
    // Gleitzeit may be kept in hours: 366 days × 24 h is the upper bound.
    else if (key === 'flexBudgetPerYear') { if (!validBudgetPerYear(value, 8784)) return null }
    else if (key === 'flexUnit') { if (value !== 'days' && value !== 'hours') return null }
    else if (key === 'flexHoursPerDay') { if (!validBudget(value, 24) || value === 0) return null }
    else if (key === 'compareSubdivisions') {
      if (!Array.isArray(value) || value.length > 100 || value.some(code => !isRegionCode(code))) return null
    } else if (key === 'selectedCountries') {
      if (!Array.isArray(value) || value.length > 60 || value.some(code => !isCountryCode(code))) return null
    } else return null
    result[key] = key === 'compareSubdivisions' || key === 'selectedCountries' ? [...new Set(value as string[])] : value
  }
  return result as PreferencesPatch
}

/** Keeps location codes consistent with the (default) home country. */
export function normalizePreferences(preferences: UserPreferences): UserPreferences {
  const country = preferences.country ?? DEFAULT_COUNTRY
  const result: UserPreferences = { ...preferences }
  if (result.subdivision && !isRegionCode(result.subdivision, country)) delete result.subdivision
  if (result.holidayGroup && !isRegionCode(result.holidayGroup, country)) delete result.holidayGroup
  if (result.compareSubdivisions) result.compareSubdivisions = result.compareSubdivisions.filter(code => isRegionCode(code, country))
  if (result.selectedCountries) result.selectedCountries = result.selectedCountries.filter(code => code !== country)
  return result
}

/** Applies a patch: per-year budgets merge, null clears a value. */
export function mergePreferences(current: UserPreferences, patch: PreferencesPatch): UserPreferences {
  const merged: Record<string, unknown> = { ...current, ...patch }
  if (patch.vacationDaysPerYear) merged.vacationDaysPerYear = { ...current.vacationDaysPerYear, ...patch.vacationDaysPerYear }
  if (patch.flexBudgetPerYear) merged.flexBudgetPerYear = { ...current.flexBudgetPerYear, ...patch.flexBudgetPerYear }
  for (const [key, value] of Object.entries(patch)) if (value === null) delete merged[key]
  return normalizePreferences(merged as UserPreferences)
}

const locationKeys = ['country', 'subdivision', 'holidayGroup', 'compareSubdivisions'] as const

/**
 * Import of a guest plan or config file: stored settings win. Location keys
 * are taken as a unit so a stored DE-BY never combines with an imported NL.
 */
export function mergeImportedPreferences(stored: UserPreferences, imported: PreferencesPatch): UserPreferences {
  const incoming: PreferencesPatch = { ...imported }
  if (stored.country || stored.subdivision) for (const key of locationKeys) delete incoming[key]
  return mergePreferences(mergePreferences({}, incoming), stored)
}

/** Patch for a home-country change: region choices of the old country no longer apply. */
export function countryChangePatch(country: string): PreferencesPatch {
  return { country, subdivision: null, holidayGroup: null, compareSubdivisions: [], showHeatmap: false }
}

export function parseEntry(input: unknown): { date: Date; type: EntryType; title: string | null; year: number } | null {
  if (!input || typeof input !== 'object') return null
  const { date, type, title } = input as Record<string, unknown>
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(date) || !['vacation', 'gleittag', 'note'].includes(type as string)) return null
  const dateKey = date.slice(0, 10)
  const parsed = new Date(`${dateKey}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateKey || parsed.getUTCFullYear() < 1900 || parsed.getUTCFullYear() > 2200) return null
  if (title != null && (typeof title !== 'string' || title.length > 500)) return null
  return { date: parsed, type: type as EntryType, title: typeof title === 'string' ? title : null, year: parsed.getUTCFullYear() }
}
