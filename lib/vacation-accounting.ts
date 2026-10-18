import type { Holiday } from '@/types'

// Single definition of what a marked vacation day costs. Used for "verplant",
// "verbleibend", the over-budget marking and the suggestion budget.
// Dates are handled as yyyy-MM-dd keys in UTC so the browser time zone cannot
// shift an entry to the neighbouring day.

export interface AccountingOptions {
  /** Public holidays of the home region; they never cost a vacation day. */
  holidayDates: Set<string>
  /** 24.12. and 31.12. cost half a day. */
  halfDaysChristmas: boolean
  /** Weekends are working days: marking them costs a vacation day. */
  countWeekendsAsVacation: boolean
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

export function isChristmasHalfDay(key: string): boolean {
  return key.endsWith('-12-24') || key.endsWith('-12-31')
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
  if (isWeekendKey(key) && !options.countWeekendsAsVacation) return 0
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
export function remainingWorkDays(year: number, entries: DatedEntry[], options: Pick<AccountingOptions, 'holidayDates' | 'countWeekendsAsVacation'>, today: string): number {
  const first = `${year}-01-01`, last = `${year}-12-31`
  const start = today > first ? today : first
  const taken = new Set(entries.filter(e => e.type === 'vacation' || e.type === 'gleittag').map(e => dateKey(e.date)))
  let count = 0
  for (let key = start; key <= last; key = addDays(key, 1)) {
    if (options.holidayDates.has(key) || taken.has(key)) continue
    if (isWeekendKey(key) && !options.countWeekendsAsVacation) continue
    count++
  }
  return count
}

/** Budget for a year: per-year value, then the legacy single value, then 30. */
export function vacationBudget(preferences: { vacationDaysPerYear?: Record<string | number, number>; vacationDays?: number }, year: number): number {
  return preferences.vacationDaysPerYear?.[year] ?? preferences.vacationDays ?? 30
}

/** German display of possibly fractional day counts, e.g. 12,5. */
export function formatDays(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 })
}
