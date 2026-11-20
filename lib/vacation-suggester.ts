import type {
  Holiday,
  OptimizationGoal,
  SchoolHolidayStrategy,
  NoteHandling,
  PlanStartMode,
  ExcludedDateRange,
  PartnerPlanningOptions,
  PartnerOffWeekdayMode,
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
  preferredMonths?: number[]
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
  partnerOptions?: PartnerPlanningOptions
  periodPreferences: PeriodPreference[]
}

export interface PartnerContext {
  /** Dates on which the partner already entered leave (vacation/gleittag/special). */
  bookedDates: Set<string>
  /** Dates on which the partner has a public holiday (on a day the viewer normally works). */
  holidayDates: Set<string>
  /** Dates where the partner is regularly off due to their workweek (e.g. 4-day week Fridays). */
  offWeekdayDates: Set<string>
  /** Combined set of all partner non-work / already-booked free dates. */
  allFreeDates: Set<string>
  workDays?: number[]
  publicHolidays?: Holiday[]
  halfDaysChristmas?: boolean
  countWeekendsAsVacation?: boolean
  remainingDays?: number
  label?: string
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
  /** In joint `plan_both` mode: workdays the partner takes off for this block. */
  partnerVacationDays?: string[]
  /** In joint `plan_both` mode: vacation cost for the partner. */
  partnerCost?: number
  /** In joint `plan_both` mode: total consecutive days free together. */
  jointFreeDays?: number
  /** Concise badges explaining why the block was chosen. */
  highlights?: string[]
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
  preferredMonths: [],
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
  partnerOptions: {
    mode: 'off',
    strength: 'balanced',
    offWeekdayMode: 'bonus_only',
    maxLongWeekendsOnPartnerOffDay: 3,
    partnerBudget: null,
    partnerReserveDays: 0,
    fillSoloAfterJoint: true,
  },
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
  isPartnerOffDayWeekend?: boolean
  excludedOverlapCount?: number
  avgHeatmapDensity?: number
}

function normalizePartnerContext(
  partnerInput?: PartnerContext | Set<string>,
  viewerWorkDays?: number[],
): PartnerContext | undefined {
  if (!partnerInput) return undefined
  if (partnerInput instanceof Set) {
    if (partnerInput.size === 0) return undefined
    const bookedDates = new Set<string>()
    for (const d of partnerInput) {
      if (!isOffWeekday(parseISO(d), viewerWorkDays)) {
        bookedDates.add(d)
      }
    }
    return {
      bookedDates,
      holidayDates: new Set<string>(),
      offWeekdayDates: new Set<string>(),
      allFreeDates: partnerInput,
    }
  }
  return partnerInput
}

function strengthMultiplier(strength?: PartnerPlanningOptions['strength']): number {
  if (strength === 'gentle') return 0.6
  if (strength === 'strong') return 1.55
  return 1.0
}

