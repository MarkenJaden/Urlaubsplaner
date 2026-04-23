import type { Holiday } from '@/types'
import { parseISO, eachDayOfInterval, isWeekend, format, getMonth } from 'date-fns'

export interface PlanningPreferences {
  preferBridgeDays: boolean
  optimizeForEfficiency: boolean
  preferSchoolHolidays: boolean
  avoidSchoolHolidays: boolean
  avoidAllStatesSchoolHolidays: boolean
  distributeEvenly: boolean
  noteHandling: 'avoid' | 'prefer'
  minDaysPerBlock: number
  maxDaysPerBlock: number | null
  halfDaysChristmas: boolean
  planFromToday: boolean
  periodPreferences: PeriodPreference[]
}

export interface PeriodPreference {
  type: 'must_have' | 'nice_to_have'
  months: number[]
  minDuration: number
}

export interface VacationSuggestionBlock {
  vacationDays: string[] // yyyy-MM-dd
  freeDaysGained: number
  cost: number
  efficiency: number
  label: string
}

export const DEFAULT_PREFERENCES: PlanningPreferences = {
  preferBridgeDays: true,
  optimizeForEfficiency: false,
  preferSchoolHolidays: false,
  avoidSchoolHolidays: false,
  avoidAllStatesSchoolHolidays: false,
  distributeEvenly: true,
  noteHandling: 'avoid',
  minDaysPerBlock: 1,
  maxDaysPerBlock: null,
  halfDaysChristmas: true,
  planFromToday: true,
  periodPreferences: [],
}

function buildNonWorkSet(startDate: Date, endDate: Date, publicHolidays: Holiday[]): Set<string> {
  const set = new Set<string>()
  for (const d of eachDayOfInterval({ start: startDate, end: endDate })) {
    if (isWeekend(d)) set.add(format(d, 'yyyy-MM-dd'))
  }
  for (const h of publicHolidays) {
    const days = eachDayOfInterval({ start: parseISO(h.startDate), end: parseISO(h.endDate) })
    for (const d of days) set.add(format(d, 'yyyy-MM-dd'))
  }
  return set
}

function buildDateSet(holidays: Holiday[]): Set<string> {
  const set = new Set<string>()
  for (const h of holidays) {
    const days = eachDayOfInterval({ start: parseISO(h.startDate), end: parseISO(h.endDate) })
    for (const d of days) set.add(format(d, 'yyyy-MM-dd'))
  }
  return set
}

function isHalfDayChristmas(dateStr: string): boolean {
  const d = parseISO(dateStr)
  return d.getMonth() === 11 && (d.getDate() === 24 || d.getDate() === 31)
}

function getDayCost(dateStr: string, halfDaysChristmas: boolean): number {
  return halfDaysChristmas && isHalfDayChristmas(dateStr) ? 0.5 : 1.0
}

function getMonthLabel(dateStr: string): string {
  const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
  return months[parseISO(dateStr).getMonth()]
}

interface Opportunity {
  vacationDays: string[]
  freeDaysGained: number
  cost: number
  score: number
  dynamicScore: number
  hasSatisfiedMustHave: boolean
}

