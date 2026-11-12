import type { EntryType, PreferencesPatch, SharedPlanOverlay, UserPreferences } from '@/types'
import { DEFAULT_COUNTRY, isCountryCode, isRegionCode } from './holiday-regions'

const booleanKeys = new Set([
  'showHeatmap',
  'showPublicHolidays',
  'showSchoolHolidays',
  'showBridgeDays',
  'showOtherMonthDays',
  'countWeekendsAsVacation',
  'halfDaysChristmas',
  'carryoverExpiresMarch31',
  'feedIncludeVacations',
  'feedIncludeGleittage',
  'feedIncludePublicHolidays',
  'feedIncludeSchoolHolidays',
  'feedIncludeNotes',
  'feedIncludeNoteTitles',
  'feedIncludeBridgeDays',
])
// Location values that a patch may clear with null (e.g. after a country change).
const clearableKeys = new Set(['subdivision', 'holidayGroup'])

function validBudget(value: unknown, max = 366): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
}

function validBudgetPerYear(value: unknown, max: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(([year, amount]) => /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 2200 && validBudget(amount, max))
}

function validWorkDays(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 7 &&
    value.every(d => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6)
  )
}

function parseSharedOverlay(raw: unknown): SharedPlanOverlay | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.id !== 'string' || !obj.id.trim() || obj.id.length > 120) return null
  if (typeof obj.label !== 'string' || !obj.label.trim() || obj.label.length > 120) return null
  if (typeof obj.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(obj.color)) return null
  if (typeof obj.enabled !== 'boolean') return null
  if (obj.permission !== 'view' && obj.permission !== 'edit') return null
  if (obj.ownerName !== undefined && (typeof obj.ownerName !== 'string' || obj.ownerName.length > 120)) return null
  if (obj.token !== undefined && (typeof obj.token !== 'string' || obj.token.length > 120)) return null
  if (obj.country !== undefined && !isCountryCode(obj.country)) return null
  if (obj.subdivision !== undefined && !isRegionCode(obj.subdivision)) return null
  if (obj.workDays !== undefined && !validWorkDays(obj.workDays)) return null
  if (obj.vacationDays !== undefined && !validBudget(obj.vacationDays)) return null
  if (obj.vacationDaysPerYear !== undefined && !validBudgetPerYear(obj.vacationDaysPerYear, 366)) return null
  if (obj.halfDaysChristmas !== undefined && typeof obj.halfDaysChristmas !== 'boolean') return null
  if (obj.countWeekendsAsVacation !== undefined && typeof obj.countWeekendsAsVacation !== 'boolean') return null
  if (obj.updatedAt !== undefined && (typeof obj.updatedAt !== 'string' || obj.updatedAt.length > 64)) return null
  if (!Array.isArray(obj.entries) || obj.entries.length > 1500) return null

  const entries: Array<{ date: string; type: EntryType; title?: string | null }> = []
  for (const item of obj.entries) {
    const parsed = parseEntry(item)
    if (!parsed) return null
    entries.push({
      date: parsed.date.toISOString().slice(0, 10),
      type: parsed.type,
      ...(parsed.title ? { title: parsed.title } : {}),
    })
  }

  return {
    id: obj.id.trim(),
    label: obj.label.trim(),
    ...(obj.ownerName ? { ownerName: obj.ownerName } : {}),
    color: obj.color,
    enabled: obj.enabled,
    permission: obj.permission,
    ...(obj.token ? { token: obj.token } : {}),
    ...(obj.country ? { country: obj.country } : {}),
    ...(obj.subdivision ? { subdivision: obj.subdivision } : {}),
    ...(obj.workDays ? { workDays: [...new Set(obj.workDays)].sort((a, b) => a - b) } : {}),
    ...(obj.vacationDays !== undefined ? { vacationDays: obj.vacationDays } : {}),
    ...(obj.vacationDaysPerYear ? { vacationDaysPerYear: obj.vacationDaysPerYear as Record<string, number> } : {}),
    ...(obj.halfDaysChristmas !== undefined ? { halfDaysChristmas: obj.halfDaysChristmas } : {}),
    ...(obj.countWeekendsAsVacation !== undefined ? { countWeekendsAsVacation: obj.countWeekendsAsVacation } : {}),
    ...(obj.updatedAt ? { updatedAt: obj.updatedAt } : {}),
    entries,
  }
}

export function mergeSharedOverlays(
  existing: SharedPlanOverlay[] = [],
  incoming: SharedPlanOverlay[] = [],
): SharedPlanOverlay[] {
  const result = [...existing]
  for (const item of incoming) {
    const idx = result.findIndex(o => o.id === item.id || (Boolean(o.token) && o.token === item.token))
    if (idx >= 0) {
      result[idx] = { ...result[idx], ...item }
    } else if (result.length < 25) {
      result.push(item)
    }
  }
  return result
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
    else if (key === 'carryoverDaysPerYear') { if (!validBudgetPerYear(value, 366)) return null }
    // Gleitzeit may be kept in hours: 366 days × 24 h is the upper bound.
    else if (key === 'flexBudgetPerYear') { if (!validBudgetPerYear(value, 8784)) return null }
    else if (key === 'flexUnit') { if (value !== 'days' && value !== 'hours') return null }
    else if (key === 'flexHoursPerDay') { if (!validBudget(value, 24) || value === 0) return null }
    else if (key === 'workDays') {
      if (!validWorkDays(value)) return null
      result[key] = [...new Set(value)].sort((a, b) => a - b)
      continue
    }
    else if (key === 'sharedOverlays') {
      if (!Array.isArray(value) || value.length > 25) return null
      const overlays: SharedPlanOverlay[] = []
      for (const item of value) {
        const parsed = parseSharedOverlay(item)
        if (!parsed) return null
        overlays.push(parsed)
      }
      result[key] = overlays
      continue
    }
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
  if (patch.carryoverDaysPerYear) merged.carryoverDaysPerYear = { ...current.carryoverDaysPerYear, ...patch.carryoverDaysPerYear }
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
  const combinedOverlays =
    stored.sharedOverlays || incoming.sharedOverlays
      ? mergeSharedOverlays(stored.sharedOverlays ?? [], incoming.sharedOverlays ?? [])
      : undefined
  const merged = mergePreferences(mergePreferences({}, incoming), stored)
  if (combinedOverlays) merged.sharedOverlays = combinedOverlays
  return merged
}

/** Patch for a home-country change: region choices of the old country no longer apply. */
export function countryChangePatch(country: string): PreferencesPatch {
  return { country, subdivision: null, holidayGroup: null, compareSubdivisions: [], showHeatmap: false }
}

export function parseEntry(input: unknown): { date: Date; type: EntryType; title: string | null; year: number } | null {
  if (!input || typeof input !== 'object') return null
  const { date, type, title } = input as Record<string, unknown>
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(date) || !['vacation', 'gleittag', 'special', 'note'].includes(type as string)) return null
  const dateKey = date.slice(0, 10)
  const parsed = new Date(`${dateKey}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateKey || parsed.getUTCFullYear() < 1900 || parsed.getUTCFullYear() > 2200) return null
  if (title != null && (typeof title !== 'string' || title.length > 500)) return null
  return { date: parsed, type: type as EntryType, title: typeof title === 'string' ? title : null, year: parsed.getUTCFullYear() }
}
