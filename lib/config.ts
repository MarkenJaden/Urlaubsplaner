import type { LocalConfig, VacationEntry, EntryType, PreferencesPatch } from '@/types'
import { mergePreferences } from './preferences'

const CONFIG_KEY = 'urlaubsplaner_config'
const ENTRIES_KEY = 'urlaubsplaner_local_entries'

export function loadConfig(): LocalConfig {
  if (typeof window === 'undefined') return defaultConfig()
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) {
      // Migration: load old entries-only format
      const oldEntries = localStorage.getItem(ENTRIES_KEY)
      const config = defaultConfig()
      if (oldEntries) {
        const parsed = JSON.parse(oldEntries) as VacationEntry[]
        config.entries = parsed.map(e => ({ date: e.date.split('T')[0], type: e.type, title: e.title ?? undefined }))
      }
      return config
    }
    return { ...defaultConfig(), ...JSON.parse(raw) }
  } catch { return defaultConfig() }
}

export function saveConfig(config: LocalConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  // Also keep old format for backward compat
  const entries: VacationEntry[] = config.entries.map((e, i) => ({
    id: `local_${i}`,
    userId: 'local',
    date: e.date.includes('T') ? e.date : e.date + 'T00:00:00.000Z',
    type: e.type as EntryType,
    title: e.title,
    year: Number(e.date.slice(0, 4)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
}

export function defaultConfig(): LocalConfig {
  return {
    subdivision: undefined,
    compareSubdivisions: [],
    showPublicHolidays: true,
    showSchoolHolidays: true,
    showBridgeDays: true,
    showHeatmap: false,
    showOtherMonthDays: false,
    countWeekendsAsVacation: false,
    halfDaysChristmas: true,
    vacationDaysPerYear: {},
    entries: [],
  }
}

export function configToEntries(config: LocalConfig, year: number): VacationEntry[] {
  return config.entries
    .filter(e => Number(e.date.slice(0, 4)) === year)
    .map((e, i) => ({
      id: `local_${i}`,
      userId: 'local',
      date: e.date.includes('T') ? e.date : e.date + 'T00:00:00.000Z',
      type: e.type as EntryType,
      title: e.title,
      year,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
}

export type LocalEntry = LocalConfig['entries'][number]

/** Guest settings change; same merge rules as the server (null clears, budgets merge per year). */
export function applyConfigPatch(base: LocalConfig, patch: PreferencesPatch & { entries?: LocalEntry[] }): LocalConfig {
  const { entries, ...preferences } = patch
  const { entries: current, ...stored } = base
  return { ...defaultConfig(), ...mergePreferences(stored, preferences), entries: entries ?? current }
}

/**
 * Adds imported entries that are not planned yet (same date and type).
 * Existing entries are never removed or overwritten, so repeated imports are idempotent.
 */
export function mergeImportedEntries(current: LocalEntry[], incoming: Array<{ date: string; type: string; title?: string | null }>): LocalEntry[] {
  const keys = new Set(current.map(e => `${e.date.slice(0, 10)}:${e.type}`))
  const additions: LocalEntry[] = []
  for (const entry of incoming) {
    const date = entry.date.slice(0, 10)
    const key = `${date}:${entry.type}`
    if (keys.has(key)) continue
    keys.add(key)
    additions.push({ date, type: entry.type, ...(entry.title ? { title: entry.title } : {}) })
  }
  return additions.length ? [...current, ...additions] : current
}

/**
 * What has to change to turn `current` back into `target` (same date and type
 * count as the same entry). Used by undo for synchronized plans.
 */
export function diffEntries<T extends { date: string; type: string }, U extends { date: string; type: string }>(current: T[], target: U[]): { remove: T[]; add: U[] } {
  const key = (e: { date: string; type: string }) => `${e.date.slice(0, 10)}:${e.type}`
  const targetKeys = new Set(target.map(key))
  const currentKeys = new Set(current.map(key))
  return { remove: current.filter(e => !targetKeys.has(key(e))), add: target.filter(e => !currentKeys.has(key(e))) }
}

/** Toggle one planned day: removes an existing entry of that type, otherwise adds it. */
export function toggleEntry(current: LocalEntry[], date: string, type: string, title?: string): LocalEntry[] {
  const index = current.findIndex(e => e.type === type && e.date.slice(0, 10) === date)
  if (index >= 0) return current.filter((_, i) => i !== index)
  return [...current, { date, type, ...(title ? { title } : {}) }]
}