export function suggestVacation(
  year: number,
  publicHolidays: Holiday[],
  schoolHolidays: Holiday[],
  noteDates: Set<string>,
  remainingDays: number,
  existingVacationDates: Set<string>,
  prefs: PlanningPreferences,
  overwriteExisting: boolean,
): VacationSuggestionBlock[] {
  const startDate = prefs.planFromToday && new Date().getFullYear() === year
    ? new Date(Math.max(Date.now(), new Date(year, 0, 1).getTime()))
    : new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31)

  const nonWorkDays = buildNonWorkSet(startDate, endDate, publicHolidays)
  const shDates = buildDateSet(schoolHolidays)
  const avoidDates = prefs.avoidSchoolHolidays ? shDates : new Set<string>()

  // Find all work-day blocks between non-work days
  const opportunities: Opportunity[] = []
  let cur = new Date(startDate)

  while (cur <= endDate) {
    const curStr = format(cur, 'yyyy-MM-dd')
    if (nonWorkDays.has(curStr)) { cur = new Date(cur.getTime() + 86400000); continue }

    const prevStr = format(new Date(cur.getTime() - 86400000), 'yyyy-MM-dd')
    if (!nonWorkDays.has(prevStr) && cur > startDate) { cur = new Date(cur.getTime() + 86400000); continue }

    // Collect contiguous work day block
    const workDays: string[] = []
    let temp = new Date(cur)
    while (!nonWorkDays.has(format(temp, 'yyyy-MM-dd')) && temp <= endDate) {
      workDays.push(format(temp, 'yyyy-MM-dd'))
      temp = new Date(temp.getTime() + 86400000)
    }

    const afterStr = format(temp, 'yyyy-MM-dd')
    if (!nonWorkDays.has(afterStr) && temp <= endDate) { cur = temp; continue }

    // Count surrounding free days
    let freeBefore = 0
    let check = new Date(cur.getTime() - 86400000)
    while (nonWorkDays.has(format(check, 'yyyy-MM-dd')) && check >= startDate) {
      freeBefore++; check = new Date(check.getTime() - 86400000)
    }
    let freeAfter = 0
    check = new Date(temp)
    while (nonWorkDays.has(format(check, 'yyyy-MM-dd')) && check <= endDate) {
      freeAfter++; check = new Date(check.getTime() + 86400000)
    }

    const cost = workDays.reduce((sum, d) => sum + getDayCost(d, prefs.halfDaysChristmas), 0)
    const freeDaysGained = workDays.length + freeBefore + freeAfter
    const efficiency = cost > 0 ? freeDaysGained / cost : 0
    let score = efficiency * 10

    // Apply constraints
    if (workDays.length < prefs.minDaysPerBlock) score = 0
    if (prefs.maxDaysPerBlock !== null && workDays.length > prefs.maxDaysPerBlock) score = 0

    if (score > 0) {
      const overlapsNotes = noteDates.size > 0 && workDays.some(d => noteDates.has(d))
      if (overlapsNotes) {
        score *= prefs.noteHandling === 'prefer' ? 1.35 : 0.20
      }
      if (prefs.preferSchoolHolidays && workDays.some(d => shDates.has(d))) score *= 1.5
      if (prefs.avoidSchoolHolidays && workDays.some(d => avoidDates.has(d))) score *= 0.5
      if (prefs.preferBridgeDays && efficiency >= 2.0) score *= 1.2
    }

    let hasSatisfiedMustHave = false
    for (const pref of prefs.periodPreferences) {
      const monthsMatch = workDays.some(d => pref.months.includes(parseISO(d).getMonth() + 1))
      if (monthsMatch && workDays.length >= pref.minDuration) {
        if (pref.type === 'must_have') { score += 10000; hasSatisfiedMustHave = true }
        else if (pref.type === 'nice_to_have') score *= 1.5
      }
    }

    if (score > 0) {
      opportunities.push({ vacationDays: workDays, freeDaysGained, cost, score, dynamicScore: score, hasSatisfiedMustHave })
    }

    cur = temp
  }

  // Filter must-have if any
  let candidates = prefs.periodPreferences.some(p => p.type === 'must_have')
    ? opportunities.filter(o => o.hasSatisfiedMustHave)
    : [...opportunities]

  if (!overwriteExisting) {
    candidates = candidates.filter(op => !op.vacationDays.some(d => existingVacationDates.has(d)))
  }

  candidates.sort((a, b) => b.score - a.score)

  // Greedy selection with dynamic re-scoring
  const selected: Opportunity[] = []
  let budget = remainingDays
  let hasLongVacation = false
  let hasSummerVacation = false

  while (candidates.length > 0 && budget > 0) {
    // Dynamic re-score
    for (const c of candidates) {
      c.dynamicScore = c.score
      if (!prefs.optimizeForEfficiency) {
        if (!hasLongVacation && (prefs.maxDaysPerBlock === null || prefs.maxDaysPerBlock >= 10) && c.vacationDays.length >= 8)
          c.dynamicScore *= 1.35
        const hasMustHave = prefs.periodPreferences.some(p => p.type === 'must_have')
        if (!hasSummerVacation && !hasMustHave) {
          const mid = c.vacationDays[Math.floor(c.vacationDays.length / 2)]
          const m = getMonth(parseISO(mid))
          if (m >= 5 && m <= 7) c.dynamicScore *= 1.15
        }
      }
      if (prefs.distributeEvenly && selected.length > 0) {
        const candFirst = parseISO(c.vacationDays[0]).getTime()
        const minDist = Math.min(...selected.map(s => Math.abs(parseISO(s.vacationDays[0]).getTime() - candFirst) / 86400000))
        if (minDist < 60) c.dynamicScore *= 0.2
        else if (minDist < 90) c.dynamicScore *= 0.7
      }
    }

    candidates.sort((a, b) => b.dynamicScore - a.dynamicScore)
    const best = candidates.shift()!

    if (best.cost <= budget) {
      const overlaps = selected.some(s => s.vacationDays.some(d => best.vacationDays.includes(d)))
      if (!overlaps) {
        selected.push(best)
        budget -= best.cost
        if (best.vacationDays.length >= 8) hasLongVacation = true
        const mid = best.vacationDays[Math.floor(best.vacationDays.length / 2)]
        if (getMonth(parseISO(mid)) >= 5 && getMonth(parseISO(mid)) <= 7) hasSummerVacation = true
      }
    }
  }

  return selected
    .sort((a, b) => a.vacationDays[0].localeCompare(b.vacationDays[0]))
    .map(op => ({
      vacationDays: op.vacationDays,
      freeDaysGained: op.freeDaysGained,
      cost: op.cost,
      efficiency: op.cost > 0 ? op.freeDaysGained / op.cost : 0,
      label: op.vacationDays.length === 1
        ? `Brückentag ${getMonthLabel(op.vacationDays[0])}`
        : `${getMonthLabel(op.vacationDays[0])} – ${getMonthLabel(op.vacationDays[op.vacationDays.length - 1])}`,
    }))
}
