import { NextResponse } from 'next/server'
import { fetchCountries } from '@/lib/holiday-api'

export async function GET() {
  try { return NextResponse.json(await fetchCountries()) }
  catch { return NextResponse.json({ error: 'Länder konnten nicht geladen werden.' }, { status: 502 }) }
}
