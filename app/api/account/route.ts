import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createRecoveryKey, hashPassword, hashRecoveryKey, normalizeUsername, validPassword, verifyPassword } from '@/lib/password'
import { allowAttempt } from '@/lib/rate-limit'
import { jsonError, readJson, validOrigin } from '@/lib/request'

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)
  if (!await allowAttempt(`account:${session.user.id}`, 8)) return jsonError('Bitte später erneut versuchen.', 429)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  const body = await readJson(request)
  const username = normalizeUsername(body?.username)
  if (!username || !validPassword(body?.password)) return jsonError('Benutzername oder Passwort ungültig.')
  if (user.passwordHash && (typeof body?.currentPassword !== 'string' || !await verifyPassword(body.currentPassword, user.passwordHash))) return jsonError('Aktuelles Passwort ist nicht korrekt.', 403)
  const recoveryKey = createRecoveryKey()
  try {
    const changed = await prisma.user.updateMany({ where: { id: user.id, passwordHash: user.passwordHash, sessionVersion: user.sessionVersion }, data: {
      username, passwordHash: await hashPassword(body.password), recoveryHash: hashRecoveryKey(recoveryKey), sessionVersion: { increment: 1 },
    } })
    if (changed.count !== 1) return jsonError('Konto wurde inzwischen geändert. Bitte neu anmelden.', 409)
    return NextResponse.json({ recoveryKey }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return jsonError('Dieser Benutzername ist nicht verfügbar.', 409)
    return jsonError('Änderung konnte nicht gespeichert werden.', 503)
  }
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)
  if (!await allowAttempt(`account:${session.user.id}`, 8)) return jsonError('Bitte später erneut versuchen.', 429)
  const body = await readJson(request)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  if (!user.passwordHash || typeof body?.password !== 'string' || !await verifyPassword(body.password, user.passwordHash)) return jsonError('Passwort ist nicht korrekt.', 403)
  if (body.confirmation !== 'DELETE') return jsonError('Löschung muss bestätigt werden.')
  const deleted = await prisma.user.deleteMany({ where: { id: user.id, passwordHash: user.passwordHash, sessionVersion: user.sessionVersion } })
  if (deleted.count !== 1) return jsonError('Konto wurde inzwischen geändert. Bitte neu anmelden.', 409)
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
