import { NextResponse } from 'next/server'
import { suggestVacation, DEFAULT_PREFERENCES } from '@/lib/vacation-suggester'
import type { PlanningPreferences } from '@/lib/vacation-suggester'
import type { Holiday } from '@/types'

const OPENHOLIDAYS_BASE = 'https://openholidaysapi.org'

async function fetchHolidays(country: string, subdivision: string | null, year: number, school: boolean): Promise<Holiday[]> {
  const params = new URLSearchParams({
    countryIsoCode: country,
    validFrom: `${year}-01-01`,
    validTo: `${year}-12-31`,
    languageIsoCode: 'DE',
  })
  if (subdivision) params.set('subdivisionCode', subdivision)
  const endpoint = school ? 'SchoolHolidays' : 'PublicHolidays'
  const res = await fetch(`${OPENHOLIDAYS_BASE}/${endpoint}?${params}`, { next: { revalidate: 86400 } })
  if (!res.ok) return []
  return res.json()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const country = searchParams.get('country') ?? 'DE'
  const subdivision = searchParams.get('subdivision')
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const remainingDays = parseFloat(searchParams.get('remainingDays') ?? '30')
  const overwriteExisting = searchParams.get('overwrite') === 'true'

  let prefs: PlanningPreferences = { ...DEFAULT_PREFERENCES }
  const prefsParam = searchParams.get('preferences')
  if (prefsParam) {
    try { prefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(prefsParam) } } catch {}
  }

  const existingParam = searchParams.get('existingDates')
  const existingVacationDates = new Set<string>(existingParam ? existingParam.split(',') : [])

  const noteParam = searchParams.get('noteDates')
  const noteDates = new Set<string>(noteParam ? noteParam.split(',') : [])

  const [publicHolidays, schoolHolidays] = await Promise.all([
    fetchHolidays(country, subdivision, year, false),
    (prefs.preferSchoolHolidays || prefs.avoidSchoolHolidays)
      ? fetchHolidays(country, subdivision, year, true)
      : Promise.resolve([] as Holiday[]),
  ])

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
