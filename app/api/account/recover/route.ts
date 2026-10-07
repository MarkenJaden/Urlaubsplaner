import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createRecoveryKey, hashPassword, hashRecoveryKey, normalizeUsername, validPassword } from '@/lib/password'
import { allowAttempt, requestBucket } from '@/lib/rate-limit'
import { jsonError, readJson, validOrigin } from '@/lib/request'

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const body = await readJson(request)
  const username = normalizeUsername(body?.username)
  const recoveryHash = hashRecoveryKey(body?.recoveryKey)
  if (!username || !recoveryHash || !validPassword(body?.password)) return jsonError('Benutzername, Wiederherstellungsschlüssel oder Passwort ungültig.')
  if (!await allowAttempt(`recover:${username}`, 5) || !await allowAttempt(`recover-ip:${requestBucket(request)}`, 10)) return jsonError('Bitte später erneut versuchen.', 429)
  const recoveryKey = createRecoveryKey()
  const result = await prisma.user.updateMany({
    where: { username, recoveryHash },
    data: { passwordHash: await hashPassword(body.password), recoveryHash: hashRecoveryKey(recoveryKey), sessionVersion: { increment: 1 } },
  })
  if (result.count !== 1) return jsonError('Konto konnte mit diesen Angaben nicht wiederhergestellt werden.', 400)
  return NextResponse.json({ recoveryKey }, { headers: { 'Cache-Control': 'no-store' } })
}
