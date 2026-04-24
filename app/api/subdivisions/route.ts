import { NextResponse } from 'next/server'

const OPENHOLIDAYS_BASE = 'https://openholidaysapi.org'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const country = searchParams.get('country') ?? 'DE'

  const response = await fetch(
    `${OPENHOLIDAYS_BASE}/Subdivisions?countryIsoCode=${country}&languageIsoCode=DE`,
    { next: { revalidate: 86400 } }
  )

  if (!response.ok) {
    return NextResponse.json({ error: 'OpenHolidays API error' }, { status: 502 })
  }

  const data = await response.json()
  return NextResponse.json(data)
}
