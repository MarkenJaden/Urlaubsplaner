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
  username?: string | null
  hasLocalAccount: boolean
  id: string
  name?: string | null
  email?: string | null
  calendarToken: string
  preferences: UserPreferences
}

export interface UserPreferences extends Partial<Omit<LocalConfig, 'entries'>> {
  feedIncludePublicHolidays?: boolean
  feedIncludeSchoolHolidays?: boolean
  feedIncludeNotes?: boolean
  /** Legacy single budget; vacationDaysPerYear takes precedence. */
  vacationDays?: number
}

/** Patch sent to the server: null removes a stored location value. */
export type PreferencesPatch = { [K in keyof UserPreferences]?: UserPreferences[K] | null }

export interface LocalizedText { language: string; text: string }

export interface RegionReference { code: string; shortName?: string }

export interface Holiday {
  id: string
  startDate: string
  endDate: string
  type: string
  name: LocalizedText[]
  nationwide: boolean
  subdivisions?: RegionReference[]
  groups?: RegionReference[]
}

export interface Subdivision {
  code: string
  shortName: string
  name: LocalizedText[]
  isoCode?: string
  category?: LocalizedText[]
  /** Holiday groups (e.g. NL school regions) this subdivision belongs to. */
  groups?: RegionReference[]
  children?: Subdivision[]
}

/** OpenHolidays holiday group, e.g. a school holiday region or school type. */
export interface HolidayGroup {
  code: string
  shortName?: string
  name: LocalizedText[]
  category?: LocalizedText[]
  subdivisions?: RegionReference[]
}

export interface Country {
  isoCode: string
  name: Array<{ language: string; text: string }>
  officialLanguages: string[]
}

export interface LocalConfig {
  /** Home country (ISO 3166-1 alpha-2); defaults to DE. */
  country?: string
  subdivision?: string
  /** OpenHolidays group code used for school holidays, e.g. NL-NO. */
  holidayGroup?: string
  /** Subdivision or regional group codes of the home country. */
  compareSubdivisions?: string[]
  selectedCountries?: string[]
  showPublicHolidays: boolean
  showSchoolHolidays: boolean
  showBridgeDays: boolean
  showHeatmap: boolean
  showOtherMonthDays: boolean
  countWeekendsAsVacation: boolean
  halfDaysChristmas: boolean
  vacationDaysPerYear: Record<number, number>
  /** Unit of the Gleitzeit allowance; defaults to days. */
  flexUnit?: 'days' | 'hours'
  /** Hours one Gleittag consumes when the allowance is kept in hours. */
  flexHoursPerDay?: number
  /** Gleitzeit allowance per year, in flexUnit. */
  flexBudgetPerYear?: Record<number, number>
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
