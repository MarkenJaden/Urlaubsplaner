import type { LocalConfig, VacationEntry, EntryType } from '@/types'

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
    year: new Date(e.date).getFullYear(),
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
    countWeekendsAsVacation: false,
    halfDaysChristmas: true,
    vacationDaysPerYear: {},
    entries: [],
  }
}

export function configToEntries(config: LocalConfig, year: number): VacationEntry[] {
  return config.entries
    .filter(e => new Date(e.date).getFullYear() === year)
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
