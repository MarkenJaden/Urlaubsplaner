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
