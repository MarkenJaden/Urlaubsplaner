import type { Holiday, VacationEntry } from '@/types'
import { getISOWeek, parseISO } from 'date-fns'
import {
  dateKey,
  holidayDateSet,
  isOffDayKey,
  summarizeVacation,
  vacationDayCost,
  type AccountingOptions,
} from './vacation-accounting'

export interface FreeSpanPeriod {
  /** First calendar day of the contiguous free block (including surrounding weekends/holidays). */
  freeStartDate: string
  /** Last calendar day of the contiguous free block (including surrounding weekends/holidays). */
  freeEndDate: string
  /** First booked vacation/flex date inside this block. */
  bookedStartDate: string
  /** Last booked vacation/flex date inside this block. */
  bookedEndDate: string
  /** Total contiguous calendar days off. */
  freeCalendarDays: number
  /** Net vacation budget consumed in this block (via lib/vacation-accounting.ts). */
  vacationCost: number
  /** Number of Gleittage inside this block. */
  gleittagCount: number
  /** ISO week label, e.g. "KW 20" or "KW 20–21". */
  weekLabel: string
  /** Optional titles attached to booked entries in this block. */
  titles: string[]
}

export interface PlanScorecard {
  year: number
  vacationDaysUsed: number
  vacationDaysTotal: number
  vacationDaysRemaining: number
  gleittageUsed: number
  /** Sum of contiguous free days across all blocks containing at least one booked vacation/flex day. */
  totalFreeDaysInBlocks: number
  /** Extra free days gained on top of invested vacation + flex days. */
  bonusFreeDays: number
  /** Ratio totalFreeDaysInBlocks / (vacationDaysUsed + gleittageUsed). */
  efficiency: number
  /** Longest contiguous break in calendar days. */
  longestBreakDays: number
  /** Distinct contiguous off-work periods for scorecards and A4 request sheets. */
  periods: FreeSpanPeriod[]
}

function utcDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`)
}

function addUtcDays(key: string, delta: number): string {
  const d = utcDate(key)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function diffUtcDaysInclusive(startKey: string, endKey: string): number {
  const ms = utcDate(endKey).getTime() - utcDate(startKey).getTime()
  return Math.round(ms / 86_400_000) + 1
}

function buildWeekLabel(startKey: string, endKey: string): string {
  const w1 = getISOWeek(parseISO(startKey))
  const w2 = getISOWeek(parseISO(endKey))
  return w1 === w2 ? `KW ${w1}` : `KW ${w1}–${w2}`
}

export function computePlanScorecard(params: {
  year: number
  entries: VacationEntry[]
  totalDays: number
  publicHolidays: Holiday[]
  halfDaysChristmas: boolean
  countWeekendsAsVacation: boolean
  workDays?: number[]
}): PlanScorecard {
  const {
    year,
    entries,
    totalDays,
    publicHolidays,
    halfDaysChristmas,
    countWeekendsAsVacation,
    workDays,
  } = params

  const holidayDates = holidayDateSet(publicHolidays)
  // Always treat Jan 1 of year and year+1 as public holidays (Neujahr) so Dec/Jan bridges connect accurately.
  holidayDates.add(`${year}-01-01`)
  holidayDates.add(`${year + 1}-01-01`)

  const accountingOptions: AccountingOptions = {
    holidayDates,
    halfDaysChristmas,
    countWeekendsAsVacation,
    workDays,
  }

  const yearEntries = entries.filter(e => dateKey(e.date).startsWith(`${year}-`))
  const summary = summarizeVacation(yearEntries, totalDays, accountingOptions)
  const vacationDaysUsed = summary.used

  const vacationKeys = new Set<string>()
  const gleittagKeys = new Set<string>()
  const titlesByDate = new Map<string, string[]>()

  for (const entry of yearEntries) {
    const key = dateKey(entry.date)
    if (entry.type === 'vacation') {
      vacationKeys.add(key)
    } else if (entry.type === 'gleittag') {
      gleittagKeys.add(key)
    }
    if ((entry.type === 'vacation' || entry.type === 'gleittag') && entry.title?.trim()) {
      const existing = titlesByDate.get(key) ?? []
      if (!existing.includes(entry.title.trim())) {
        titlesByDate.set(key, [...existing, entry.title.trim()])
      }
    }
  }

  const isFreeCalendarDay = (key: string): boolean => {
    if (vacationKeys.has(key) || gleittagKeys.has(key)) return true
    if (holidayDates.has(key)) return true
    if (!countWeekendsAsVacation && isOffDayKey(key, workDays)) return true
    return false
  }

  // Scan from 4 days before Jan 1 to 5 days after Dec 31 so surrounding weekends/New Year are captured once without overlap.
  const scanStart = addUtcDays(`${year}-01-01`, -4)
  const scanEnd = addUtcDays(`${year}-12-31`, 5)

  const periods: FreeSpanPeriod[] = []
  let cursor = scanStart

  while (cursor <= scanEnd) {
    if (!isFreeCalendarDay(cursor)) {
      cursor = addUtcDays(cursor, 1)
      continue
    }

    const spanStart = cursor
    const spanDates: string[] = []
    while (cursor <= scanEnd && isFreeCalendarDay(cursor)) {
      spanDates.push(cursor)
      cursor = addUtcDays(cursor, 1)
    }
    const spanEnd = spanDates[spanDates.length - 1]

    const bookedDates = spanDates.filter(k => vacationKeys.has(k) || gleittagKeys.has(k))
    if (bookedDates.length === 0) continue

    let vacationCost = 0
    let gleittagCount = 0
    const titles: string[] = []

    for (const k of bookedDates) {
      if (vacationKeys.has(k)) {
        vacationCost += vacationDayCost(k, accountingOptions)
      } else if (gleittagKeys.has(k)) {
        gleittagCount += 1
      }
      for (const t of titlesByDate.get(k) ?? []) {
        if (!titles.includes(t)) titles.push(t)
      }
    }

    if (vacationCost === 0 && gleittagCount === 0) continue

    const bookedStartDate = bookedDates[0]
    const bookedEndDate = bookedDates[bookedDates.length - 1]
    const freeCalendarDays = diffUtcDaysInclusive(spanStart, spanEnd)

    periods.push({
      freeStartDate: spanStart,
      freeEndDate: spanEnd,
      bookedStartDate,
      bookedEndDate,
      freeCalendarDays,
      vacationCost,
      gleittagCount,
      weekLabel: buildWeekLabel(bookedStartDate, bookedEndDate),
      titles,
    })
  }

  const gleittageUsed = gleittagKeys.size
  const totalInvestedDays = vacationDaysUsed + gleittageUsed
  const totalFreeDaysInBlocks = periods.reduce((sum, p) => sum + p.freeCalendarDays, 0)
  const bonusFreeDays = Math.max(0, Math.round((totalFreeDaysInBlocks - totalInvestedDays) * 10) / 10)
  const efficiency = totalInvestedDays > 0 ? totalFreeDaysInBlocks / totalInvestedDays : 0
  const longestBreakDays = periods.reduce((max, p) => Math.max(max, p.freeCalendarDays), 0)

  return {
    year,
    vacationDaysUsed,
    vacationDaysTotal: totalDays,
    vacationDaysRemaining: totalDays - vacationDaysUsed,
    gleittageUsed,
    totalFreeDaysInBlocks,
    bonusFreeDays,
    efficiency,
    longestBreakDays,
    periods,
  }
}
