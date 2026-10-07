import type { EntryType, UserPreferences } from '@/types'
import { getAllSubdivisionAliases } from './subdivision-aliases'

const states = new Set(Object.keys(getAllSubdivisionAliases()))
const booleanKeys = new Set(['showHeatmap', 'showPublicHolidays', 'showSchoolHolidays', 'showBridgeDays', 'showOtherMonthDays', 'countWeekendsAsVacation', 'halfDaysChristmas', 'feedIncludePublicHolidays', 'feedIncludeSchoolHolidays', 'feedIncludeNotes'])

export function parsePreferences(input: unknown): UserPreferences | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (booleanKeys.has(key)) { if (typeof value !== 'boolean') return null }
    else if (key === 'subdivision') { if (typeof value !== 'string' || !states.has(value)) return null }
    else if (key === 'country') { if (value !== 'DE') return null }
    else if (key === 'vacationDays') { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 366) return null }
    else if (key === 'vacationDaysPerYear') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      if (Object.entries(value).some(([year, days]) => !/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2200 || typeof days !== 'number' || !Number.isFinite(days) || days < 0 || days > 366)) return null
    } else if (key === 'compareSubdivisions') {
      if (!Array.isArray(value) || value.length > 16 || value.some(code => !states.has(code))) return null
    } else if (key === 'selectedCountries') {
      if (!Array.isArray(value) || value.length > 30 || value.some(code => typeof code !== 'string' || !/^[A-Z]{2}$/.test(code))) return null
    } else return null
    result[key] = key === 'compareSubdivisions' ? [...new Set(value as string[])] : value
  }
  return result as UserPreferences
}

export function mergePreferences(current: UserPreferences, patch: UserPreferences): UserPreferences {
  return { ...current, ...patch, ...(patch.vacationDaysPerYear ? { vacationDaysPerYear: { ...current.vacationDaysPerYear, ...patch.vacationDaysPerYear } } : {}) }
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
