export type EntryType = 'vacation' | 'gleittag' | 'note'

export interface VacationEntry {
  id: string
  userId: string
  date: string
  type: EntryType
  title?: string | null
  year: number
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  id: string
  name?: string | null
  email?: string | null
  calendarToken: string
  preferences: UserPreferences
}

export interface UserPreferences {
  subdivision?: string
  country?: string
  vacationDays?: number
  showHeatmap?: boolean
  showPublicHolidays?: boolean
  showSchoolHolidays?: boolean
  compareSubdivisions?: string[]
}

export interface Holiday {
  id: string
  startDate: string
  endDate: string
  type: string
  name: Array<{ language: string; text: string }>
  nationwide: boolean
}

export interface Subdivision {
  code: string
  shortName: string
  name: Array<{ language: string; text: string }>
  isoCode?: string
}

export interface LocalConfig {
  subdivision?: string
  compareSubdivisions?: string[]
  showPublicHolidays: boolean
  showSchoolHolidays: boolean
  showBridgeDays: boolean
  showHeatmap: boolean
  countWeekendsAsVacation: boolean
  halfDaysChristmas: boolean
  vacationDaysPerYear: Record<number, number>
  entries: Array<{ date: string; type: string; title?: string }>
}

export type SuggestionMode = 'extend' | 'overwrite' | 'rest_of_year'

export type NoteHandling = 'avoid' | 'prefer'

export interface PlanningPreferences {
  preferBridgeDays: boolean
  optimizeForEfficiency: boolean
  preferSchoolHolidays: boolean
  avoidSchoolHolidays: boolean
  avoidAllStatesSchoolHolidays: boolean
  distributeEvenly: boolean
  noteHandling: NoteHandling
  noteOverlapAvoidMultiplier: number
  noteOverlapPreferMultiplier: number
  minDaysPerBlock: number
  maxDaysPerBlock?: number
  periodPreferences: PeriodPreference[]
}

export interface PeriodPreference {
  type: 'must' | 'nice'
  months: number[]
  minDuration: number
}

export const DEFAULT_PLANNING_PREFS: PlanningPreferences = {
  preferBridgeDays: true,
  optimizeForEfficiency: false,
  preferSchoolHolidays: false,
  avoidSchoolHolidays: false,
  avoidAllStatesSchoolHolidays: false,
  distributeEvenly: true,
  noteHandling: 'avoid',
  noteOverlapAvoidMultiplier: 0.2,
  noteOverlapPreferMultiplier: 1.35,
  minDaysPerBlock: 1,
  periodPreferences: [],
}
