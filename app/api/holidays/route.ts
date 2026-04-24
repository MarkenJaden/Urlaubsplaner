import { NextResponse } from 'next/server'

const OPENHOLIDAYS_BASE = 'https://openholidaysapi.org'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const country = searchParams.get('country') ?? 'DE'
  const subdivision = searchParams.get('subdivision')
  const year = searchParams.get('year') ?? new Date().getFullYear().toString()
  const type = searchParams.get('type') ?? 'public'

  const validFrom = `${year}-01-01`
  const validTo = `${year}-12-31`

  const endpoint = type === 'school' ? 'SchoolHolidays' : 'PublicHolidays'

  const params = new URLSearchParams({
    countryIsoCode: country,
    validFrom,
    validTo,
    languageIsoCode: 'DE',
  })

  if (subdivision) params.set('subdivisionCode', subdivision)

  const url = `${OPENHOLIDAYS_BASE}/${endpoint}?${params}`

  const response = await fetch(url, {
    next: { revalidate: 86400 }
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'OpenHolidays API error' }, { status: 502 })
  }

  const data = await response.json()
  return NextResponse.json(data)
}
