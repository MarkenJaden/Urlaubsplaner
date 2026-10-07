import { NextResponse } from 'next/server'
import { fetchHolidays } from '@/lib/holiday-api'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const country = params.get('country') ?? 'DE'
  const subdivision = params.get('subdivision')
  const year = Number(params.get('year') ?? new Date().getFullYear())
  const type = params.get('type') ?? 'public'
  if (!/^[A-Z]{2}$/.test(country) || !Number.isInteger(year) || year < 1900 || year > 2200 || !['school', 'public'].includes(type) || (subdivision && (!subdivision.startsWith(`${country}-`) || subdivision.length > 40))) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  try { return NextResponse.json(await fetchHolidays(country, subdivision, year, type as 'public' | 'school')) }
  catch { return NextResponse.json({ error: 'Ferien oder Feiertage konnten nicht geladen werden. Bitte erneut versuchen.' }, { status: 502 }) }
}
