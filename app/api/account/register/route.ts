import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { registerAccount } from '@/lib/account'
import { allowAttempt, requestBucket } from '@/lib/rate-limit'
import { jsonError, readJson, validOrigin } from '@/lib/request'

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  if (!await allowAttempt('register-global', 100, 3600) || !await allowAttempt(`register:${requestBucket(request)}`, 10, 3600)) return jsonError('Bitte später erneut versuchen.', 429)
  const body = await readJson(request)
  if (!body) return jsonError('Ungültige Eingabe.')
  try {
    const { recoveryKey } = await registerAccount(body.username, body.password, body.name)
    return NextResponse.json({ recoveryKey }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return jsonError('Dieser Benutzername ist nicht verfügbar.', 409)
    if (error instanceof Error && error.message === 'INVALID_INPUT') return jsonError('Benutzername: 3–32 Zeichen (a–z, 0–9, Punkt, Bindestrich, Unterstrich). Passwort: 12–128 Zeichen.')
    return jsonError('Konto konnte nicht erstellt werden. Bitte erneut versuchen.', 503)
  }
}
