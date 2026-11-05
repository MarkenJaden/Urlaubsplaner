import type {
  Holiday,
  OptimizationGoal,
  SchoolHolidayStrategy,
  NoteHandling,
  PlanStartMode,
  ExcludedDateRange,
} from '@/types'
import { parseISO, eachDayOfInterval, format, getMonth, differenceInCalendarDays } from 'date-fns'
import { isChristmasHalfDay, DEFAULT_WORK_DAYS } from './vacation-accounting'
import { localizedName } from './holiday-regions'

export interface PeriodPreference {
  id?: string
  type: 'must_have' | 'nice_to_have' | 'exact_range'
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
  minDaysPerBlock: number
  maxDaysPerBlock: number | null
  minGapDaysBetweenBlocks?: number
  reserveDaysToKeep?: number
  allowSingleDayBridges?: boolean
  avoidMonths?: number[]
  halfDaysChristmas: boolean
  planFromToday: boolean
  countWeekendsAsVacation?: boolean
  /** Active working weekdays (0=Sun, 1=Mon, ..., 6=Sat). Defaults to [1, 2, 3, 4, 5]. */
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

export interface VacationSuggestionBlock {
  id?: string
  vacationDays: string[] // yyyy-MM-dd (only workdays that cost vacation)
  startDate: string // yyyy-MM-dd (first free day including surrounding weekend/holiday)
  endDate: string // yyyy-MM-dd (last free day including surrounding weekend/holiday)
  freeDaysGained: number
  cost: number
  efficiency: number
  label: string
  reason: string
  category: 'bridge' | 'holiday_combo' | 'long_vacation' | 'custom_period' | 'relax'
  holidaysIncluded: string[]
  inSchoolHolidays: boolean
  /** Calendar days in startDate..endDate where the aligned partner is already free. */
  partnerFreeOverlapDays?: number
}

export const DEFAULT_PREFERENCES: PlanningPreferences = {
  goal: 'balanced',
  schoolStrategy: 'neutral',
  preferBridgeDays: true,
  optimizeForEfficiency: false,
  preferSchoolHolidays: false,
  avoidSchoolHolidays: false,
  avoidAllStatesSchoolHolidays: false,
  distributeEvenly: true,
  noteHandling: 'avoid',
  minDaysPerBlock: 1,
  maxDaysPerBlock: null,
  minGapDaysBetweenBlocks: 14,
  reserveDaysToKeep: 0,
  allowSingleDayBridges: true,
  avoidMonths: [],
  halfDaysChristmas: true,
  planFromToday: true,
  countWeekendsAsVacation: false,
  workDays: DEFAULT_WORK_DAYS,
  planStartMode: 'today',
  customStartDate: null,
  customEndDate: null,
  excludedDateRanges: [],
  maxBlocks: null,
  minEfficiency: null,
  requireMainVacationDays: null,
  periodPreferences: [],
}

function addDaysDate(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000)
}

function isOffWeekday(day: Date, workDays?: number[]): boolean {
  const dow = day.getDay()
  if (workDays && workDays.length > 0) {
    return !workDays.includes(dow)
  }
  return dow === 0 || dow === 6
}

export function buildNonWorkSet(
  startDate: Date,
  endDate: Date,
  publicHolidays: Holiday[],
  countWeekendsAsVacation = false,
  workDays?: number[],
): Set<string> {
  const set = new Set<string>()
  // Include a 7-day buffer before startDate and after endDate so New Year's Day (Jan 1)
  // and surrounding weekends across year boundaries are accurately recognized as free days.
  const bufferedStart = addDaysDate(startDate, -7)
  const bufferedEnd = addDaysDate(endDate, 7)
  if (!countWeekendsAsVacation) {
    for (const d of eachDayOfInterval({ start: bufferedStart, end: bufferedEnd })) {
      if (isOffWeekday(d, workDays)) set.add(format(d, 'yyyy-MM-dd'))
    }
  }
  // Always mark Jan 1 of (endDate.year + 1) as a public holiday (Neujahr)
  set.add(`${endDate.getFullYear() + 1}-01-01`)
  for (const h of publicHolidays) {
    const start = parseISO(h.startDate)
    const end = parseISO(h.endDate)
    if (start > end) continue
    for (const d of eachDayOfInterval({ start, end })) {
      set.add(format(d, 'yyyy-MM-dd'))
    }
  }
  return set
}

/**
 * Maps date -> holiday name ONLY for public holidays that fall on an actual working day
 * (or when weekends count as vacation). Holidays falling on a regular weekend/off-day
 * (such as 3 Oct 2027 on a Sunday or 1 May 2027 on a Saturday) save 0 vacation days
 * and must never trigger fake bridge days or holiday bonuses.
 */
function buildEffectiveHolidayNameByDate(
  publicHolidays: Holiday[],
  workDays?: number[],
  countWeekendsAsVacation = false,
  halfDaysChristmas = false,
  year?: number,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const h of publicHolidays) {
    const name = localizedName(h.name, 'Feiertag')
    const start = parseISO(h.startDate)
    const end = parseISO(h.endDate)
    if (start > end) continue
    for (const d of eachDayOfInterval({ start, end })) {
      if (countWeekendsAsVacation || !isOffWeekday(d, workDays)) {
        map.set(format(d, 'yyyy-MM-dd'), name)
      }
    }
  }
  if (halfDaysChristmas && year) {
    const dec24 = new Date(year, 11, 24)
    const dec31 = new Date(year, 11, 31)
    const dec24Key = `${year}-12-24`
    const dec31Key = `${year}-12-31`
    if (!map.has(dec24Key) && (countWeekendsAsVacation || !isOffWeekday(dec24, workDays))) {
      map.set(dec24Key, 'Heiligabend (½ Tag)')
    }
    if (!map.has(dec31Key) && (countWeekendsAsVacation || !isOffWeekday(dec31, workDays))) {
      map.set(dec31Key, 'Silvester (½ Tag)')
    }
  }
  return map
}

