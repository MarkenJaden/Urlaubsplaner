import { NextResponse } from 'next/server'
import { fetchHolidays, validateRegion } from '@/lib/holiday-api'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const country = params.get('country') ?? 'DE'
  const subdivision = params.get('subdivision') || null
  const group = params.get('group') || null
  const yearParam = params.get('year') ?? String(new Date().getFullYear())
  const year = Number(yearParam)
  const type = params.get('type') ?? 'public'
  if (!/^\d{4}$/.test(yearParam) || year < 1900 || year > 2200 || (type !== 'school' && type !== 'public')) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  try {
    const invalid = await validateRegion({ country, subdivision, group })
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    return NextResponse.json(await fetchHolidays(country, subdivision, year, type, group))
  } catch {
    return NextResponse.json({ error: 'Ferien oder Feiertage konnten nicht geladen werden. Bitte erneut versuchen.' }, { status: 502 })
  }
}