function buildBlockHighlights(opts: {
  isCustomPeriod: boolean
  efficiency: number
  holidaysIncluded: string[]
  freeDaysGained: number
  vacationDaysCount: number
  goal: OptimizationGoal
  inSchoolHolidays: boolean
  avgHeatmapDensity?: number
  partnerOverlapDays?: number
}): string[] {
  const tags: string[] = []
  if (opts.isCustomPeriod) tags.push('Pflichtzeitraum')
  if (opts.efficiency >= 2.8 && opts.holidaysIncluded.length > 0) tags.push('Top-Brückentag')
  if (opts.freeDaysGained >= 14 || opts.vacationDaysCount >= 8) tags.push('Haupturlaub')
  if (opts.goal === 'mini_breaks' && opts.freeDaysGained >= 3 && opts.freeDaysGained <= 5) tags.push('Kurztrip')
  if (opts.inSchoolHolidays) tags.push('Schulferien')
  else if (opts.avgHeatmapDensity !== undefined && opts.avgHeatmapDensity <= 0.15) tags.push('Nebensaison')
  if (opts.partnerOverlapDays && opts.partnerOverlapDays > 0) tags.push('Gemeinsam frei')
  return tags.slice(0, 4)
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
  partnerInput?: PartnerContext | Set<string>,
): VacationSuggestionBlock[] {
  const goal = resolveGoal(prefs)
  const schoolStrategy = resolveSchoolStrategy(prefs)
  const reserve = Math.max(0, prefs.reserveDaysToKeep ?? 0)
  const effectiveBudget = Math.max(0, remainingDays - reserve)
  if (effectiveBudget <= 0) return []

  const rawPartnerCtx = normalizePartnerContext(partnerInput, prefs.workDays)
  const partnerMode =
    partnerInput instanceof Set
      ? 'align_to_partner'
      : (prefs.partnerOptions?.mode ?? (rawPartnerCtx ? 'align_to_partner' : 'off'))
  const partnerCtx = partnerMode === 'off' ? undefined : rawPartnerCtx

  if (partnerMode === 'plan_both' && partnerCtx) {
    return suggestJointVacation(
      year,
      publicHolidays,
      schoolHolidays,
      noteDates,
      remainingDays,
      existingVacationDates,
      prefs,
      overwriteExisting,
      heatmapDensityByDate,
      partnerCtx,
    )
  }

  const partnerOpts: Partial<PartnerPlanningOptions> = prefs.partnerOptions ?? {}
  const pStrength = strengthMultiplier(partnerOpts.strength)
  const offWeekdayMode: PartnerOffWeekdayMode = partnerOpts.offWeekdayMode ?? 'bonus_only'
  const maxPartnerOffWeekends = Math.max(0, partnerOpts.maxLongWeekendsOnPartnerOffDay ?? 3)

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
  const preferredMonthsSet = new Set(prefs.preferredMonths ?? [])
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

  const collectSegmentsInRange = (rangeStart: Date, rangeEnd: Date): WorkSegment[] => {
    const segs: WorkSegment[] = []
    let cur = new Date(rangeStart)
    while (cur <= rangeEnd) {
      const curStr = format(cur, 'yyyy-MM-dd')
      if (effectiveNonWorkDays.has(curStr)) {
        cur = addDaysDate(cur, 1)
        continue
      }
      const wDays: string[] = []
      const segStart = new Date(cur)
      let temp = new Date(cur)
      while (temp <= rangeEnd && !effectiveNonWorkDays.has(format(temp, 'yyyy-MM-dd'))) {
        wDays.push(format(temp, 'yyyy-MM-dd'))
        temp = addDaysDate(temp, 1)
      }
      segs.push({ workDays: wDays, start: segStart, end: addDaysDate(temp, -1) })
      cur = temp
    }
    return segs
  }

  // Step 1: Collect elementary contiguous workday segments between non-workdays.
  // Because effectiveNonWorkDays already contains all workday public holidays, weekends,
  // and off-days, every true 1-day or 2-day bridge (e.g. Friday after Christi Himmelfahrt
  // or Mon-Tue before a Wednesday holiday) is ALREADY its own complete WorkSegment!
  const segments = collectSegmentsInRange(startDate, endDate)

  const maxBlock = prefs.maxDaysPerBlock ?? 20
  const minBlock = Math.max(1, prefs.minDaysPerBlock ?? 1)
  const allowSingle = prefs.allowSingleDayBridges ?? true
  const minEfficiency = prefs.minEfficiency && prefs.minEfficiency > 1 ? prefs.minEfficiency : null

  // Helper to evaluate and create a Candidate from a list of workdays.
  // When allowExcludedOverride is true (for mandatory must_have / exact_range rules),
  // Include always takes precedence over excluded ranges and avoidMonths.
  const createCandidate = (
    workDays: string[],
    matchedMustHaveIndex: number | null = null,
    customLabel?: string,
    extraFreeDates?: Set<string>,
    allowExcludedOverride = false,
  ): Candidate | null => {
    const newVacationDays = workDays.filter(d => !existingSet.has(d) && !baseNonWorkDays.has(d))
    if (newVacationDays.length === 0) return null

    const excludedOverlapCount = excludedDatesSet.size > 0
      ? newVacationDays.filter(d => excludedDatesSet.has(d)).length
      : 0

    // Enforce excluded dates / blackout periods unless explicitly overridden by a mandatory include rule
    if (!allowExcludedOverride && excludedOverlapCount > 0) {
      return null
    }

    // Enforce min/max block size and avoided months unless it's a mandatory rule
    if (matchedMustHaveIndex === null) {
      if (!allowSingle && newVacationDays.length === 1) return null
      if (newVacationDays.length < minBlock) return null
      if (prefs.maxDaysPerBlock !== null && newVacationDays.length > prefs.maxDaysPerBlock) return null
      if (avoidMonthsSet.size > 0 && newVacationDays.some(d => avoidMonthsSet.has(parseISO(d).getMonth() + 1))) {
        return null
      }
    } else if (!allowExcludedOverride && avoidMonthsSet.size > 0 && newVacationDays.some(d => avoidMonthsSet.has(parseISO(d).getMonth() + 1))) {
      return null
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
    const isTrueBridge =
      holidaysIncluded.length > 0 &&
      spanStart < newVacationDays[0] &&
      spanEnd > newVacationDays[newVacationDays.length - 1]
    const schoolOverlapCount = newVacationDays.filter(d => shDates.has(d)).length
    const schoolHolidayRatio = schoolOverlapCount / newVacationDays.length

    // Base score calculation
    let score = efficiency * 12

    // Strategy-specific weighting
    if (goal === 'max_efficiency') {
      score = Math.pow(efficiency, 1.8) * 10
      if (holidaysIncluded.length > 0) score *= 1.35
      if (isTrueBridge && newVacationDays.length <= 2) score *= 1.2
      // A single/2-day slice that does NOT include an effective holiday is just a normal weekend extension
      if (newVacationDays.length <= 2 && holidaysIncluded.length === 0) score *= 0.35
    } else if (goal === 'long_breaks') {
      score = efficiency * 8 + Math.min(freeDaysGained, 24) * 1.6
      if (freeDaysGained >= 9) score *= 1.45
      if (freeDaysGained >= 14) score *= 1.25
      if (newVacationDays.length === 1 && efficiency < 3.5) score *= 0.55
    } else if (goal === 'distributed') {
      score = efficiency * 10 + (freeDaysGained >= 4 && freeDaysGained <= 11 ? 8 : 0)
      if (holidaysIncluded.length > 0) score *= 1.2
    } else if (goal === 'mini_breaks') {
      score = efficiency * 11
      if (freeDaysGained >= 3 && freeDaysGained <= 5) score *= 1.45
      else if (newVacationDays.length > 5) score *= 0.45
      if (holidaysIncluded.length > 0) score *= 1.25
    } else {
      // 'balanced': reward strong true bridge days AND holiday combos
      if (holidaysIncluded.length > 0) score *= 1.3
      if (efficiency >= 2.2 && holidaysIncluded.length > 0) score *= 1.2
      if (isTrueBridge && newVacationDays.length <= 2) score *= 1.15
      if (newVacationDays.length <= 2 && holidaysIncluded.length === 0) score *= 0.42
    }

    // Only boost bridge days if they actually connect an effective workday holiday!
    if (prefs.preferBridgeDays && holidaysIncluded.length > 0 && efficiency >= 2.0) {
      score *= newVacationDays.length <= 2 ? 1.35 : 1.2
    }

    // Soft preferred months boost
    if (preferredMonthsSet.size > 0 && newVacationDays.some(d => preferredMonthsSet.has(parseISO(d).getMonth() + 1))) {
      score *= 1.3
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

    const avgHeatmapDensity =
      heatmapDensityByDate && heatmapDensityByDate.size > 0
        ? newVacationDays.reduce((acc, d) => acc + (heatmapDensityByDate.get(d) ?? 0), 0) / newVacationDays.length
        : undefined

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

    // Partner alignment (differentiating real planned vacation & partner holidays from regular off-weekdays)
    let isPartnerOffDayWeekend = false
    if (partnerCtx) {
      const bookedMatches = newVacationDays.filter(d => partnerCtx.bookedDates.has(d)).length
      const holidayMatches = newVacationDays.filter(
        d => !partnerCtx.bookedDates.has(d) && partnerCtx.holidayDates.has(d),
      ).length
      const offWeekdayMatches = newVacationDays.filter(
        d =>
          !partnerCtx.bookedDates.has(d) &&
          !partnerCtx.holidayDates.has(d) &&
          partnerCtx.offWeekdayDates.has(d),
      ).length

      const bookedRatio = bookedMatches / newVacationDays.length
      const holidayRatio = holidayMatches / newVacationDays.length
      const offWeekdayRatio = offWeekdayMatches / newVacationDays.length

      if (bookedRatio > 0) {
        score *= 1 + 1.35 * pStrength * bookedRatio + (bookedRatio === 1 ? 0.3 * pStrength : 0)
      }
      if (holidayRatio > 0) {
        score *= 1 + 0.65 * pStrength * holidayRatio
      }
      if (offWeekdayRatio > 0 && offWeekdayMode !== 'ignore') {
        if (offWeekdayMode === 'bonus_only') {
          // Only gently reward longer vacations that happen to cross partner's regular off-day;
          // never inflate isolated 1-2 day Fridays into spam.
          if (newVacationDays.length >= 3) {
            score *= 1 + 0.18 * pStrength * offWeekdayRatio
          }
        } else if (offWeekdayMode === 'allow_few_weekends') {
          score *= 1 + (newVacationDays.length <= 2 && holidaysIncluded.length === 0 ? 0.35 : 0.22) * pStrength * offWeekdayRatio
        }
      }

      isPartnerOffDayWeekend =
        newVacationDays.length <= 2 &&
        holidaysIncluded.length === 0 &&
        bookedMatches === 0 &&
        holidayMatches === 0 &&
        offWeekdayMatches > 0
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
      isPartnerOffDayWeekend,
      excludedOverlapCount,
      avgHeatmapDensity,
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

    // 2a. In mini_breaks mode, explicitly generate 1- and 2-day edge slices for long weekends
    if (goal === 'mini_breaks' && seg.workDays.length >= 3) {
      addCandidate(createCandidate(seg.workDays.slice(0, 1)))
      addCandidate(createCandidate(seg.workDays.slice(-1)))
      addCandidate(createCandidate(seg.workDays.slice(0, 2)))
      addCandidate(createCandidate(seg.workDays.slice(-2)))
    }

    // 2b. Partner alignment sub-slices: prioritize actual booked partner vacation & partner holidays,
    // and ONLY slice regular off-weekdays (e.g. 4-day-week Friday) when explicitly allowed.
    if (partnerCtx && seg.workDays.length > 1) {
      const sliceMatchesPartner = (d: string) =>
        partnerCtx.bookedDates.has(d) ||
        partnerCtx.holidayDates.has(d) ||
        (offWeekdayMode === 'allow_few_weekends' && partnerCtx.offWeekdayDates.has(d))

      let runStart = -1
      for (let k = 0; k <= seg.workDays.length; k++) {
        const isPartnerOff = k < seg.workDays.length && sliceMatchesPartner(seg.workDays[k])
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
  // Explicit Include rules ALWAYS take precedence over excludedDateRanges / avoidMonths.
  const selected: Candidate[] = []
  let budget = effectiveBudget
  const usedDates = new Set<string>()
  const maxBlocksLimit = prefs.maxBlocks && prefs.maxBlocks > 0 ? prefs.maxBlocks : null
  const fullYearSegments = collectSegmentsInRange(yearStart, yearEnd)

  const mustHaveRules = (prefs.periodPreferences ?? []).filter(
    p => p.type === 'exact_range' || p.type === 'must_have',
  )

  for (let rIdx = 0; rIdx < mustHaveRules.length; rIdx++) {
    const rule = mustHaveRules[rIdx]
    if (budget <= 0) break
    if (maxBlocksLimit !== null && selected.length >= maxBlocksLimit) break

    if (rule.type === 'exact_range' && rule.startDate && rule.endDate) {
      const rStartRaw = parseISO(rule.startDate)
      const rEndRaw = parseISO(rule.endDate)
      const rStart = rStartRaw < yearStart ? yearStart : rStartRaw
      const rEnd = rEndRaw > yearEnd ? yearEnd : rEndRaw
      if (rStart <= rEnd) {
        const rangeWorkDays = eachDayOfInterval({ start: rStart, end: rEnd })
          .map(d => format(d, 'yyyy-MM-dd'))
          .filter(d => !effectiveNonWorkDays.has(d) && !usedDates.has(d))

        if (rule.exactDays && rule.exactDays > 0 && rule.exactDays < rangeWorkDays.length) {
          let bestWindow: Candidate | null = null
          for (let startIdx = 0; startIdx <= rangeWorkDays.length - rule.exactDays; startIdx++) {
            const sub = rangeWorkDays.slice(startIdx, startIdx + rule.exactDays)
            const cand = createCandidate(sub, rIdx, rule.label || 'Pflicht-Zeitraum', undefined, true)
            if (!cand || cand.cost > budget) continue
            const bestOverlap = bestWindow?.excludedOverlapCount ?? Infinity
            const candOverlap = cand.excludedOverlapCount ?? 0
            if (
              !bestWindow ||
              candOverlap < bestOverlap ||
              (candOverlap === bestOverlap && cand.baseScore > bestWindow.baseScore)
            ) {
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
          const cand = createCandidate(rangeWorkDays, rIdx, rule.label || 'Fester Wunschzeitraum', undefined, true)
          if (cand && cand.cost <= budget) {
            selected.push(cand)
            budget -= cand.cost
            cand.vacationDays.forEach(d => usedDates.add(d))
            continue
          }
        }
      }
    }

    // Must-have month / duration rule: first search non-excluded candidates, then allow override if blocked
    const targetDays = rule.exactDays && rule.exactDays > 0 ? rule.exactDays : Math.max(1, rule.minDuration || 5)
    const buildMustHavePool = (sourceSegs: WorkSegment[], allowOverride: boolean): Candidate[] => {
      const poolMap = new Map<string, Candidate>()
      const addPool = (c: Candidate | null) => {
        if (!c) return
        const k = c.vacationDays.join(',')
        if (!poolMap.has(k) || c.baseScore > poolMap.get(k)!.baseScore) poolMap.set(k, c)
      }
      if (!allowOverride) {
        for (const c of candidateMap.values()) addPool(c)
      }
      for (let i = 0; i < sourceSegs.length; i++) {
        let pool: string[] = []
        for (let j = i; j < Math.min(i + 5, sourceSegs.length); j++) {
          pool = [...pool, ...sourceSegs[j].workDays]
          if (pool.length >= targetDays) {
            const slice = pool.slice(0, targetDays)
            if (rule.months.length === 0 || slice.some(d => rule.months.includes(parseISO(d).getMonth() + 1))) {
              addPool(createCandidate(slice, rIdx, rule.label, undefined, allowOverride))
            }
            break
          }
        }
      }
      return [...poolMap.values()]
    }

    const filterRuleCandidates = (list: Candidate[], strictEvery: boolean) =>
      list
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
        .sort((a, b) => {
          const ovDiff = (a.excludedOverlapCount ?? 0) - (b.excludedOverlapCount ?? 0)
          if (ovDiff !== 0) return ovDiff
          return b.baseScore - a.baseScore
        })

    const cleanPool = buildMustHavePool(segments, false)
    let matching = filterRuleCandidates(cleanPool, true)
    if (matching.length === 0) matching = filterRuleCandidates(cleanPool, false)

    if (matching.length === 0) {
      // Include > Exclude fallback: build candidates across full year ignoring exclusions/avoidMonths
      const overridePool = buildMustHavePool(fullYearSegments, true)
      matching = filterRuleCandidates(overridePool, true)
      if (matching.length === 0) matching = filterRuleCandidates(overridePool, false)
    }

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
  const coveredQuarters = new Set<number>(
    selected.map(s => Math.floor(getMonth(parseISO(s.vacationDays[Math.floor(s.vacationDays.length / 2)])) / 3)),
  )
  const selectedPartnerOffWeekendDates: string[] = []

  const minGap = prefs.distributeEvenly ? Math.max(7, prefs.minGapDaysBetweenBlocks ?? 14) : 0

  while (candidates.length > 0 && budget > 0) {
    if (maxBlocksLimit !== null && selected.length >= maxBlocksLimit) break

    candidates = candidates.filter(c => {
      if (c.cost > budget || c.vacationDays.some(d => usedDates.has(d))) return false
      if (c.isPartnerOffDayWeekend) {
        if (offWeekdayMode !== 'allow_few_weekends') return false
        if (selectedPartnerOffWeekendDates.length >= maxPartnerOffWeekends) return false
        const candDate = parseISO(c.vacationDays[0])
        if (selectedPartnerOffWeekendDates.some(prev => Math.abs(differenceInCalendarDays(candDate, parseISO(prev))) < 45)) {
          return false
        }
      }
      return true
    })
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
        c.vacationDays.length >= requiredMainDays &&
        (effectiveBudget >= 14 || goal === 'long_breaks' || Boolean(prefs.requireMainVacationDays))
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

      if (goal === 'distributed' || goal === 'mini_breaks') {
        const q = Math.floor(getMonth(parseISO(c.vacationDays[Math.floor(c.vacationDays.length / 2)])) / 3)
        if (!coveredQuarters.has(q)) {
          c.dynamicScore *= 1.22
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
      if (best.isPartnerOffDayWeekend) selectedPartnerOffWeekendDates.push(best.vacationDays[0])
      if (best.vacationDays.length >= requiredMainDays || best.freeDaysGained >= 14) hasLongVacation = true
      const mid = best.vacationDays[Math.floor(best.vacationDays.length / 2)]
      const midMonth = getMonth(parseISO(mid))
      if (midMonth >= 5 && midMonth <= 7) hasSummerVacation = true
      coveredQuarters.add(Math.floor(midMonth / 3))
    }
  }

  // Step 4: Smart Remainder Filler — if 0.5..3.5 vacation days remain in budget that couldn't fit
  // a full workweek segment, prefer extending an adjacent block (respecting maxDaysPerBlock),
  // matching a stranded Christmas half-day, or picking a real holiday bridge.
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
      remainderCandidates.sort((a, b) => {
        const scoreRemainder = (c: Candidate): number => {
          const touches = selected.find(s => !(c.spanEnd < s.spanStart || c.spanStart > s.spanEnd))
          let mult = 1
          if (touches) {
            if (prefs.maxDaysPerBlock === null || touches.vacationDays.length + c.vacationDays.length <= prefs.maxDaysPerBlock) {
              mult *= 2.5
            } else {
              mult *= 0.3
            }
          }
          if (Math.abs(budget - c.cost) < 0.01) {
            mult *= Math.abs((c.cost % 1) - 0.5) < 0.01 ? 2.2 : 1.5
          }
          if (c.efficiency >= 2.5 && c.holidaysIncluded.length > 0) mult *= 1.8
          if (c.isPartnerOffDayWeekend && offWeekdayMode !== 'allow_few_weekends') mult *= 0.25
          return c.baseScore * mult
        }
        return scoreRemainder(b) - scoreRemainder(a)
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
      partnerCtx && partnerCtx.allFreeDates.size > 0
        ? eachDayOfInterval({ start: parseISO(spanStart), end: parseISO(spanEnd) }).filter(d =>
            partnerCtx.allFreeDates.has(format(d, 'yyyy-MM-dd')),
          ).length
        : undefined

    const avgDensity =
      heatmapDensityByDate && heatmapDensityByDate.size > 0
        ? mergedVacDays.reduce((acc, d) => acc + (heatmapDensityByDate.get(d) ?? 0), 0) / mergedVacDays.length
        : undefined

    const highlights = buildBlockHighlights({
      isCustomPeriod: customLabels.length > 0,
      efficiency: cost > 0 ? freeDaysGained / cost : 0,
      holidaysIncluded,
      freeDaysGained,
      vacationDaysCount: mergedVacDays.length,
      goal,
      inSchoolHolidays,
      avgHeatmapDensity: avgDensity,
      partnerOverlapDays: partnerFreeOverlapDays,
    })

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
      ...(highlights.length > 0 ? { highlights } : {}),
      ...(partnerFreeOverlapDays && partnerFreeOverlapDays > 0 ? { partnerFreeOverlapDays } : {}),
    })

    idx = nextIdx
  }

  return finalBlocks
}

interface JointCandidate {
  spanDays: string[]
  myVacDays: string[]
  partnerVacDays: string[]
  myCost: number
  partnerCost: number
  spanStart: string
  spanEnd: string
  jointFreeDays: number
  efficiency: number
  baseScore: number
  dynamicScore: number
  holidaysIncluded: string[]
  schoolHolidayRatio: number
  label: string
  reason: string
  category: VacationSuggestionBlock['category']
  matchedMustHaveIndex: number | null
  isJointOffDayWeekend?: boolean
  excludedOverlapCount?: number
  avgHeatmapDensity?: number
}

function suggestJointVacation(
  year: number,
  publicHolidays: Holiday[],
  schoolHolidays: Holiday[],
  noteDates: Set<string>,
  remainingDays: number,
  existingVacationDates: Set<string>,
  prefs: PlanningPreferences,
  overwriteExisting: boolean,
  heatmapDensityByDate: Map<string, number> | undefined,
  partnerCtx: PartnerContext,
): VacationSuggestionBlock[] {
  const goal = resolveGoal(prefs)
  const schoolStrategy = resolveSchoolStrategy(prefs)
  const partnerOpts: Partial<PartnerPlanningOptions> = prefs.partnerOptions ?? { mode: 'plan_both' }
  const offWeekdayMode: PartnerOffWeekdayMode = partnerOpts.offWeekdayMode ?? 'bonus_only'
  const maxPartnerOffWeekends = Math.max(0, partnerOpts.maxLongWeekendsOnPartnerOffDay ?? 3)

  const myReserve = Math.max(0, prefs.reserveDaysToKeep ?? 0)
  const initialMyBudget = Math.max(0, remainingDays - myReserve)
  const rawPartnerBudget = partnerOpts.partnerBudget ?? partnerCtx.remainingDays ?? remainingDays
  const partnerReserve = Math.max(0, partnerOpts.partnerReserveDays ?? 0)
  const initialPartnerBudget = Math.max(0, rawPartnerBudget - partnerReserve)
  if (initialMyBudget <= 0 && initialPartnerBudget <= 0) return []

  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const today = new Date()

  let startDate = yearStart
  const mode: PlanStartMode = prefs.planStartMode ?? (prefs.planFromToday ? 'today' : 'year_start')
  if (mode === 'custom_date' && prefs.customStartDate && /^\d{4}-\d{2}-\d{2}$/.test(prefs.customStartDate)) {
    const parsed = parseISO(prefs.customStartDate)
    startDate = parsed < yearStart ? yearStart : parsed
  } else if (mode === 'after_last_vacation') {
    const sortedExisting = [...existingVacationDates].filter(d => d.startsWith(`${year}-`)).sort()
    if (sortedExisting.length > 0) startDate = addDaysDate(parseISO(sortedExisting[sortedExisting.length - 1]), 1)
    else if (today.getFullYear() === year) startDate = new Date(Math.max(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(), yearStart.getTime()))
  } else if (mode === 'today' && prefs.planFromToday !== false && today.getFullYear() === year) {
    startDate = new Date(Math.max(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(), yearStart.getTime()))
  }

  let endDate = yearEnd
  if (prefs.customEndDate && /^\d{4}-\d{2}-\d{2}$/.test(prefs.customEndDate)) {
    const parsedEnd = parseISO(prefs.customEndDate)
    if (parsedEnd <= yearEnd && parsedEnd >= startDate) endDate = parsedEnd
  }
  if (startDate > endDate) return []

  const viewerBaseNonWork = buildNonWorkSet(
    yearStart,
    yearEnd,
    publicHolidays,
    prefs.countWeekendsAsVacation,
    prefs.workDays,
  )
  const viewerExisting = overwriteExisting ? new Set<string>() : new Set(existingVacationDates)
  const viewerEffectiveNonWork = new Set([...viewerBaseNonWork, ...viewerExisting])

  const partnerPublicHolidays = partnerCtx.publicHolidays ?? publicHolidays
  const partnerBaseNonWork = buildNonWorkSet(
    yearStart,
    yearEnd,
    partnerPublicHolidays,
    partnerCtx.countWeekendsAsVacation ?? false,
    partnerCtx.workDays,
  )
  const partnerExisting = overwriteExisting ? new Set<string>() : new Set(partnerCtx.bookedDates)
  const partnerEffectiveNonWork = new Set([...partnerBaseNonWork, ...partnerExisting])
  const partnerHalfDays = partnerCtx.halfDaysChristmas ?? prefs.halfDaysChristmas

  const bothNaturallyFree = (key: string) =>
    viewerEffectiveNonWork.has(key) && partnerEffectiveNonWork.has(key)

  const bothNaturallyFreeSet = new Set<string>()
  for (const d of eachDayOfInterval({ start: addDaysDate(yearStart, -7), end: addDaysDate(yearEnd, 7) })) {
    const k = format(d, 'yyyy-MM-dd')
    if (bothNaturallyFree(k)) bothNaturallyFreeSet.add(k)
  }

  const holidayNameByDate = buildEffectiveHolidayNameByDate(
    publicHolidays,
    prefs.workDays,
    prefs.countWeekendsAsVacation,
    prefs.halfDaysChristmas,
    year,
  )
  const shDates = buildDateSet(schoolHolidays)
  const avoidMonthsSet = new Set(prefs.avoidMonths ?? [])
  const preferredMonthsSet = new Set(prefs.preferredMonths ?? [])
  for (const p of prefs.periodPreferences ?? []) {
    if ((p.type as string) === 'avoid_months') {
      for (const m of p.months) avoidMonthsSet.add(m)
    }
  }

  const excludedDatesSet = new Set<string>()
  for (const ex of prefs.excludedDateRanges ?? []) {
    if (ex.startDate && ex.endDate && ex.startDate <= ex.endDate) {
      for (const d of eachDayOfInterval({ start: parseISO(ex.startDate), end: parseISO(ex.endDate) })) {
        excludedDatesSet.add(format(d, 'yyyy-MM-dd'))
      }
    }
  }

  const collectJointSegments = (rStart: Date, rEnd: Date): WorkSegment[] => {
    const segs: WorkSegment[] = []
    let cur = new Date(rStart)
    while (cur <= rEnd) {
      const k = format(cur, 'yyyy-MM-dd')
      if (bothNaturallyFree(k)) {
        cur = addDaysDate(cur, 1)
        continue
      }
      const spanDays: string[] = []
      const segStart = new Date(cur)
      let temp = new Date(cur)
      while (temp <= rEnd && !bothNaturallyFree(format(temp, 'yyyy-MM-dd'))) {
        spanDays.push(format(temp, 'yyyy-MM-dd'))
        temp = addDaysDate(temp, 1)
      }
      segs.push({ workDays: spanDays, start: segStart, end: addDaysDate(temp, -1) })
      cur = temp
    }
    return segs
  }

  const segments = collectJointSegments(startDate, endDate)
  const fullYearSegments = collectJointSegments(yearStart, yearEnd)
  const maxBlock = prefs.maxDaysPerBlock ?? 20
  const minBlock = Math.max(1, prefs.minDaysPerBlock ?? 1)
  const allowSingle = prefs.allowSingleDayBridges ?? true
  const minEfficiency = prefs.minEfficiency && prefs.minEfficiency > 1 ? prefs.minEfficiency : null
  const partnerLabel = partnerCtx.label || 'Partner'

  const createJointCandidate = (
    spanDays: string[],
    matchedMustHaveIndex: number | null = null,
    customLabel?: string,
    extraJointDates?: Set<string>,
    allowExcludedOverride = false,
  ): JointCandidate | null => {
    if (spanDays.length === 0) return null
    const myVacDays = spanDays.filter(d => !viewerEffectiveNonWork.has(d))
    const partnerVacDays = spanDays.filter(d => !partnerEffectiveNonWork.has(d))
    if (myVacDays.length === 0 && partnerVacDays.length === 0) return null

    const involvedDays = [...new Set([...myVacDays, ...partnerVacDays])].sort()
    const excludedOverlapCount = excludedDatesSet.size > 0
      ? involvedDays.filter(d => excludedDatesSet.has(d)).length
      : 0
    if (!allowExcludedOverride && excludedOverlapCount > 0) return null

    const maxVacLen = Math.max(myVacDays.length, partnerVacDays.length)
    if (matchedMustHaveIndex === null) {
      if (!allowSingle && maxVacLen <= 1 && spanDays.length === 1) return null
      if (maxVacLen < minBlock) return null
      if (prefs.maxDaysPerBlock !== null && maxVacLen > prefs.maxDaysPerBlock) return null
      if (avoidMonthsSet.size > 0 && involvedDays.some(d => avoidMonthsSet.has(parseISO(d).getMonth() + 1))) {
        return null
      }
    } else if (!allowExcludedOverride && avoidMonthsSet.size > 0 && involvedDays.some(d => avoidMonthsSet.has(parseISO(d).getMonth() + 1))) {
      return null
    }

    const myCost = myVacDays.reduce((s, d) => s + getDayCost(d, prefs.halfDaysChristmas), 0)
    const partnerCost = partnerVacDays.reduce((s, d) => s + getDayCost(d, partnerHalfDays), 0)
    if (myCost > initialMyBudget || partnerCost > initialPartnerBudget) return null
    if (myCost <= 0 && partnerCost <= 0) return null

    const freeSet = extraJointDates
      ? new Set([...bothNaturallyFreeSet, ...extraJointDates, ...spanDays])
      : new Set([...bothNaturallyFreeSet, ...spanDays])

    const { spanStart, spanEnd, freeDaysGained: jointFreeDays } = expandFreeSpan(
      spanDays[0],
      spanDays[spanDays.length - 1],
      freeSet,
      yearStart,
      yearEnd,
    )

    const avgCost = Math.max(0.5, (myCost + partnerCost) / 2)
    const efficiency = jointFreeDays / avgCost
    if (matchedMustHaveIndex === null && minEfficiency !== null && efficiency < minEfficiency) return null

    const holidaysIncluded = collectHolidaysInSpan(spanStart, spanEnd, holidayNameByDate)
    const schoolOverlapCount = involvedDays.filter(d => shDates.has(d)).length
    const schoolHolidayRatio = involvedDays.length > 0 ? schoolOverlapCount / involvedDays.length : 0

    let score = efficiency * 12
    if (goal === 'max_efficiency') {
      score = Math.pow(efficiency, 1.75) * 10
      if (holidaysIncluded.length > 0) score *= 1.35
      if (maxVacLen <= 2 && holidaysIncluded.length === 0) score *= 0.35
    } else if (goal === 'long_breaks') {
      score = efficiency * 8 + Math.min(jointFreeDays, 24) * 1.6
      if (jointFreeDays >= 9) score *= 1.45
      if (jointFreeDays >= 14) score *= 1.25
    } else if (goal === 'distributed') {
      score = efficiency * 10 + (jointFreeDays >= 4 && jointFreeDays <= 11 ? 8 : 0)
      if (holidaysIncluded.length > 0) score *= 1.2
    } else if (goal === 'mini_breaks') {
      score = efficiency * 11
      if (jointFreeDays >= 3 && jointFreeDays <= 5) score *= 1.45
      else if (maxVacLen > 5) score *= 0.45
      if (holidaysIncluded.length > 0) score *= 1.25
    } else {
      if (holidaysIncluded.length > 0) score *= 1.3
      if (efficiency >= 2.2 && holidaysIncluded.length > 0) score *= 1.2
      if (maxVacLen <= 2 && holidaysIncluded.length === 0) score *= 0.42
    }

    if (prefs.preferBridgeDays && holidaysIncluded.length > 0 && efficiency >= 2.0) {
      score *= maxVacLen <= 2 ? 1.35 : 1.2
    }

    if (preferredMonthsSet.size > 0 && involvedDays.some(d => preferredMonthsSet.has(parseISO(d).getMonth() + 1))) {
      score *= 1.3
    }

    if (schoolStrategy === 'prefer') {
      if (schoolHolidayRatio >= 0.8) score *= 1.85
      else if (schoolHolidayRatio > 0) score *= 1.35
      else score *= 0.65
    } else if (schoolStrategy === 'avoid') {
      if (schoolHolidayRatio > 0) score *= Math.max(0.15, 1 - schoolHolidayRatio * 0.8)
      else score *= 1.25
    } else if (schoolStrategy === 'avoid_heatmap') {
      if (heatmapDensityByDate && heatmapDensityByDate.size > 0 && involvedDays.length > 0) {
        const avgDensity = involvedDays.reduce((acc, d) => acc + (heatmapDensityByDate.get(d) ?? 0), 0) / involvedDays.length
        score *= Math.max(0.2, 1.3 - avgDensity * 1.1)
      } else if (schoolHolidayRatio > 0) {
        score *= 0.35
      }
    }

    const avgHeatmapDensity =
      heatmapDensityByDate && heatmapDensityByDate.size > 0 && involvedDays.length > 0
        ? involvedDays.reduce((acc, d) => acc + (heatmapDensityByDate.get(d) ?? 0), 0) / involvedDays.length
        : undefined

    if (noteDates.size > 0 && prefs.noteHandling !== 'ignore' && involvedDays.some(d => noteDates.has(d))) {
      score *= prefs.noteHandling === 'prefer' ? 1.5 : 0.18
    }

    // Bonus when one partner gets a free day on the other's workday during a holiday combo,
    // while preventing regular off-weekdays (4-day week Fridays) from spamming short non-holiday weekends.
    const isJointOffDayWeekend =
      maxVacLen <= 2 &&
      holidaysIncluded.length === 0 &&
      (myVacDays.length === 0 || partnerVacDays.length === 0)

    if (isJointOffDayWeekend && offWeekdayMode !== 'allow_few_weekends') {
      score *= 0.25
    }

    const labelSourceDays = myVacDays.length > 0 ? myVacDays : partnerVacDays
    const baseMeta = buildSmartLabelAndReason(
      labelSourceDays,
      spanStart,
      spanEnd,
      jointFreeDays,
      myCost,
      holidaysIncluded,
      schoolHolidayRatio >= 0.5,
      customLabel,
    )

    return {
      spanDays,
      myVacDays,
      partnerVacDays,
      myCost,
      partnerCost,
      spanStart,
      spanEnd,
      jointFreeDays,
      efficiency,
      baseScore: score,
      dynamicScore: score,
      holidaysIncluded,
      schoolHolidayRatio,
      label: baseMeta.label,
      reason: `Gemeinsam ${jointFreeDays} Tage frei (Du: ${myCost} UT · ${partnerLabel}: ${partnerCost} UT)`,
      category: baseMeta.category,
      matchedMustHaveIndex,
      isJointOffDayWeekend,
      excludedOverlapCount,
      avgHeatmapDensity,
    }
  }

  const candidateMap = new Map<string, JointCandidate>()
  const addCandidate = (c: JointCandidate | null) => {
    if (!c) return
    const key = c.spanDays.join(',')
    const ex = candidateMap.get(key)
    if (!ex || c.baseScore > ex.baseScore || c.matchedMustHaveIndex !== null) {
      candidateMap.set(key, c)
    }
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    addCandidate(createJointCandidate(seg.workDays))
    if (prefs.maxDaysPerBlock !== null && prefs.maxDaysPerBlock < seg.workDays.length) {
      addCandidate(createJointCandidate(seg.workDays.slice(0, prefs.maxDaysPerBlock)))
      addCandidate(createJointCandidate(seg.workDays.slice(-prefs.maxDaysPerBlock)))
    }
    if (goal === 'mini_breaks' && seg.workDays.length >= 3) {
      addCandidate(createJointCandidate(seg.workDays.slice(0, 1)))
      addCandidate(createJointCandidate(seg.workDays.slice(-1)))
      addCandidate(createJointCandidate(seg.workDays.slice(0, 2)))
      addCandidate(createJointCandidate(seg.workDays.slice(-2)))
    }
    let combined = [...seg.workDays]
    for (let j = i + 1; j < Math.min(i + 5, segments.length); j++) {
      const gapDays = differenceInCalendarDays(segments[j].start, segments[j - 1].end) - 1
      if (gapDays > 6) break
      combined = [...combined, ...segments[j].workDays]
      if (combined.length > maxBlock) break
      addCandidate(createJointCandidate(combined))
    }
  }

  const selected: JointCandidate[] = []
  let myBudget = initialMyBudget
  let partnerBudget = initialPartnerBudget
  const myUsedDates = new Set<string>()
  const partnerUsedDates = new Set<string>()
  const maxBlocksLimit = prefs.maxBlocks && prefs.maxBlocks > 0 ? prefs.maxBlocks : null
  const mustHaveRules = (prefs.periodPreferences ?? []).filter(
    p => p.type === 'exact_range' || p.type === 'must_have',
  )

  for (let rIdx = 0; rIdx < mustHaveRules.length; rIdx++) {
    const rule = mustHaveRules[rIdx]
    if (myBudget <= 0 && partnerBudget <= 0) break
    if (maxBlocksLimit !== null && selected.length >= maxBlocksLimit) break

    if (rule.type === 'exact_range' && rule.startDate && rule.endDate) {
      const rStartRaw = parseISO(rule.startDate)
      const rEndRaw = parseISO(rule.endDate)
      const rStart = rStartRaw < yearStart ? yearStart : rStartRaw
      const rEnd = rEndRaw > yearEnd ? yearEnd : rEndRaw
      if (rStart <= rEnd) {
        const rangeDays = eachDayOfInterval({ start: rStart, end: rEnd })
          .map(d => format(d, 'yyyy-MM-dd'))
          .filter(d => !bothNaturallyFree(d) && !myUsedDates.has(d) && !partnerUsedDates.has(d))
        if (rangeDays.length > 0) {
          const cand = createJointCandidate(rangeDays, rIdx, rule.label || 'Gemeinsamer Pflicht-Zeitraum', undefined, true)
          if (cand && cand.myCost <= myBudget && cand.partnerCost <= partnerBudget) {
            selected.push(cand)
            myBudget -= cand.myCost
            partnerBudget -= cand.partnerCost
            cand.myVacDays.forEach(d => myUsedDates.add(d))
            cand.partnerVacDays.forEach(d => partnerUsedDates.add(d))
            continue
          }
        }
      }
    }

    const targetDays = rule.exactDays && rule.exactDays > 0 ? rule.exactDays : Math.max(1, rule.minDuration || 5)
    const buildJointRulePool = (segs: WorkSegment[], allowOverride: boolean) => {
      const list: JointCandidate[] = []
      if (!allowOverride) list.push(...candidateMap.values())
      for (let i = 0; i < segs.length; i++) {
        let pool: string[] = []
        for (let j = i; j < Math.min(i + 5, segs.length); j++) {
          pool = [...pool, ...segs[j].workDays]
          if (pool.length >= targetDays) {
            const slice = pool.slice(0, targetDays)
            if (rule.months.length === 0 || slice.some(d => rule.months.includes(parseISO(d).getMonth() + 1))) {
              const c = createJointCandidate(slice, rIdx, rule.label, undefined, allowOverride)
              if (c) list.push(c)
            }
            break
          }
        }
      }
      return list
    }

    const filterJointRule = (list: JointCandidate[], strictEvery: boolean) =>
      list
        .filter(c => {
          if (c.myCost > myBudget || c.partnerCost > partnerBudget) return false
          if (c.myVacDays.some(d => myUsedDates.has(d)) || c.partnerVacDays.some(d => partnerUsedDates.has(d))) return false
          const allDays = c.spanDays
          const monthsOk =
            rule.months.length === 0 ||
            (strictEvery
              ? allDays.every(d => rule.months.includes(parseISO(d).getMonth() + 1))
              : allDays.some(d => rule.months.includes(parseISO(d).getMonth() + 1)))
          if (!monthsOk) return false
          if (rule.startDate && c.spanDays[0] < rule.startDate) return false
          if (rule.endDate && c.spanDays[c.spanDays.length - 1] > rule.endDate) return false
          const dur = Math.max(c.myVacDays.length, c.partnerVacDays.length)
          return rule.exactDays && rule.exactDays > 0 ? dur === rule.exactDays : dur >= (rule.minDuration || 1)
        })
        .sort((a, b) => ((a.excludedOverlapCount ?? 0) - (b.excludedOverlapCount ?? 0)) || (b.baseScore - a.baseScore))

    const cleanList = buildJointRulePool(segments, false)
    let matching = filterJointRule(cleanList, true)
    if (matching.length === 0) matching = filterJointRule(cleanList, false)
    if (matching.length === 0) {
      const overrideList = buildJointRulePool(fullYearSegments, true)
      matching = filterJointRule(overrideList, true)
      if (matching.length === 0) matching = filterJointRule(overrideList, false)
    }

    if (matching[0]) {
      const pick = { ...matching[0], category: 'custom_period' as const }
      selected.push(pick)
      myBudget -= pick.myCost
      partnerBudget -= pick.partnerCost
      pick.myVacDays.forEach(d => myUsedDates.add(d))
      pick.partnerVacDays.forEach(d => partnerUsedDates.add(d))
    }
  }

  let candidates = [...candidateMap.values()].filter(
    c => !c.myVacDays.some(d => myUsedDates.has(d)) && !c.partnerVacDays.some(d => partnerUsedDates.has(d)),
  )
  const requiredMainDays = prefs.requireMainVacationDays && prefs.requireMainVacationDays > 0 ? prefs.requireMainVacationDays : 8
  let hasLongVacation = selected.some(s => s.jointFreeDays >= 14 || s.myVacDays.length >= requiredMainDays)
  const coveredQuarters = new Set<number>(
    selected.map(s => Math.floor(getMonth(parseISO(s.spanDays[Math.floor(s.spanDays.length / 2)])) / 3)),
  )
  const selectedOffDayWeekends: string[] = []
  const minGap = prefs.distributeEvenly ? Math.max(7, prefs.minGapDaysBetweenBlocks ?? 14) : 0

  while (candidates.length > 0 && (myBudget > 0 || partnerBudget > 0)) {
    if (maxBlocksLimit !== null && selected.length >= maxBlocksLimit) break

    candidates = candidates.filter(c => {
      if (c.myCost > myBudget || c.partnerCost > partnerBudget) return false
      if (c.myVacDays.some(d => myUsedDates.has(d)) || c.partnerVacDays.some(d => partnerUsedDates.has(d))) return false
      if (c.isJointOffDayWeekend) {
        if (offWeekdayMode !== 'allow_few_weekends') return false
        if (selectedOffDayWeekends.length >= maxPartnerOffWeekends) return false
        const cd = parseISO(c.spanDays[0])
        if (selectedOffDayWeekends.some(prev => Math.abs(differenceInCalendarDays(cd, parseISO(prev))) < 45)) return false
      }
      return true
    })
    if (candidates.length === 0) break

    for (const c of candidates) {
      c.dynamicScore = c.baseScore

      if (
        (goal === 'balanced' || goal === 'long_breaks' || Boolean(prefs.requireMainVacationDays)) &&
        !hasLongVacation &&
        (prefs.maxDaysPerBlock === null || prefs.maxDaysPerBlock >= requiredMainDays) &&
        c.myVacDays.length >= requiredMainDays &&
        (initialMyBudget >= 14 || goal === 'long_breaks' || Boolean(prefs.requireMainVacationDays))
      ) {
        c.dynamicScore *= prefs.requireMainVacationDays ? 2.2 : 1.55
      }

      if (goal === 'distributed' || goal === 'mini_breaks') {
        const q = Math.floor(getMonth(parseISO(c.spanDays[Math.floor(c.spanDays.length / 2)])) / 3)
        if (!coveredQuarters.has(q)) c.dynamicScore *= 1.22
      }

      if (prefs.distributeEvenly && selected.length > 0) {
        const cStart = parseISO(c.spanStart)
        const cEnd = parseISO(c.spanEnd)
        let minDistance = Infinity
        for (const s of selected) {
          const sStart = parseISO(s.spanStart)
          const sEnd = parseISO(s.spanEnd)
          const dist = cEnd < sStart ? differenceInCalendarDays(sStart, cEnd) : sEnd < cStart ? differenceInCalendarDays(cStart, sEnd) : 0
          if (dist < minDistance) minDistance = dist
        }
        if (minDistance < minGap) c.dynamicScore *= 0.18
        else if (minDistance < 35) c.dynamicScore *= 0.5
        else if (minDistance < 60) c.dynamicScore *= 0.8
      }
    }

    candidates.sort((a, b) => b.dynamicScore - a.dynamicScore)
    const best = candidates.shift()!
    if (best.myCost <= myBudget && best.partnerCost <= partnerBudget) {
      selected.push(best)
      myBudget -= best.myCost
      partnerBudget -= best.partnerCost
      best.myVacDays.forEach(d => myUsedDates.add(d))
      best.partnerVacDays.forEach(d => partnerUsedDates.add(d))
      if (best.isJointOffDayWeekend) selectedOffDayWeekends.push(best.spanDays[0])
      if (best.jointFreeDays >= 14 || best.myVacDays.length >= requiredMainDays) hasLongVacation = true
      coveredQuarters.add(Math.floor(getMonth(parseISO(best.spanDays[Math.floor(best.spanDays.length / 2)])) / 3))
    }
  }

  // Merge touching joint blocks cleanly
  const sortedJoint = [...selected].sort((a, b) => a.spanDays[0].localeCompare(b.spanDays[0]))
  const allJointPlanned = new Set([...bothNaturallyFreeSet, ...sortedJoint.flatMap(s => s.spanDays)])
  const finalBlocks: VacationSuggestionBlock[] = []

  let idx = 0
  while (idx < sortedJoint.length) {
    let mergedMy = [...sortedJoint[idx].myVacDays]
    let mergedPartner = [...sortedJoint[idx].partnerVacDays]
    let mergedSpanDays = [...sortedJoint[idx].spanDays]
    const customLabels = sortedJoint[idx].matchedMustHaveIndex !== null ? [sortedJoint[idx].label] : []
    let nextIdx = idx + 1

    while (nextIdx < sortedJoint.length) {
      const prevLast = parseISO(mergedSpanDays[mergedSpanDays.length - 1])
      const nextFirst = parseISO(sortedJoint[nextIdx].spanDays[0])
      let curCheck = addDaysDate(prevLast, 1)
      let allFreeBetween = true
      while (curCheck < nextFirst) {
        if (!allJointPlanned.has(format(curCheck, 'yyyy-MM-dd'))) {
          allFreeBetween = false
          break
        }
        curCheck = addDaysDate(curCheck, 1)
      }
      if (!allFreeBetween) break
      mergedMy = [...new Set([...mergedMy, ...sortedJoint[nextIdx].myVacDays])]
      mergedPartner = [...new Set([...mergedPartner, ...sortedJoint[nextIdx].partnerVacDays])]
      mergedSpanDays = [...new Set([...mergedSpanDays, ...sortedJoint[nextIdx].spanDays])]
      if (sortedJoint[nextIdx].matchedMustHaveIndex !== null) customLabels.push(sortedJoint[nextIdx].label)
      nextIdx++
    }

    mergedMy.sort()
    mergedPartner.sort()
    mergedSpanDays.sort()

    const { spanStart, spanEnd, freeDaysGained: jointFreeDays } = expandFreeSpan(
      mergedSpanDays[0],
      mergedSpanDays[mergedSpanDays.length - 1],
      allJointPlanned,
      yearStart,
      yearEnd,
    )
    const myCost = mergedMy.reduce((s, d) => s + getDayCost(d, prefs.halfDaysChristmas), 0)
    const partnerCost = mergedPartner.reduce((s, d) => s + getDayCost(d, partnerHalfDays), 0)
    const holidaysIncluded = collectHolidaysInSpan(spanStart, spanEnd, holidayNameByDate)
    const involved = [...new Set([...mergedMy, ...mergedPartner])]
    const schoolOverlap = involved.filter(d => shDates.has(d)).length
    const inSchoolHolidays = involved.length > 0 && schoolOverlap / involved.length >= 0.5
    const meta = buildSmartLabelAndReason(
      mergedMy.length > 0 ? mergedMy : mergedPartner,
      spanStart,
      spanEnd,
      jointFreeDays,
      myCost,
      holidaysIncluded,
      inSchoolHolidays,
      customLabels[0],
    )
    const avgCost = Math.max(0.5, (myCost + partnerCost) / 2)
    const efficiency = jointFreeDays / avgCost
    const avgDensity =
      heatmapDensityByDate && heatmapDensityByDate.size > 0 && involved.length > 0
        ? involved.reduce((acc, d) => acc + (heatmapDensityByDate.get(d) ?? 0), 0) / involved.length
        : undefined
    const highlights = buildBlockHighlights({
      isCustomPeriod: customLabels.length > 0,
      efficiency,
      holidaysIncluded,
      freeDaysGained: jointFreeDays,
      vacationDaysCount: Math.max(mergedMy.length, mergedPartner.length),
      goal,
      inSchoolHolidays,
      avgHeatmapDensity: avgDensity,
      partnerOverlapDays: jointFreeDays,
    })

    finalBlocks.push({
      id: `joint-${finalBlocks.length}-${mergedSpanDays[0]}`,
      vacationDays: mergedMy,
      partnerVacationDays: mergedPartner,
      startDate: spanStart,
      endDate: spanEnd,
      freeDaysGained: jointFreeDays,
      jointFreeDays,
      partnerFreeOverlapDays: jointFreeDays,
      cost: myCost,
      partnerCost,
      efficiency,
      label: meta.label,
      reason: `Gemeinsam ${jointFreeDays} Tage frei (Du: ${myCost} UT · ${partnerLabel}: ${partnerCost} UT)`,
      category: meta.category,
      holidaysIncluded,
      inSchoolHolidays,
      ...(highlights.length > 0 ? { highlights } : {}),
    })

    idx = nextIdx
  }

  // Optional solo remainder pass when viewer has remaining days after partner's budget is exhausted
  if (
    partnerOpts.fillSoloAfterJoint &&
    myBudget >= 1 &&
    (maxBlocksLimit === null || finalBlocks.length < maxBlocksLimit)
  ) {
    const soloExisting = new Set([...viewerExisting, ...myUsedDates])
    const soloBlocks = suggestVacation(
      year,
      publicHolidays,
      schoolHolidays,
      noteDates,
      myBudget + myReserve,
      soloExisting,
      {
        ...prefs,
        partnerOptions: { mode: 'off' },
        periodPreferences: (prefs.periodPreferences ?? []).filter(p => p.type === 'nice_to_have'),
        maxBlocks: maxBlocksLimit !== null ? Math.max(0, maxBlocksLimit - finalBlocks.length) : null,
      },
      false,
      heatmapDensityByDate,
      undefined,
    )
    for (const sb of soloBlocks) {
      finalBlocks.push({
        ...sb,
        id: `solo-${finalBlocks.length}-${sb.startDate}`,
        partnerVacationDays: [],
        partnerCost: 0,
        jointFreeDays: 0,
        reason: `Solo-Ergänzung (${partnerLabel}s Budget verplant): ${sb.reason}`,
      })
    }
    finalBlocks.sort((a, b) => a.startDate.localeCompare(b.startDate))
  }

  return finalBlocks
}
