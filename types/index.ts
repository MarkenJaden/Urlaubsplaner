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

export interface CalendarFeedSubscription {
  id: string
  name: string
  token: string
  includeVacations: boolean
  includeGleittage: boolean
  includeNotes: boolean
  includeNoteTitles: boolean
  includePublicHolidays: boolean
  includeSchoolHolidays: boolean
  includeBridgeDays: boolean
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  username?: string | null
  hasLocalAccount: boolean
  googleLinked?: boolean
  githubLinked?: boolean
  googleOAuthEnabled?: boolean
  githubOAuthEnabled?: boolean
  isAdmin?: boolean
  id: string
  name?: string | null
  email?: string | null
  calendarToken: string
  calendarFeeds?: CalendarFeedSubscription[]
  preferences: UserPreferences
}

export interface UserPreferences extends Partial<Omit<LocalConfig, 'entries'>> {
  feedIncludeVacations?: boolean
  feedIncludeGleittage?: boolean
  feedIncludePublicHolidays?: boolean
  feedIncludeSchoolHolidays?: boolean
  feedIncludeNotes?: boolean
  feedIncludeNoteTitles?: boolean
  feedIncludeBridgeDays?: boolean
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

export interface SharedPlanOverlay {
  id: string
  label: string
  ownerName?: string
  color: string
  enabled: boolean
  permission: 'view' | 'edit'
  token?: string
  country?: string
  subdivision?: string
  workDays?: number[]
  vacationDays?: number
  vacationDaysPerYear?: Record<string | number, number>
  halfDaysChristmas?: boolean
  countWeekendsAsVacation?: boolean
  updatedAt?: string
  entries: Array<{ date: string; type: EntryType; title?: string | null }>
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
  /** Active working weekdays (0=Sun, 1=Mon, ..., 6=Sat). Defaults to [1, 2, 3, 4, 5]. */
  workDays?: number[]
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

export type NoteHandling = 'avoid' | 'prefer' | 'ignore'

export type SchoolHolidayStrategy = 'neutral' | 'prefer' | 'avoid' | 'avoid_heatmap'

export type OptimizationGoal = 'balanced' | 'max_efficiency' | 'long_breaks' | 'distributed'

export type PlanStartMode = 'today' | 'year_start' | 'after_last_vacation' | 'custom_date'

export interface ExcludedDateRange {
  id?: string
  startDate: string
  endDate: string
  label?: string
}

export interface PeriodPreference {
  id?: string
  type: 'must_have' | 'nice_to_have' | 'exact_range' | 'avoid_months'
  months: number[]
  startDate?: string
  endDate?: string
  minDuration: number
  exactDays?: number | null
  label?: string
}

export interface PlanningPreferences {
  goal?: OptimizationGoal
  schoolStrategy?: SchoolHolidayStrategy
  preferBridgeDays: boolean
  optimizeForEfficiency: boolean
  preferSchoolHolidays: boolean
  avoidSchoolHolidays: boolean
  avoidAllStatesSchoolHolidays: boolean
  distributeEvenly: boolean
  noteHandling: NoteHandling
  noteOverlapAvoidMultiplier?: number
  noteOverlapPreferMultiplier?: number
  minDaysPerBlock: number
  maxDaysPerBlock?: number | null
  minGapDaysBetweenBlocks?: number
  reserveDaysToKeep?: number
  allowSingleDayBridges?: boolean
  avoidMonths?: number[]
  workDays?: number[]
  planStartMode?: PlanStartMode
  customStartDate?: string | null
  customEndDate?: string | null
  excludedDateRanges?: ExcludedDateRange[]
  maxBlocks?: number | null
  minEfficiency?: number | null
  requireMainVacationDays?: number | null
  periodPreferences: PeriodPreference[]
}

export const DEFAULT_PLANNING_PREFS: PlanningPreferences = {
  goal: 'balanced',
  schoolStrategy: 'neutral',
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
  maxDaysPerBlock: null,
  minGapDaysBetweenBlocks: 14,
  reserveDaysToKeep: 0,
  allowSingleDayBridges: true,
  avoidMonths: [],
  workDays: [1, 2, 3, 4, 5],
  planStartMode: 'today',
  customStartDate: null,
  customEndDate: null,
  excludedDateRanges: [],
  maxBlocks: null,
  minEfficiency: null,
  requireMainVacationDays: null,
  periodPreferences: [],
}
