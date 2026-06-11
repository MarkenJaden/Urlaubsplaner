import { NextResponse } from 'next/server'

// Lightweight liveness probe. Avoids touching DB, Keycloak or any session
// machinery so it returns 200 as early as possible and stays reliable even
// when external dependencies are slow or down.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET() {
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  )
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
