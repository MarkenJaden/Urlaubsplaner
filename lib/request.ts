import { NextResponse } from 'next/server'

export function validOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    const url = new URL(origin)
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim()
    const host = request.headers.get('host') ?? new URL(request.url).host
    const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim())
    return (url.protocol === 'https:' || url.protocol === 'http:') &&
      (url.host === host || (forwardedHost !== undefined && url.host === forwardedHost && allowed.includes(url.host)))
  } catch { return false }
}

export async function readJson(request: Request, maxLength = 100_000): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return null
  const text = await request.text()
  if (text.length > maxLength) return null
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch { return null }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}