function buildDateSet(holidays: Holiday[]): Set<string> {
  const set = new Set<string>()
  for (const h of holidays) {
    const start = parseISO(h.startDate)
    const end = parseISO(h.endDate)
    if (start > end) continue
    for (const d of eachDayOfInterval({ start, end })) {
      set.add(format(d, 'yyyy-MM-dd'))
    }
  }
  return set
}

function getDayCost(dateStr: string, halfDaysChristmas: boolean): number {
  return halfDaysChristmas && isChristmasHalfDay(dateStr) ? 0.5 : 1.0
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const MONTH_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function getMonthLabel(dateStr: string): string {
  return MONTH_SHORT[parseISO(dateStr).getMonth()]
}

function resolveGoal(prefs: PlanningPreferences): OptimizationGoal {
  if (prefs.goal && prefs.goal !== 'balanced') return prefs.goal
  if (prefs.optimizeForEfficiency) return 'max_efficiency'
  return prefs.goal ?? 'balanced'
}

function resolveSchoolStrategy(prefs: PlanningPreferences): SchoolHolidayStrategy {
  if (prefs.schoolStrategy && prefs.schoolStrategy !== 'neutral') return prefs.schoolStrategy
  if (prefs.preferSchoolHolidays) return 'prefer'
  if (prefs.avoidAllStatesSchoolHolidays) return 'avoid_heatmap'
  if (prefs.avoidSchoolHolidays) return 'avoid'
  return 'neutral'
}

interface WorkSegment {
  workDays: string[]
  start: Date
  end: Date
}

interface Candidate {
  vacationDays: string[] // New vacation days to add
  allCoveredWorkDays: string[] // Including already planned days if extending
  spanStart: string
  spanEnd: string
  freeDaysGained: number
  cost: number
  efficiency: number
  baseScore: number
  dynamicScore: number
  holidaysIncluded: string[]
  schoolHolidayRatio: number
  category: VacationSuggestionBlock['category']
  label: string
  reason: string
  matchedMustHaveIndex: number | null
}

export function expandFreeSpan(
  firstWorkDay: string,
  lastWorkDay: string,
  freeSet: Set<string>,
  yearStart: Date,
  yearEnd: Date,
): { spanStart: string; spanEnd: string; freeDaysGained: number } {
  const minBoundary = addDaysDate(yearStart, -4)
  const maxBoundary = addDaysDate(yearEnd, 4)
  let start = parseISO(firstWorkDay)
  while (start > minBoundary) {
    const prev = addDaysDate(start, -1)
    const prevStr = format(prev, 'yyyy-MM-dd')
    if (freeSet.has(prevStr)) start = prev
    else break
  }
  let end = parseISO(lastWorkDay)
  while (end < maxBoundary) {
    const next = addDaysDate(end, 1)
    const nextStr = format(next, 'yyyy-MM-dd')
    if (freeSet.has(nextStr)) end = next
    else break
  }
  const freeDaysGained = differenceInCalendarDays(end, start) + 1
  const clampedStart = start < yearStart ? yearStart : start
  const clampedEnd = end > yearEnd ? yearEnd : end
  const spanStart = format(clampedStart, 'yyyy-MM-dd')
  const spanEnd = format(clampedEnd, 'yyyy-MM-dd')
  return { spanStart, spanEnd, freeDaysGained }
}

function collectHolidaysInSpan(spanStart: string, spanEnd: string, holidayNameByDate: Map<string, string>): string[] {
  const names = new Set<string>()
  const start = parseISO(spanStart)
  const end = parseISO(spanEnd)
  for (const d of eachDayOfInterval({ start, end })) {
    const name = holidayNameByDate.get(format(d, 'yyyy-MM-dd'))
    if (name) names.add(name)
  }
  return [...names]
}

function buildSmartLabelAndReason(
  vacationDays: string[],
  spanStart: string,
  spanEnd: string,
  freeDaysGained: number,
  cost: number,
  holidaysIncluded: string[],
  inSchoolHolidays: boolean,
  customLabel?: string,
): { label: string; reason: string; category: VacationSuggestionBlock['category'] } {
  if (customLabel) {
    return {
      label: customLabel,
      reason: `Wunsch-/Pflichtzeitraum (${cost} Urlaubstag${cost !== 1 ? 'e' : ''} → ${freeDaysGained} Tage frei)`,
      category: 'custom_period',
    }
  }

  const firstMonth = getMonthLabel(vacationDays[0])
  const lastMonth = getMonthLabel(vacationDays[vacationDays.length - 1])
  const spanLabel = firstMonth === lastMonth ? firstMonth : `${firstMonth} – ${lastMonth}`

  if (vacationDays.length <= 2 && holidaysIncluded.length > 0) {
    const hName = holidaysIncluded[0]
    return {
      label: `Brückentag ${hName}`,
      reason: `Verbindet ${hName} mit freien Tagen (${cost} UT → ${freeDaysGained} Tage frei am Stück)`,
      category: 'bridge',
    }
  }

  if (vacationDays.length <= 2) {
    return {
      label: `Verlängertes Wochenende (${spanLabel})`,
      reason: `${cost} Urlaubstag${cost !== 1 ? 'e' : ''} für ${freeDaysGained} zusammenhängende freie Tage`,
      category: 'relax',
    }
  }

  if (holidaysIncluded.length > 0) {
    const mainHoliday = holidaysIncluded[0]
    const more = holidaysIncluded.length > 1 ? ` & ${holidaysIncluded[1]}` : ''
    return {
      label: `${mainHoliday}${more} (${spanLabel})`,
      reason: `Nutzt ${holidaysIncluded.join(', ')}: ${cost} Urlaubstage ergeben ${freeDaysGained} freie Tage am Stück`,
      category: 'holiday_combo',
    }
  }

  if (freeDaysGained >= 14 || vacationDays.length >= 8) {
    const mIdx = parseISO(vacationDays[Math.floor(vacationDays.length / 2)]).getMonth()
    const season = mIdx >= 5 && mIdx <= 7 ? 'Sommerurlaub' : mIdx >= 11 || mIdx <= 1 ? 'Winterauszeit' : mIdx >= 2 && mIdx <= 4 ? 'Frühlingsurlaub' : 'Herbsturlaub'
    return {
      label: `${season} (${MONTH_FULL[mIdx]})`,
      reason: `${freeDaysGained} zusammenhängende freie Tage zur tiefen Erholung${inSchoolHolidays ? ' (in den Schulferien)' : ''}`,
      category: 'long_vacation',
    }
  }

  return {
    label: `Erholungswoche (${spanLabel})`,
    reason: `${cost} Urlaubstage für ${freeDaysGained} freie Tage inkl. arbeitsfreier Tage`,
    category: 'relax',
  }
}

/**
 * Recalculates a suggestion block live when the user resizes or drags it on the calendar.
 */
export function recalculateSuggestionBlock(
  year: number,
  rawStartDate: string,
  rawEndDate: string,
  publicHolidays: Holiday[],
  schoolHolidays: Holiday[],
  existingVacationDates: Set<string>,
  options: {
    halfDaysChristmas: boolean
    countWeekendsAsVacation?: boolean
    workDays?: number[]
    overwrite?: boolean
  },
  existingBlock?: Partial<VacationSuggestionBlock>,
): VacationSuggestionBlock | null {
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const sDate = parseISO(rawStartDate < rawEndDate ? rawStartDate : rawEndDate)
  const eDate = parseISO(rawStartDate < rawEndDate ? rawEndDate : rawStartDate)
  const clampedStart = sDate < yearStart ? yearStart : sDate > yearEnd ? yearEnd : sDate
  const clampedEnd = eDate > yearEnd ? yearEnd : eDate < yearStart ? yearStart : eDate
  if (clampedStart > clampedEnd) return null

  const baseNonWorkDays = buildNonWorkSet(
    yearStart,
    yearEnd,
    publicHolidays,
    options.countWeekendsAsVacation,
    options.workDays,
  )
  const existingSet = options.overwrite ? new Set<string>() : existingVacationDates
  const effectiveNonWorkDays = new Set([...baseNonWorkDays, ...existingSet])
  const holidayNameByDate = buildEffectiveHolidayNameByDate(
    publicHolidays,
    options.workDays,
    options.countWeekendsAsVacation,
    options.halfDaysChristmas,
    year,
  )
  const shDates = buildDateSet(schoolHolidays)

  const allDaysInRange = eachDayOfInterval({ start: clampedStart, end: clampedEnd }).map(d =>
    format(d, 'yyyy-MM-dd'),
  )
  const vacationDays = allDaysInRange.filter(
    d => !baseNonWorkDays.has(d) && !existingSet.has(d),
  )

  if (vacationDays.length === 0) return null

  const firstWork = vacationDays[0]
  const lastWork = vacationDays[vacationDays.length - 1]
  // Any day inside [firstWork, lastWork] that is either a new vacation day or non-workday is free
  const spanFreeSet = new Set([...effectiveNonWorkDays, ...vacationDays])
  const { spanStart, spanEnd, freeDaysGained } = expandFreeSpan(
    firstWork,
    lastWork,
    spanFreeSet,
    yearStart,
    yearEnd,
  )

  const cost = vacationDays.reduce(
    (sum, d) => sum + getDayCost(d, options.halfDaysChristmas),
    0,
  )
  const efficiency = cost > 0 ? freeDaysGained / cost : 0
  const holidaysIncluded = collectHolidaysInSpan(spanStart, spanEnd, holidayNameByDate)
  const schoolOverlapCount = vacationDays.filter(d => shDates.has(d)).length
  const inSchoolHolidays = schoolOverlapCount / vacationDays.length >= 0.5

  const { label, reason, category } = buildSmartLabelAndReason(
    vacationDays,
    spanStart,
    spanEnd,
    freeDaysGained,
    cost,
    holidaysIncluded,
    inSchoolHolidays,
  )

  return {
    id: existingBlock?.id,
    vacationDays,
    startDate: spanStart,
    endDate: spanEnd,
    freeDaysGained,
    cost,
    efficiency,
    label,
    reason,
    category,
    holidaysIncluded,
    inSchoolHolidays,
  }
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
  heatmapDensityByDate?: Map<string, number>,
  partnerFreeDates?: Set<string>,
): VacationSuggestionBlock[] {
  const goal = resolveGoal(prefs)
  const schoolStrategy = resolveSchoolStrategy(prefs)
  const reserve = Math.max(0, prefs.reserveDaysToKeep ?? 0)
  const effectiveBudget = Math.max(0, remainingDays - reserve)
  if (effectiveBudget <= 0) return []

  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const today = new Date()

  // Resolve planning start date based on planStartMode / planFromToday
  let startDate = yearStart
  const mode: PlanStartMode = prefs.planStartMode ?? (prefs.planFromToday ? 'today' : 'year_start')

  if (mode === 'custom_date' && prefs.customStartDate && /^\d{4}-\d{2}-\d{2}$/.test(prefs.customStartDate)) {
    const parsed = parseISO(prefs.customStartDate)
    startDate = parsed < yearStart ? yearStart : parsed
  } else if (mode === 'after_last_vacation') {
    const sortedExisting = [...existingVacationDates]
      .filter(d => d.startsWith(`${year}-`))
      .sort()
    if (sortedExisting.length > 0) {
      const lastPlanned = parseISO(sortedExisting[sortedExisting.length - 1])
      startDate = addDaysDate(lastPlanned, 1)
    } else if (today.getFullYear() === year) {
      startDate = new Date(Math.max(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(), yearStart.getTime()))
    }
  } else if (mode === 'today' && prefs.planFromToday !== false && today.getFullYear() === year) {
    startDate = new Date(Math.max(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(), yearStart.getTime()))
  }

  let endDate = yearEnd
  if (prefs.customEndDate && /^\d{4}-\d{2}-\d{2}$/.test(prefs.customEndDate)) {
    const parsedEnd = parseISO(prefs.customEndDate)
    if (parsedEnd <= yearEnd && parsedEnd >= startDate) {
      endDate = parsedEnd
    }
  }

  if (startDate > endDate) return []

  const baseNonWorkDays = buildNonWorkSet(
    yearStart,
    yearEnd,
    publicHolidays,
    prefs.countWeekendsAsVacation,
    prefs.workDays,
  )
  const existingSet = overwriteExisting ? new Set<string>() : new Set(existingVacationDates)
  // Free days include weekends/off-days, public holidays, and (when extending) already planned vacation days
  const effectiveNonWorkDays = new Set([...baseNonWorkDays, ...existingSet])
  const holidayNameByDate = buildEffectiveHolidayNameByDate(
    publicHolidays,
    prefs.workDays,
    prefs.countWeekendsAsVacation,
    prefs.halfDaysChristmas,
    year,
  )
  const shDates = buildDateSet(schoolHolidays)
  const avoidMonthsSet = new Set(prefs.avoidMonths ?? [])
  for (const p of prefs.periodPreferences ?? []) {
    if ((p.type as string) === 'avoid_months') {
      for (const m of p.months) avoidMonthsSet.add(m)
    }
  }

  // Excluded date ranges (blackout periods)
  const excludedDatesSet = new Set<string>()
  for (const ex of prefs.excludedDateRanges ?? []) {
    if (ex.startDate && ex.endDate && ex.startDate <= ex.endDate) {
      const exStart = parseISO(ex.startDate)
      const exEnd = parseISO(ex.endDate)
      for (const d of eachDayOfInterval({ start: exStart, end: exEnd })) {
        excludedDatesSet.add(format(d, 'yyyy-MM-dd'))
      }
    }
  }

  // Step 1: Collect elementary contiguous workday segments between non-workdays.
  // Because effectiveNonWorkDays already contains all workday public holidays, weekends,
  // and off-days, every true 1-day or 2-day bridge (e.g. Friday after Christi Himmelfahrt
  // or Mon-Tue before a Wednesday holiday) is ALREADY its own complete WorkSegment!
  const segments: WorkSegment[] = []
  let cur = new Date(startDate)
  while (cur <= endDate) {
    const curStr = format(cur, 'yyyy-MM-dd')
    if (effectiveNonWorkDays.has(curStr)) {
      cur = addDaysDate(cur, 1)
      continue
    }
    const workDays: string[] = []
    const segStart = new Date(cur)
    let temp = new Date(cur)
    while (temp <= endDate && !effectiveNonWorkDays.has(format(temp, 'yyyy-MM-dd'))) {
      workDays.push(format(temp, 'yyyy-MM-dd'))
      temp = addDaysDate(temp, 1)
    }
    segments.push({ workDays, start: segStart, end: addDaysDate(temp, -1) })
    cur = temp
  }

  const maxBlock = prefs.maxDaysPerBlock ?? 20
  const minBlock = Math.max(1, prefs.minDaysPerBlock ?? 1)
  const allowSingle = prefs.allowSingleDayBridges ?? true
  const minEfficiency = prefs.minEfficiency && prefs.minEfficiency > 1 ? prefs.minEfficiency : null

  // Helper to evaluate and create a Candidate from a list of workdays
  const createCandidate = (
    workDays: string[],
    matchedMustHaveIndex: number | null = null,
    customLabel?: string,
    extraFreeDates?: Set<string>,
  ): Candidate | null => {
    const newVacationDays = workDays.filter(d => !existingSet.has(d) && !baseNonWorkDays.has(d))
    if (newVacationDays.length === 0) return null

    // Enforce excluded dates / blackout periods
    if (excludedDatesSet.size > 0 && newVacationDays.some(d => excludedDatesSet.has(d))) {
      return null
    }

    // Enforce min/max block size unless it's a mandatory rule
    if (matchedMustHaveIndex === null) {
      if (!allowSingle && newVacationDays.length === 1) return null
      if (newVacationDays.length < minBlock) return null
      if (prefs.maxDaysPerBlock !== null && newVacationDays.length > prefs.maxDaysPerBlock) return null
      if (avoidMonthsSet.size > 0 && newVacationDays.some(d => avoidMonthsSet.has(parseISO(d).getMonth() + 1))) {
        return null
      }
    }

    const cost = newVacationDays.reduce((sum, d) => sum + getDayCost(d, prefs.halfDaysChristmas), 0)
    if (cost <= 0 || cost > effectiveBudget) return null

    const freeSet = extraFreeDates
      ? new Set([...effectiveNonWorkDays, ...extraFreeDates, ...newVacationDays])
      : new Set([...effectiveNonWorkDays, ...newVacationDays])

    const { spanStart, spanEnd, freeDaysGained } = expandFreeSpan(
      newVacationDays[0],
      newVacationDays[newVacationDays.length - 1],
      freeSet,
      yearStart,
      yearEnd,
    )
    const effectiveCostForRatio = newVacationDays.length === 1 ? Math.max(1, cost) : cost
    const efficiency = effectiveCostForRatio > 0 ? freeDaysGained / effectiveCostForRatio : 0

    if (matchedMustHaveIndex === null && minEfficiency !== null && efficiency < minEfficiency) {
      return null
    }

    const holidaysIncluded = collectHolidaysInSpan(spanStart, spanEnd, holidayNameByDate)
    const schoolOverlapCount = newVacationDays.filter(d => shDates.has(d)).length
    const schoolHolidayRatio = schoolOverlapCount / newVacationDays.length

    // Base score calculation
    let score = efficiency * 12

    // Strategy-specific weighting
    if (goal === 'max_efficiency') {
      score = Math.pow(efficiency, 1.8) * 10
      if (holidaysIncluded.length > 0) score *= 1.35
      // A single day that does NOT include an effective holiday is just a normal weekend extension
      if (newVacationDays.length <= 2 && holidaysIncluded.length === 0) score *= 0.45
    } else if (goal === 'long_breaks') {
      score = efficiency * 8 + Math.min(freeDaysGained, 24) * 1.6
      if (freeDaysGained >= 9) score *= 1.45
      if (freeDaysGained >= 14) score *= 1.25
      if (newVacationDays.length === 1 && efficiency < 3.5) score *= 0.55
    } else if (goal === 'distributed') {
      score = efficiency * 10 + (freeDaysGained >= 4 && freeDaysGained <= 11 ? 8 : 0)
      if (holidaysIncluded.length > 0) score *= 1.2
    } else {
      // 'balanced': reward strong true bridge days AND holiday combos
      if (holidaysIncluded.length > 0) score *= 1.3
      if (efficiency >= 2.2 && holidaysIncluded.length > 0) score *= 1.2
      if (newVacationDays.length <= 2 && holidaysIncluded.length === 0) score *= 0.5
    }

    // Only boost bridge days if they actually connect an effective workday holiday!
    if (prefs.preferBridgeDays && holidaysIncluded.length > 0 && efficiency >= 2.0) {
      score *= newVacationDays.length <= 2 ? 1.35 : 1.2
    }

    // School holiday strategy (strictly consistent!)
    if (schoolStrategy === 'prefer') {
      if (schoolHolidayRatio >= 0.8) score *= 1.85
      else if (schoolHolidayRatio > 0) score *= 1.35
      else score *= 0.65
    } else if (schoolStrategy === 'avoid') {
      if (schoolHolidayRatio > 0) score *= Math.max(0.15, 1 - schoolHolidayRatio * 0.8)
      else score *= 1.25
    } else if (schoolStrategy === 'avoid_heatmap') {
      if (heatmapDensityByDate && heatmapDensityByDate.size > 0) {
        const avgDensity = newVacationDays.reduce((acc, d) => acc + (heatmapDensityByDate.get(d) ?? 0), 0) / newVacationDays.length
        score *= Math.max(0.2, 1.3 - avgDensity * 1.1)
      } else if (schoolHolidayRatio > 0) {
        score *= 0.35
      }
    }

    // Note handling
    if (noteDates.size > 0 && prefs.noteHandling !== 'ignore') {
      const overlapsNotes = newVacationDays.some(d => noteDates.has(d))
      if (overlapsNotes) {
        score *= prefs.noteHandling === 'prefer' ? 1.5 : 0.18
      }
    }

    // Nice-to-have period preferences
    for (const pref of prefs.periodPreferences ?? []) {
      if (pref.type === 'nice_to_have') {
        const inMonths = pref.months.length === 0 || newVacationDays.some(d => pref.months.includes(parseISO(d).getMonth() + 1))
        const inRange = (!pref.startDate || spanStart >= pref.startDate) && (!pref.endDate || spanEnd <= pref.endDate)
        const durationOk = pref.exactDays ? newVacationDays.length === pref.exactDays : newVacationDays.length >= pref.minDuration
        if (inMonths && inRange && durationOk) {
          score *= 1.65
        }
      }
    }

    // Partner alignment: reward candidates where the partner is already off on our working days
    // (e.g. partner's planned vacation, 4-day-week off-days, or regional public holidays).
    if (partnerFreeDates && partnerFreeDates.size > 0) {
      const partnerWorkdayMatches = newVacationDays.filter(d => partnerFreeDates.has(d)).length
      if (partnerWorkdayMatches > 0) {
        const matchRatio = partnerWorkdayMatches / newVacationDays.length
        score *= 1 + 1.45 * matchRatio + (matchRatio === 1 ? 0.35 : 0)
      }
    }

    const { label, reason, category } = buildSmartLabelAndReason(
      newVacationDays,
      spanStart,
      spanEnd,
      freeDaysGained,
      cost,
      holidaysIncluded,
      schoolHolidayRatio >= 0.5,
      customLabel,
    )

    return {
      vacationDays: newVacationDays,
      allCoveredWorkDays: workDays,
      spanStart,
      spanEnd,
      freeDaysGained,
      cost,
      efficiency,
      baseScore: score,
      dynamicScore: score,
      holidaysIncluded,
      schoolHolidayRatio,
      category,
      label,
      reason,
      matchedMustHaveIndex,
    }
  }

  const candidateMap = new Map<string, Candidate>()
  const addCandidate = (cand: Candidate | null) => {
    if (!cand) return
    const key = cand.vacationDays.join(',')
    const existing = candidateMap.get(key)
    if (!existing || cand.baseScore > existing.baseScore || cand.matchedMustHaveIndex !== null) {
      candidateMap.set(key, cand)
    }
  }

  // Generate complete single-segment and multi-segment (1-4 week) candidates.
  // Because segments are already split at every workday public holiday, every true
  // 1-day or 2-day holiday bridge is already a full segment in `segments`.
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    // 1. Full segment (connects non-workdays before seg with non-workdays after seg)
    addCandidate(createCandidate(seg.workDays))

    // 2. If maxDaysPerBlock is explicitly smaller than a full workweek segment, allow edge slices of size maxBlock
    if (prefs.maxDaysPerBlock !== null && prefs.maxDaysPerBlock < seg.workDays.length) {
      addCandidate(createCandidate(seg.workDays.slice(0, prefs.maxDaysPerBlock)))
      addCandidate(createCandidate(seg.workDays.slice(-prefs.maxDaysPerBlock)))
    }

    // 2b. Partner alignment sub-slices: if the partner is off on specific workdays inside this segment
    // (e.g. Friday of a 4-day week, or Mon–Wed planned trip), generate exact matching sub-slices.
    if (partnerFreeDates && partnerFreeDates.size > 0 && seg.workDays.length > 1) {
      let runStart = -1
      for (let k = 0; k <= seg.workDays.length; k++) {
        const isPartnerOff = k < seg.workDays.length && partnerFreeDates.has(seg.workDays[k])
        if (isPartnerOff && runStart === -1) {
          runStart = k
        } else if (!isPartnerOff && runStart !== -1) {
          const slice = seg.workDays.slice(runStart, k)
          if (slice.length < seg.workDays.length) {
            addCandidate(createCandidate(slice))
          }
          runStart = -1
        }
      }
    }

    // 3. Multi-segment combinations (2, 3, 4, or 5 consecutive segments across weekends/holidays for 1-3 week vacations!)
    let combinedWorkDays = [...seg.workDays]
    for (let j = i + 1; j < Math.min(i + 5, segments.length); j++) {
      const gapDays = differenceInCalendarDays(segments[j].start, segments[j - 1].end) - 1
      // Only bridge across contiguous non-workday gaps (weekends / off-days / public holidays)
      if (gapDays > 6) break
      combinedWorkDays = [...combinedWorkDays, ...segments[j].workDays]
      if (combinedWorkDays.length > maxBlock) break
      addCandidate(createCandidate(combinedWorkDays))
    }
  }

  // Step 2: Satisfy mandatory rules (exact_range & must_have)
  const selected: Candidate[] = []
  let budget = effectiveBudget
  const usedDates = new Set<string>()
  const maxBlocksLimit = prefs.maxBlocks && prefs.maxBlocks > 0 ? prefs.maxBlocks : null

  const mustHaveRules = (prefs.periodPreferences ?? []).filter(
    p => p.type === 'exact_range' || p.type === 'must_have',
  )

  for (let rIdx = 0; rIdx < mustHaveRules.length; rIdx++) {
    const rule = mustHaveRules[rIdx]
    if (budget <= 0) break
    if (maxBlocksLimit !== null && selected.length >= maxBlocksLimit) break

    if (rule.type === 'exact_range' && rule.startDate && rule.endDate) {
      const rStart = parseISO(rule.startDate)
      const rEnd = parseISO(rule.endDate)
      if (rStart <= rEnd) {
        const rangeWorkDays = eachDayOfInterval({ start: rStart, end: rEnd })
          .map(d => format(d, 'yyyy-MM-dd'))
          .filter(d => !effectiveNonWorkDays.has(d) && !usedDates.has(d) && !excludedDatesSet.has(d))

        if (rule.exactDays && rule.exactDays > 0 && rule.exactDays < rangeWorkDays.length) {
          let bestWindow: Candidate | null = null
          for (let startIdx = 0; startIdx <= rangeWorkDays.length - rule.exactDays; startIdx++) {
            const sub = rangeWorkDays.slice(startIdx, startIdx + rule.exactDays)
            const cand = createCandidate(sub, rIdx, rule.label || 'Pflicht-Zeitraum')
            if (cand && cand.cost <= budget && (!bestWindow || cand.baseScore > bestWindow.baseScore)) {
              bestWindow = cand
            }
          }
          if (bestWindow) {
            selected.push(bestWindow)
            budget -= bestWindow.cost
            bestWindow.vacationDays.forEach(d => usedDates.add(d))
            continue
          }
        } else if (rangeWorkDays.length > 0) {
          const cand = createCandidate(rangeWorkDays, rIdx, rule.label || 'Fester Wunschzeitraum')
          if (cand && cand.cost <= budget) {
            selected.push(cand)
            budget -= cand.cost
            cand.vacationDays.forEach(d => usedDates.add(d))
            continue
          }
        }
      }
    }

    // Must-have month / duration rule
    const targetDays = rule.exactDays && rule.exactDays > 0 ? rule.exactDays : Math.max(1, rule.minDuration || 5)
    for (let i = 0; i < segments.length; i++) {
      let pool: string[] = []
      for (let j = i; j < Math.min(i + 5, segments.length); j++) {
        pool = [...pool, ...segments[j].workDays]
        if (pool.length >= targetDays) {
          const slice = pool.slice(0, targetDays)
          if (rule.months.length === 0 || slice.every(d => rule.months.includes(parseISO(d).getMonth() + 1))) {
            addCandidate(createCandidate(slice, rIdx, rule.label))
          }
          break
        }
      }
    }

    const filterByMonthMode = (strictEvery: boolean) =>
      [...candidateMap.values()]
        .filter(c => {
          if (c.cost > budget) return false
          if (c.vacationDays.some(d => usedDates.has(d))) return false
          const monthsOk =
            rule.months.length === 0 ||
            (strictEvery
              ? c.vacationDays.every(d => rule.months.includes(parseISO(d).getMonth() + 1))
              : c.vacationDays.some(d => rule.months.includes(parseISO(d).getMonth() + 1)))
          if (!monthsOk) return false
          if (rule.startDate && c.vacationDays[0] < rule.startDate) return false
          if (rule.endDate && c.vacationDays[c.vacationDays.length - 1] > rule.endDate) return false
          if (rule.exactDays && rule.exactDays > 0) return c.vacationDays.length === rule.exactDays
          return c.vacationDays.length >= (rule.minDuration || 1)
        })
        .sort((a, b) => b.baseScore - a.baseScore)

    const strictMatches = filterByMonthMode(true)
    const matching = strictMatches.length > 0 ? strictMatches : filterByMonthMode(false)

    if (matching[0]) {
      const pick = {
        ...matching[0],
        category: 'custom_period' as const,
        reason: `Pflicht-Vorgabe erfüllt (${matching[0].cost} Urlaubstage → ${matching[0].freeDaysGained} freie Tage)`,
      }
      selected.push(pick)
      budget -= pick.cost
      pick.vacationDays.forEach(d => usedDates.add(d))
    }
  }

  // Step 3: Fill remaining budget with dynamic marginal re-scoring
  let candidates = [...candidateMap.values()].filter(
    c => !c.vacationDays.some(d => usedDates.has(d)),
  )

  const requiredMainDays = prefs.requireMainVacationDays && prefs.requireMainVacationDays > 0
    ? prefs.requireMainVacationDays
    : 8

  let hasLongVacation = selected.some(
    s => s.vacationDays.length >= requiredMainDays || s.freeDaysGained >= 14,
  )
  let hasSummerVacation = selected.some(s => {
    const mid = s.vacationDays[Math.floor(s.vacationDays.length / 2)]
    const m = getMonth(parseISO(mid))
    return m >= 5 && m <= 7
  })

  const minGap = prefs.distributeEvenly ? Math.max(7, prefs.minGapDaysBetweenBlocks ?? 14) : 0

  while (candidates.length > 0 && budget > 0) {
    if (maxBlocksLimit !== null && selected.length >= maxBlocksLimit) break

    candidates = candidates.filter(c => c.cost <= budget && !c.vacationDays.some(d => usedDates.has(d)))
    if (candidates.length === 0) break

    for (const c of candidates) {
      c.dynamicScore = c.baseScore

      // Check if c's free span overlaps/touches any already-selected block (e.g. second Easter week).
      // If so, discount by the true marginal free days gained so shared holidays/weekends aren't double-counted.
      const touching = selected.filter(
        s => !(c.spanEnd < s.spanStart || c.spanStart > s.spanEnd),
      )
      if (touching.length > 0) {
        const existingSpanDays = touching.reduce((sum, s) => sum + s.freeDaysGained, 0)
        const allTouchVacDays = [...touching.flatMap(s => s.vacationDays), ...c.vacationDays].sort()
        const combinedFreeSet = new Set([...effectiveNonWorkDays, ...usedDates, ...c.vacationDays])
        const mergedSpan = expandFreeSpan(
          allTouchVacDays[0],
          allTouchVacDays[allTouchVacDays.length - 1],
          combinedFreeSet,
          yearStart,
          yearEnd,
        )
        const marginalFree = Math.max(c.vacationDays.length, mergedSpan.freeDaysGained - existingSpanDays)
        const ratioCorrection = marginalFree / Math.max(1, c.freeDaysGained)
        c.dynamicScore *= Math.pow(ratioCorrection, 1.4)
      }

      if (
        (goal === 'balanced' || goal === 'long_breaks' || Boolean(prefs.requireMainVacationDays)) &&
        !hasLongVacation &&
        (prefs.maxDaysPerBlock === null || prefs.maxDaysPerBlock >= requiredMainDays) &&
        c.vacationDays.length >= requiredMainDays
      ) {
        c.dynamicScore *= prefs.requireMainVacationDays ? 2.2 : 1.45
      }

      if (goal === 'balanced' || goal === 'long_breaks') {
        if (!hasSummerVacation && mustHaveRules.length === 0) {
          const mid = c.vacationDays[Math.floor(c.vacationDays.length / 2)]
          const m = getMonth(parseISO(mid))
          if (m >= 5 && m <= 7 && c.vacationDays.length >= 4) c.dynamicScore *= 1.25
        }
      }

      // Coordinate Christmas & New Year half-days (24.12. & 31.12.) so no 0.5 day is left stranded
      if (prefs.halfDaysChristmas) {
        const currentHasHalf = Math.abs((budget % 1) - 0.5) < 0.01
        const candHasHalf = Math.abs((c.cost % 1) - 0.5) < 0.01
        const nextBudget = budget - c.cost
        if (currentHasHalf && candHasHalf) {
          // Resolves the 0.5 day fraction back to a clean integer!
          c.dynamicScore *= 1.75
        } else if (!currentHasHalf && candHasHalf && nextBudget < 4.5) {
          // Would create a 0.5 fraction without enough budget left for the other Christmas week
          c.dynamicScore *= 0.25
        }
      }

      if (prefs.distributeEvenly && selected.length > 0) {
        const cStart = parseISO(c.spanStart)
        const cEnd = parseISO(c.spanEnd)
        let minDistance = Infinity
        for (const s of selected) {
          const sStart = parseISO(s.spanStart)
          const sEnd = parseISO(s.spanEnd)
          const dist = cEnd < sStart
            ? differenceInCalendarDays(sStart, cEnd)
            : sEnd < cStart
              ? differenceInCalendarDays(cStart, sEnd)
              : 0
          if (dist < minDistance) minDistance = dist
        }
        if (minDistance < minGap) c.dynamicScore *= 0.18
        else if (minDistance < 35) c.dynamicScore *= 0.5
        else if (minDistance < 60) c.dynamicScore *= 0.8
      }
    }

    candidates.sort((a, b) => b.dynamicScore - a.dynamicScore)
    const best = candidates.shift()!

    if (best.cost <= budget) {
      selected.push(best)
      budget -= best.cost
      best.vacationDays.forEach(d => usedDates.add(d))
      if (best.vacationDays.length >= requiredMainDays || best.freeDaysGained >= 14) hasLongVacation = true
      const mid = best.vacationDays[Math.floor(best.vacationDays.length / 2)]
      if (getMonth(parseISO(mid)) >= 5 && getMonth(parseISO(mid)) <= 7) hasSummerVacation = true
    }
  }

  // Step 4: Smart Remainder Filler — if 0.5..3.5 vacation days remain in budget that couldn't fit
  // a full workweek segment, extend an existing vacation block or add a clean weekend/half-day attachment.
  if (budget >= 0.5 && (maxBlocksLimit === null || selected.length < maxBlocksLimit)) {
    const remainderCandidates: Candidate[] = []
    for (const seg of segments) {
      const avail = seg.workDays.filter(d => !usedDates.has(d))
      if (avail.length > 0) {
        for (let len = Math.min(avail.length, 4); len >= 1; len--) {
          const frontSlice = avail.slice(0, len)
          const backSlice = avail.slice(-len)
          const cFront = createCandidate(frontSlice, null, undefined, usedDates)
          const cBack = createCandidate(backSlice, null, undefined, usedDates)
          if (cFront && cFront.cost <= budget) remainderCandidates.push(cFront)
          if (cBack && cBack.cost <= budget) remainderCandidates.push(cBack)
        }
      }
    }
    if (remainderCandidates.length > 0) {
      // Prefer remainder slices that consume the exact remaining budget and/or directly extend an already-selected block
      remainderCandidates.sort((a, b) => {
        const aExact = Math.abs(budget - a.cost) < 0.01 ? 1.5 : 1
        const bExact = Math.abs(budget - b.cost) < 0.01 ? 1.5 : 1
        const aTouches = selected.some(s => !(a.spanEnd < s.spanStart || a.spanStart > s.spanEnd)) ? 1.35 : 1
        const bTouches = selected.some(s => !(b.spanEnd < s.spanStart || b.spanStart > s.spanEnd)) ? 1.35 : 1
        return b.baseScore * bExact * bTouches - a.baseScore * aExact * aTouches
      })
      const pick = remainderCandidates[0]
      selected.push(pick)
      budget -= pick.cost
      pick.vacationDays.forEach(d => usedDates.add(d))
    }
  }

  // Step 5: Merge any selected blocks whose free spans touch or overlap (separated only by non-workdays)
  // so that total freeDaysGained and efficiency are 100% accurate and never double-count shared holidays/weekends.
  const sortedSelected = [...selected].sort((a, b) => a.vacationDays[0].localeCompare(b.vacationDays[0]))
  const finalBlocks: VacationSuggestionBlock[] = []
  const allPlannedSet = new Set([...effectiveNonWorkDays, ...usedDates])

  let idx = 0
  while (idx < sortedSelected.length) {
    let mergedVacDays = [...sortedSelected[idx].vacationDays]
    const customLabels: string[] = sortedSelected[idx].matchedMustHaveIndex !== null ? [sortedSelected[idx].label] : []
    let nextIdx = idx + 1

    while (nextIdx < sortedSelected.length) {
      const prevLast = parseISO(mergedVacDays[mergedVacDays.length - 1])
      const nextFirst = parseISO(sortedSelected[nextIdx].vacationDays[0])
      // Check if every day strictly between prevLast and nextFirst is in allPlannedSet
      let curCheck = addDaysDate(prevLast, 1)
      let allFreeBetween = true
      while (curCheck < nextFirst) {
        if (!allPlannedSet.has(format(curCheck, 'yyyy-MM-dd'))) {
          allFreeBetween = false
          break
        }
        curCheck = addDaysDate(curCheck, 1)
      }
      if (!allFreeBetween) break
      mergedVacDays = [...mergedVacDays, ...sortedSelected[nextIdx].vacationDays]
      if (sortedSelected[nextIdx].matchedMustHaveIndex !== null) {
        customLabels.push(sortedSelected[nextIdx].label)
      }
      nextIdx++
    }

    mergedVacDays.sort()
    const { spanStart, spanEnd, freeDaysGained } = expandFreeSpan(
      mergedVacDays[0],
      mergedVacDays[mergedVacDays.length - 1],
      allPlannedSet,
      yearStart,
      yearEnd,
    )
    const cost = mergedVacDays.reduce((sum, d) => sum + getDayCost(d, prefs.halfDaysChristmas), 0)
    const holidaysIncluded = collectHolidaysInSpan(spanStart, spanEnd, holidayNameByDate)
    const schoolOverlapCount = mergedVacDays.filter(d => shDates.has(d)).length
    const inSchoolHolidays = schoolOverlapCount / mergedVacDays.length >= 0.5
    const { label, reason, category } = buildSmartLabelAndReason(
      mergedVacDays,
      spanStart,
      spanEnd,
      freeDaysGained,
      cost,
      holidaysIncluded,
      inSchoolHolidays,
      customLabels[0],
    )

    const partnerFreeOverlapDays =
      partnerFreeDates && partnerFreeDates.size > 0
        ? eachDayOfInterval({ start: parseISO(spanStart), end: parseISO(spanEnd) }).filter(d =>
            partnerFreeDates.has(format(d, 'yyyy-MM-dd')),
          ).length
        : undefined

    finalBlocks.push({
      id: `sug-${finalBlocks.length}-${mergedVacDays[0]}`,
      vacationDays: mergedVacDays,
      startDate: spanStart,
      endDate: spanEnd,
      freeDaysGained,
      cost,
      efficiency: cost > 0 ? freeDaysGained / cost : 0,
      label,
      reason,
      category,
      holidaysIncluded,
      inSchoolHolidays,
      ...(partnerFreeOverlapDays && partnerFreeOverlapDays > 0 ? { partnerFreeOverlapDays } : {}),
    })

    idx = nextIdx
  }

  return finalBlocks
}
