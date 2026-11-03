import type { Holiday, OptimizationGoal, SchoolHolidayStrategy, NoteHandling } from '@/types'
import { parseISO, eachDayOfInterval, isWeekend, format, getMonth, differenceInCalendarDays } from 'date-fns'
import { isChristmasHalfDay } from './vacation-accounting'
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
  periodPreferences: PeriodPreference[]
}

export interface VacationSuggestionBlock {
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
  periodPreferences: [],
}

function addDaysDate(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000)
}

function buildNonWorkSet(
  startDate: Date,
  endDate: Date,
  publicHolidays: Holiday[],
  countWeekendsAsVacation = false,
): Set<string> {
  const set = new Set<string>()
  if (!countWeekendsAsVacation) {
    for (const d of eachDayOfInterval({ start: startDate, end: endDate })) {
      if (isWeekend(d)) set.add(format(d, 'yyyy-MM-dd'))
    }
  }
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

function buildHolidayNameByDate(publicHolidays: Holiday[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const h of publicHolidays) {
    const name = localizedName(h.name, 'Feiertag')
    const start = parseISO(h.startDate)
    const end = parseISO(h.endDate)
    if (start > end) continue
    for (const d of eachDayOfInterval({ start, end })) {
      map.set(format(d, 'yyyy-MM-dd'), name)
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

function expandFreeSpan(
  firstWorkDay: string,
  lastWorkDay: string,
  freeSet: Set<string>,
  yearStart: Date,
  yearEnd: Date,
): { spanStart: string; spanEnd: string; freeDaysGained: number } {
  let start = parseISO(firstWorkDay)
  while (start > yearStart) {
    const prev = addDaysDate(start, -1)
    const prevStr = format(prev, 'yyyy-MM-dd')
    if (freeSet.has(prevStr)) start = prev
    else break
  }
  let end = parseISO(lastWorkDay)
  while (end < yearEnd) {
    const next = addDaysDate(end, 1)
    const nextStr = format(next, 'yyyy-MM-dd')
    if (freeSet.has(nextStr)) end = next
    else break
  }
  const spanStart = format(start, 'yyyy-MM-dd')
  const spanEnd = format(end, 'yyyy-MM-dd')
  const freeDaysGained = differenceInCalendarDays(end, start) + 1
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

  if (vacationDays.length === 1) {
    const hName = holidaysIncluded[0]
    return {
      label: hName ? `Brückentag ${hName}` : `Brückentag ${firstMonth}`,
      reason: hName
        ? `Verbindet ${hName} mit dem Wochenende (${freeDaysGained} Tage frei am Stück)`
        : `1 Urlaubstag für ${freeDaysGained} zusammenhängende freie Tage`,
      category: 'bridge',
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
    reason: `${cost} Urlaubstage für ${freeDaysGained} freie Tage inkl. Wochenenden`,
    category: 'relax',
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
): VacationSuggestionBlock[] {
  const goal = resolveGoal(prefs)
  const schoolStrategy = resolveSchoolStrategy(prefs)
  const reserve = Math.max(0, prefs.reserveDaysToKeep ?? 0)
  const effectiveBudget = Math.max(0, remainingDays - reserve)
  if (effectiveBudget <= 0) return []

  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const today = new Date()
  const startDate = prefs.planFromToday && today.getFullYear() === year
    ? new Date(Math.max(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(), yearStart.getTime()))
    : yearStart

  if (startDate > yearEnd) return []

  const baseNonWorkDays = buildNonWorkSet(yearStart, yearEnd, publicHolidays, prefs.countWeekendsAsVacation)
  const existingSet = overwriteExisting ? new Set<string>() : new Set(existingVacationDates)
  // Free days include weekends, public holidays, and (when extending) already planned vacation days
  const effectiveNonWorkDays = new Set([...baseNonWorkDays, ...existingSet])
  const holidayNameByDate = buildHolidayNameByDate(publicHolidays)
  const shDates = buildDateSet(schoolHolidays)
  const avoidMonthsSet = new Set(prefs.avoidMonths ?? [])
  for (const p of prefs.periodPreferences ?? []) {
    if ((p.type as string) === 'avoid_months') {
      for (const m of p.months) avoidMonthsSet.add(m)
    }
  }

  // Step 1: Collect elementary contiguous workday segments between non-workdays
  const segments: WorkSegment[] = []
  let cur = new Date(startDate)
  while (cur <= yearEnd) {
    const curStr = format(cur, 'yyyy-MM-dd')
    if (effectiveNonWorkDays.has(curStr)) {
      cur = addDaysDate(cur, 1)
      continue
    }
    const workDays: string[] = []
    const segStart = new Date(cur)
    let temp = new Date(cur)
    while (temp <= yearEnd && !effectiveNonWorkDays.has(format(temp, 'yyyy-MM-dd'))) {
      workDays.push(format(temp, 'yyyy-MM-dd'))
      temp = addDaysDate(temp, 1)
    }
    segments.push({ workDays, start: segStart, end: addDaysDate(temp, -1) })
    cur = temp
  }

  const maxBlock = prefs.maxDaysPerBlock ?? 20
  const minBlock = Math.max(1, prefs.minDaysPerBlock ?? 1)
  const allowSingle = prefs.allowSingleDayBridges ?? true

  // Helper to evaluate and create a Candidate from a list of workdays
  const createCandidate = (
    workDays: string[],
    matchedMustHaveIndex: number | null = null,
    customLabel?: string,
  ): Candidate | null => {
    const newVacationDays = workDays.filter(d => !existingSet.has(d) && !baseNonWorkDays.has(d))
    if (newVacationDays.length === 0) return null

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

    const { spanStart, spanEnd, freeDaysGained } = expandFreeSpan(
      workDays[0],
      workDays[workDays.length - 1],
      effectiveNonWorkDays,
      yearStart,
      yearEnd,
    )
    const effectiveCostForRatio = newVacationDays.length === 1 ? Math.max(1, cost) : cost
    const efficiency = effectiveCostForRatio > 0 ? freeDaysGained / effectiveCostForRatio : 0
    const holidaysIncluded = collectHolidaysInSpan(spanStart, spanEnd, holidayNameByDate)
    const schoolOverlapCount = newVacationDays.filter(d => shDates.has(d)).length
    const schoolHolidayRatio = schoolOverlapCount / newVacationDays.length

    // Base score calculation
    let score = efficiency * 12

    // Strategy-specific weighting
    if (goal === 'max_efficiency') {
      score = Math.pow(efficiency, 1.8) * 10
      if (holidaysIncluded.length > 0) score *= 1.25
    } else if (goal === 'long_breaks') {
      score = efficiency * 8 + Math.min(freeDaysGained, 24) * 1.6
      if (freeDaysGained >= 9) score *= 1.45
      if (freeDaysGained >= 14) score *= 1.25
      if (newVacationDays.length === 1 && efficiency < 3.5) score *= 0.65
    } else if (goal === 'distributed') {
      score = efficiency * 10 + (freeDaysGained >= 4 && freeDaysGained <= 11 ? 8 : 0)
    } else {
      // 'balanced': reward strong bridge days AND holiday combos
      if (holidaysIncluded.length > 0) score *= 1.25
      if (efficiency >= 2.2) score *= 1.2
    }

    if (prefs.preferBridgeDays && (newVacationDays.length <= 2 || holidaysIncluded.length > 0) && efficiency >= 2.0) {
      score *= 1.25
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

  // Generate single-segment, partial-segment (around mid-week holidays), and multi-segment (1-3 week) candidates
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    // 1. Full segment
    addCandidate(createCandidate(seg.workDays))

    // 2. Partial segments (e.g., 1-2 day bridges at start or end of segment when adjacent to a holiday)
    if (seg.workDays.length >= 3) {
      const beforeFirst = format(addDaysDate(seg.start, -1), 'yyyy-MM-dd')
      const afterLast = format(addDaysDate(seg.end, 1), 'yyyy-MM-dd')
      if (holidayNameByDate.has(beforeFirst)) {
        addCandidate(createCandidate(seg.workDays.slice(0, 1)))
        addCandidate(createCandidate(seg.workDays.slice(0, 2)))
      }
      if (holidayNameByDate.has(afterLast)) {
        addCandidate(createCandidate(seg.workDays.slice(-1)))
        addCandidate(createCandidate(seg.workDays.slice(-2)))
      }
    }

    // 3. Multi-segment combinations (2, 3, or 4 consecutive segments across weekends/holidays for 2-3 week vacations!)
    let combinedWorkDays = [...seg.workDays]
    for (let j = i + 1; j < Math.min(i + 4, segments.length); j++) {
      const gapDays = differenceInCalendarDays(segments[j].start, segments[j - 1].end) - 1
      // Only bridge across contiguous non-workday gaps (weekends / public holidays)
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

  const mustHaveRules = (prefs.periodPreferences ?? []).filter(
    p => p.type === 'exact_range' || p.type === 'must_have',
  )

  for (let rIdx = 0; rIdx < mustHaveRules.length; rIdx++) {
    const rule = mustHaveRules[rIdx]
    if (budget <= 0) break

    if (rule.type === 'exact_range' && rule.startDate && rule.endDate) {
      const rStart = parseISO(rule.startDate)
      const rEnd = parseISO(rule.endDate)
      if (rStart <= rEnd) {
        const rangeWorkDays = eachDayOfInterval({ start: rStart, end: rEnd })
          .map(d => format(d, 'yyyy-MM-dd'))
          .filter(d => !effectiveNonWorkDays.has(d) && !usedDates.has(d))

        if (rule.exactDays && rule.exactDays > 0 && rule.exactDays < rangeWorkDays.length) {
          // Find best sliding window of length rule.exactDays inside rangeWorkDays
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
    // Also generate custom exact-length windows inside segments of the requested months if needed
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

  // Step 3: Fill remaining budget with dynamic re-scoring
  let candidates = [...candidateMap.values()].filter(
    c => !c.vacationDays.some(d => usedDates.has(d)),
  )

  let hasLongVacation = selected.some(s => s.vacationDays.length >= 8 || s.freeDaysGained >= 14)
  let hasSummerVacation = selected.some(s => {
    const mid = s.vacationDays[Math.floor(s.vacationDays.length / 2)]
    const m = getMonth(parseISO(mid))
    return m >= 5 && m <= 7
  })

  const minGap = prefs.distributeEvenly ? Math.max(7, prefs.minGapDaysBetweenBlocks ?? 14) : 0

  while (candidates.length > 0 && budget > 0) {
    candidates = candidates.filter(c => c.cost <= budget && !c.vacationDays.some(d => usedDates.has(d)))
    if (candidates.length === 0) break

    for (const c of candidates) {
      c.dynamicScore = c.baseScore

      if (goal === 'balanced' || goal === 'long_breaks') {
        if (!hasLongVacation && (prefs.maxDaysPerBlock === null || prefs.maxDaysPerBlock >= 8) && c.vacationDays.length >= 8) {
          c.dynamicScore *= 1.45
        }
        if (!hasSummerVacation && mustHaveRules.length === 0) {
          const mid = c.vacationDays[Math.floor(c.vacationDays.length / 2)]
          const m = getMonth(parseISO(mid))
          if (m >= 5 && m <= 7 && c.vacationDays.length >= 5) c.dynamicScore *= 1.25
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
        if (minDistance < minGap) c.dynamicScore *= 0.15
        else if (minDistance < 35) c.dynamicScore *= 0.45
        else if (minDistance < 60) c.dynamicScore *= 0.78
      }
    }

    candidates.sort((a, b) => b.dynamicScore - a.dynamicScore)
    const best = candidates.shift()!

    // Prevent overlapping free spans unless no other choice
    const spanOverlaps = selected.some(
      s => !(best.spanEnd < s.spanStart || best.spanStart > s.spanEnd),
    )
    if (!spanOverlaps && best.cost <= budget) {
      selected.push(best)
      budget -= best.cost
      best.vacationDays.forEach(d => usedDates.add(d))
      if (best.vacationDays.length >= 8 || best.freeDaysGained >= 14) hasLongVacation = true
      const mid = best.vacationDays[Math.floor(best.vacationDays.length / 2)]
      if (getMonth(parseISO(mid)) >= 5 && getMonth(parseISO(mid)) <= 7) hasSummerVacation = true
    }
  }

  return selected
    .sort((a, b) => a.vacationDays[0].localeCompare(b.vacationDays[0]))
    .map(op => ({
      vacationDays: op.vacationDays,
      startDate: op.spanStart,
      endDate: op.spanEnd,
      freeDaysGained: op.freeDaysGained,
      cost: op.cost,
      efficiency: op.cost > 0 ? op.freeDaysGained / op.cost : 0,
      label: op.label,
      reason: op.reason,
      category: op.category,
      holidaysIncluded: op.holidaysIncluded,
      inSchoolHolidays: op.schoolHolidayRatio >= 0.5,
    }))
}
