import { NextResponse } from 'next/server'
import { fetchGroups } from '@/lib/holiday-api'
import { isCountryCode } from '@/lib/holiday-regions'

export async function GET(request: Request) {
  const country = new URL(request.url).searchParams.get('country') ?? 'DE'
  if (!isCountryCode(country)) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  try { return NextResponse.json(await fetchGroups(country)) }
  catch { return NextResponse.json({ error: 'Ferienregionen konnten nicht geladen werden.' }, { status: 502 }) }
}
