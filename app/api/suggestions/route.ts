import { NextResponse } from 'next/server'
import { suggestVacation, buildNonWorkSet, DEFAULT_PREFERENCES, type PartnerContext } from '@/lib/vacation-suggester'
import type { PlanningPreferences } from '@/lib/vacation-suggester'
import { fetchHolidays, fetchSubdivisions, validateRegion } from '@/lib/holiday-api'
import { isCountryCode, isRegionCode } from '@/lib/holiday-regions'
import { countHolidayStates } from '@/lib/holidays'
import { DEFAULT_WORK_DAYS, isOffDayKey } from '@/lib/vacation-accounting'
import { eachDayOfInterval, format, parseISO } from 'date-fns'
import type { Holiday } from '@/types'

const DATE_LIST = /^(?:\d{4}-\d{2}-\d{2}(?:,\d{4}-\d{2}-\d{2})*)?$/
const WORKDAYS_LIST = /^(?:[0-6](?:,[0-6])*)?$/
const VALID_GOALS = new Set(['balanced', 'max_efficiency', 'long_breaks', 'distributed', 'mini_breaks'])

function parsePlanningPreferences(value: string | null): PlanningPreferences | null {
  if (!value) return { ...DEFAULT_PREFERENCES }
  try {
    const input = JSON.parse(value)
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null
    const prefs = { ...DEFAULT_PREFERENCES, ...input } as PlanningPreferences
    if (prefs.goal && !VALID_GOALS.has(prefs.goal)) prefs.goal = 'balanced'
    const blockSize = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 60
    if (!blockSize(prefs.minDaysPerBlock) || (prefs.maxDaysPerBlock !== null && !blockSize(prefs.maxDaysPerBlock)) || !Array.isArray(prefs.periodPreferences)) return null
    return prefs
  } catch { return null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const country = searchParams.get('country') ?? 'DE'
  const subdivision = searchParams.get('subdivision') || null
  const group = searchParams.get('group') || null
  const yearParam = searchParams.get('year') ?? String(new Date().getFullYear())
  const year = Number(yearParam)
  const remainingDays = Number(searchParams.get('remainingDays') ?? '30')
  const overwriteExisting = searchParams.get('overwrite') === 'true'
  const prefs = parsePlanningPreferences(searchParams.get('preferences'))
  const existingParam = searchParams.get('existingDates') ?? ''
  const noteParam = searchParams.get('noteDates') ?? ''
  const rawPartnerMode = searchParams.get('partnerMode')
  const alignWithPartner = searchParams.get('alignWithPartner') === 'true'
  const partnerMode =
    rawPartnerMode === 'plan_both' || rawPartnerMode === 'align_to_partner' || rawPartnerMode === 'off'
      ? rawPartnerMode
      : prefs?.partnerOptions?.mode ?? (alignWithPartner ? 'align_to_partner' : 'off')
  const partnerDatesParam = searchParams.get('partnerDates') ?? ''
  const partnerWorkDaysParam = searchParams.get('partnerWorkDays') ?? ''
  const rawPartnerCountry = searchParams.get('partnerCountry')?.toUpperCase()
  const partnerCountry = isCountryCode(rawPartnerCountry) ? rawPartnerCountry : undefined
  const rawPartnerSub = searchParams.get('partnerSubdivision')?.toUpperCase()
  const partnerSubdivision = isRegionCode(rawPartnerSub, partnerCountry) ? rawPartnerSub : null
  const rawPartnerRemaining = searchParams.get('partnerRemainingDays')
  const partnerRemainingDays =
    rawPartnerRemaining !== null && Number.isFinite(Number(rawPartnerRemaining))
      ? Math.max(0, Math.min(366, Number(rawPartnerRemaining)))
      : undefined
  const partnerHalfDaysChristmas = searchParams.get('partnerHalfDaysChristmas') !== 'false'
  const partnerLabel = searchParams.get('partnerLabel')?.slice(0, 60) || undefined

  if (
    !/^\d{4}$/.test(yearParam) ||
    year < 1900 ||
    year > 2200 ||
    !Number.isFinite(remainingDays) ||
    remainingDays < 0 ||
    remainingDays > 366 ||
    !prefs ||
    !DATE_LIST.test(existingParam) ||
    !DATE_LIST.test(noteParam) ||
    !DATE_LIST.test(partnerDatesParam) ||
    !WORKDAYS_LIST.test(partnerWorkDaysParam)
  ) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  const existingVacationDates = new Set<string>(existingParam ? existingParam.split(',') : [])
  const noteDates = new Set<string>(noteParam ? noteParam.split(',') : [])

  const needSchool =
    prefs.preferSchoolHolidays ||
    prefs.avoidSchoolHolidays ||
    prefs.schoolStrategy === 'prefer' ||
    prefs.schoolStrategy === 'avoid' ||
    prefs.schoolStrategy === 'avoid_heatmap'
  const needAllStatesHeatmap =
    prefs.avoidAllStatesSchoolHolidays || prefs.schoolStrategy === 'avoid_heatmap'

  let publicHolidays: Holiday[], schoolHolidays: Holiday[]
  let heatmapDensityByDate: Map<string, number> | undefined
  let partnerContext: PartnerContext | undefined

  try {
    const invalid = await validateRegion({ country, subdivision, group })
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    // Suggestions without holidays would propose days that are already free.
    ;[publicHolidays, schoolHolidays] = await Promise.all([
      fetchHolidays(country, subdivision, year, 'public'),
      needSchool ? fetchHolidays(country, subdivision, year, 'school', group) : Promise.resolve([] as Holiday[]),
    ])

    if (partnerMode !== 'off') {
      const partnerWorkDays = partnerWorkDaysParam
        ? partnerWorkDaysParam.split(',').map(Number)
        : DEFAULT_WORK_DAYS
      let partnerPublicHolidays = publicHolidays
      if (partnerCountry && (partnerCountry !== country || (partnerSubdivision ?? null) !== subdivision)) {
        partnerPublicHolidays = await fetchHolidays(partnerCountry, partnerSubdivision, year, 'public').catch(
          () => publicHolidays,
        )
      }
      const bookedDates = new Set<string>(partnerDatesParam ? partnerDatesParam.split(',') : [])
      const holidayDates = new Set<string>()
      for (const h of partnerPublicHolidays) {
        const start = parseISO(h.startDate)
        const end = parseISO(h.endDate)
        if (start > end) continue
        for (const d of eachDayOfInterval({ start, end })) {
          const k = format(d, 'yyyy-MM-dd')
          if (!isOffDayKey(k, prefs.workDays)) holidayDates.add(k)
        }
      }
      const offWeekdayDates = new Set<string>()
      for (const d of eachDayOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) })) {
        const k = format(d, 'yyyy-MM-dd')
        if (
          !bookedDates.has(k) &&
          !holidayDates.has(k) &&
          isOffDayKey(k, partnerWorkDays) &&
          !isOffDayKey(k, prefs.workDays)
        ) {
          offWeekdayDates.add(k)
        }
      }
      const allFreeDates = buildNonWorkSet(
        new Date(year, 0, 1),
        new Date(year, 11, 31),
        partnerPublicHolidays,
        false,
        partnerWorkDays,
      )
      for (const d of bookedDates) allFreeDates.add(d)

      partnerContext = {
        bookedDates,
        holidayDates,
        offWeekdayDates,
        allFreeDates,
        workDays: partnerWorkDays,
        publicHolidays: partnerPublicHolidays,
        halfDaysChristmas: partnerHalfDaysChristmas,
        remainingDays: partnerRemainingDays,
        label: partnerLabel,
      }
    }

    if (needAllStatesHeatmap) {
      const subs = await fetchSubdivisions(country)
      if (subs.length > 0) {
        const allSchool = await Promise.all(
          subs.slice(0, 16).map(s => fetchHolidays(country, s.code, year, 'school').catch(() => [] as Holiday[])),
        )
        const counts = countHolidayStates(allSchool)
        const max = Math.max(allSchool.length, 1)
        heatmapDensityByDate = new Map()
        counts.forEach((v, k) => heatmapDensityByDate!.set(k, v / max))
      }
    }
  } catch {
    return NextResponse.json({ error: 'Ferien oder Feiertage konnten nicht geladen werden.' }, { status: 502 })
  }

  const effectivePrefs: PlanningPreferences = {
    ...prefs,
    partnerOptions: {
      ...(prefs.partnerOptions ?? {}),
      mode: partnerMode,
    },
  }

  const suggestions = suggestVacation(
    year,
    publicHolidays,
    schoolHolidays,
    noteDates,
    remainingDays,
    existingVacationDates,
    effectivePrefs,
    overwriteExisting,
    heatmapDensityByDate,
    partnerContext,
  )

  return NextResponse.json(suggestions)
}
