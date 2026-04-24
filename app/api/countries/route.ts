import { NextResponse } from 'next/server'

const OPENHOLIDAYS_BASE = 'https://openholidaysapi.org'

export async function GET() {
  try {
    const response = await fetch(
      `${OPENHOLIDAYS_BASE}/Countries?languageIsoCode=DE`,
      { next: { revalidate: 86400 } }
    )

    if (!response.ok) {
      return NextResponse.json({ error: 'OpenHolidays API error' }, { status: 502 })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'OpenHolidays API unreachable' }, { status: 503 })
  }
}
