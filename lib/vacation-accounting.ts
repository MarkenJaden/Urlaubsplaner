import type { Holiday } from '@/types'

// Single definition of what a marked vacation day costs. Used for "verplant",
// "verbleibend", the over-budget marking and the suggestion budget.
// Dates are handled as yyyy-MM-dd keys in UTC so the browser time zone cannot
// shift an entry to the neighbouring day.

export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5]

export interface AccountingOptions {
  /** Public holidays of the home region; they never cost a vacation day. */
  holidayDates: Set<string>
  /** 24.12. and 31.12. cost half a day. */
  halfDaysChristmas: boolean
  /** Weekends/off-days are working days: marking them costs a vacation day. */
  countWeekendsAsVacation: boolean
  /** Active working weekdays (0=Sun, 1=Mon, ..., 6=Sat). Defaults to Mon–Fri [1,2,3,4,5]. */
  workDays?: number[]
}

type DatedEntry = { date: string; type: string }

export function dateKey(value: string): string {
  return value.slice(0, 10)
}

function utcDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`)
}

function addDays(key: string, days: number): string {
  const date = utcDate(key)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function isWeekendKey(key: string): boolean {
  const day = utcDate(key).getUTCDay()
  return day === 0 || day === 6
}

/**
 * Checks if a calendar date is a regular non-working weekday according to the
 * user's configured work schedule (e.g. Friday–Sunday for a Mon–Thu 4-day week).
 */
export function isOffDayKey(key: string, workDays?: number[]): boolean {
  const day = utcDate(key).getUTCDay()
  if (workDays && workDays.length > 0) {
    return !workDays.includes(day)
  }
  return day === 0 || day === 6
}

export function isChristmasHalfDay(key: string): boolean {
  return key.endsWith('-12-24') || key.endsWith('-12-31')
}

/** 24.12. ↔ 31.12. of the same year; null for every other date. */
export function christmasPartner(key: string): string | null {
  if (key.endsWith('-12-24')) return `${key.slice(0, 4)}-12-31`
  if (key.endsWith('-12-31')) return `${key.slice(0, 4)}-12-24`
  return null
}

/** All dates covered by the holidays (end date inclusive). */
export function holidayDateSet(holidays: Holiday[]): Set<string> {
  const dates = new Set<string>()
  for (const holiday of holidays) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(holiday.endDate)) continue
    for (let key = holiday.startDate; key <= holiday.endDate; key = addDays(key, 1)) dates.add(key)
  }
  return dates
}

export function vacationDayCost(key: string, options: AccountingOptions): number {
  if (options.holidayDates.has(key)) return 0
  if (isOffDayKey(key, options.workDays) && !options.countWeekendsAsVacation) return 0
  return options.halfDaysChristmas && isChristmasHalfDay(key) ? 0.5 : 1
}

export interface VacationSummary {
  /** Vacation days consumed by the marked entries. */
  used: number
  /** Entries whose cost exceeds the budget, in date order. */
  overBudget: Set<string>
}

export function summarizeVacation(entries: DatedEntry[], totalDays: number, options: AccountingOptions): VacationSummary {
  const keys = [...new Set(entries.filter(e => e.type === 'vacation').map(e => dateKey(e.date)))].sort()
  let used = 0
  const overBudget = new Set<string>()
  for (const key of keys) {
    const cost = vacationDayCost(key, options)
    if (cost === 0) continue
    used += cost
    if (used > totalDays) overBudget.add(key)
  }
  return { used, overBudget }
}

/** Working days from today (or 1 January) to 31 December not yet covered by vacation or Gleittag. */
export function remainingWorkDays(
  year: number,
  entries: DatedEntry[],
  options: Pick<AccountingOptions, 'holidayDates' | 'countWeekendsAsVacation' | 'workDays'>,
  today: string,
): number {
  const first = `${year}-01-01`, last = `${year}-12-31`
  const start = today > first ? today : first
  const taken = new Set(entries.filter(e => e.type === 'vacation' || e.type === 'gleittag' || e.type === 'special').map(e => dateKey(e.date)))
  let count = 0
  for (let key = start; key <= last; key = addDays(key, 1)) {
    if (options.holidayDates.has(key) || taken.has(key)) continue
    if (isOffDayKey(key, options.workDays) && !options.countWeekendsAsVacation) continue
    count++
  }
  return count
}

/** Budget for a year: per-year value, then the legacy single value, then 30. */
export function vacationBudget(preferences: { vacationDaysPerYear?: Record<string | number, number>; vacationDays?: number }, year: number): number {
  return preferences.vacationDaysPerYear?.[year] ?? preferences.vacationDays ?? 30
}

export type FlexUnit = 'days' | 'hours'

export interface FlexPreferences {
  flexUnit?: FlexUnit
  flexHoursPerDay?: number
  flexBudgetPerYear?: Record<string | number, number>
}

export interface FlexSummary {
  unit: FlexUnit
  /** Gleittage in days, or the hours they consume. */
  used: number
  /** Configured allowance for the year, undefined when none is set. */
  total?: number
}

/** Gleitzeit used against the yearly allowance, in the configured unit. */
export function summarizeFlex(gleittage: number, preferences: FlexPreferences, year: number): FlexSummary {
  const unit = preferences.flexUnit ?? 'days'
  const used = unit === 'hours' ? gleittage * (preferences.flexHoursPerDay ?? 8) : gleittage
  return { unit, used, total: preferences.flexBudgetPerYear?.[year] }
}

/** German display of possibly fractional day counts, e.g. 12,5. */
export function formatDays(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

const SHORT_WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  0: 'So',
}

export function isStandardFiveDayWeek(workDays?: number[]): boolean {
  if (!workDays || workDays.length === 0) return true
  return workDays.length === 5 && [1, 2, 3, 4, 5].every(d => workDays.includes(d))
}

export function formatWorkDaysLabel(workDays?: number[]): string {
  if (!workDays || workDays.length === 0 || isStandardFiveDayWeek(workDays)) {
    return '5-Tage (Mo–Fr)'
  }
  if (workDays.length === 4 && [1, 2, 3, 4].every(d => workDays.includes(d))) {
    return '4-Tage (Mo–Do)'
  }
  if (workDays.length === 4 && [2, 3, 4, 5].every(d => workDays.includes(d))) {
    return '4-Tage (Di–Fr)'
  }
  if (workDays.length === 6 && [1, 2, 3, 4, 5, 6].every(d => workDays.includes(d))) {
    return '6-Tage (Mo–Sa)'
  }
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter(d => workDays.includes(d))
  return `${ordered.length}-Tage (${ordered.map(d => SHORT_WEEKDAY_LABELS[d]).join(', ')})`
}
