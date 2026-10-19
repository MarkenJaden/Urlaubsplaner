import { NextResponse } from 'next/server'
import { suggestVacation, DEFAULT_PREFERENCES } from '@/lib/vacation-suggester'
import type { PlanningPreferences } from '@/lib/vacation-suggester'
import { fetchHolidays, validateRegion } from '@/lib/holiday-api'
import type { Holiday } from '@/types'

const DATE_LIST = /^(?:\d{4}-\d{2}-\d{2}(?:,\d{4}-\d{2}-\d{2})*)?$/

function parsePlanningPreferences(value: string | null): PlanningPreferences | null {
  if (!value) return { ...DEFAULT_PREFERENCES }
  try {
    const input = JSON.parse(value)
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null
    const prefs = { ...DEFAULT_PREFERENCES, ...input } as PlanningPreferences
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
  if (!/^\d{4}$/.test(yearParam) || year < 1900 || year > 2200 || !Number.isFinite(remainingDays) || remainingDays < 0 || remainingDays > 366 || !prefs || !DATE_LIST.test(existingParam) || !DATE_LIST.test(noteParam)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  const existingVacationDates = new Set<string>(existingParam ? existingParam.split(',') : [])
  const noteDates = new Set<string>(noteParam ? noteParam.split(',') : [])

  let publicHolidays: Holiday[], schoolHolidays: Holiday[]
  try {
    const invalid = await validateRegion({ country, subdivision, group })
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    // Suggestions without holidays would propose days that are already free.
    ;[publicHolidays, schoolHolidays] = await Promise.all([
      fetchHolidays(country, subdivision, year, 'public'),
      (prefs.preferSchoolHolidays || prefs.avoidSchoolHolidays) ? fetchHolidays(country, subdivision, year, 'school', group) : Promise.resolve([] as Holiday[]),
    ])
  } catch {
    return NextResponse.json({ error: 'Ferien oder Feiertage konnten nicht geladen werden.' }, { status: 502 })
  }

  const suggestions = suggestVacation(
    year,
    publicHolidays,
    schoolHolidays,
    noteDates,
    remainingDays,
    existingVacationDates,
    prefs,
    overwriteExisting,
  )

  return NextResponse.json(suggestions)
}
