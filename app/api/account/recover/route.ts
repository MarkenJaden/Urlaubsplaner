import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createRecoveryKey, hashPassword, hashRecoveryKey, normalizeOptionalEmail, normalizeUsername, validPassword } from '@/lib/password'
import { isSmtpReady, sendPasswordResetEmail } from '@/lib/mail'
import { allowAttempt, requestBucket } from '@/lib/rate-limit'
import { jsonError, readJson, validOrigin } from '@/lib/request'

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const body = await readJson(request)
  if (!body) return jsonError('Ungültige Anfrage.', 400)

  // 1. Request password reset via email (SMTP)
  if (body.action === 'request_email_reset') {
    if (!await allowAttempt(`reset-req-ip:${requestBucket(request)}`, 8, 900)) {
      return jsonError('Bitte später erneut versuchen.', 429)
    }
    if (!await isSmtpReady()) {
      return jsonError('E-Mail-Versand ist auf diesem Server noch nicht eingerichtet. Bitte nutze deinen Wiederherstellungsschlüssel.', 503)
    }

    const rawId = typeof body.identifier === 'string' ? body.identifier.trim() : ''
    const isEmail = rawId.includes('@')
    const email = isEmail ? normalizeOptionalEmail(rawId) : null
    const username = !isEmail ? normalizeUsername(rawId) : null
    const lookupKey = email ?? username

    if (!lookupKey) {
      return jsonError('Bitte gib eine gültige E-Mail-Adresse oder deinen Benutzernamen ein.', 400)
    }

    if (!await allowAttempt(`reset-req:${lookupKey}`, 4, 900)) {
      return jsonError('Bitte später erneut versuchen.', 429)
    }

    const user = email
      ? await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
      : await prisma.user.findUnique({ where: { username: username! } })

    if (user?.email) {
      const rawToken = createRecoveryKey()
      const resetTokenHash = hashRecoveryKey(rawToken)
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000)

      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash, resetTokenExpiresAt },
      })

      const origin = new URL(request.url).origin
      const resetUrl = `${origin}/recover?token=${encodeURIComponent(rawToken)}`
      try {
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name || user.username,
          resetUrl,
        })
      } catch {
        return jsonError('E-Mail konnte nicht gesendet werden. Bitte prüfe die SMTP-Einstellungen oder nutze deinen Wiederherstellungsschlüssel.', 503)
      }
    }

    return NextResponse.json(
      {
        sent: true,
        message: 'Falls zu deiner Eingabe ein Konto mit hinterlegter E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen gesendet.',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // 2. Confirm password reset with emailed token
  if (body.action === 'confirm_email_reset') {
    if (!await allowAttempt(`reset-confirm-ip:${requestBucket(request)}`, 10, 900)) {
      return jsonError('Bitte später erneut versuchen.', 429)
    }
    const resetTokenHash = hashRecoveryKey(body.token)
    if (!resetTokenHash || !validPassword(body.password)) {
      return jsonError('Reset-Link oder neues Passwort (mind. 6 Zeichen) ist ungültig.', 400)
    }

    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash,
        resetTokenExpiresAt: { gt: new Date() },
      },
    })

    if (!user) {
      return jsonError('Dieser Link zum Zurücksetzen ist abgelaufen oder ungültig. Bitte fordere einen neuen Link an.', 400)
    }

    const recoveryKey = createRecoveryKey()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(body.password),
        recoveryHash: hashRecoveryKey(recoveryKey),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        sessionVersion: { increment: 1 },
      },
    })

    return NextResponse.json(
      {
        recoveryKey,
        loginIdentifier: user.username || user.email || '',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // 3. Recovery via local recovery key (supports username or email)
  const rawIdentifier = typeof body.username === 'string' ? body.username.trim() : ''
  const isEmail = rawIdentifier.includes('@')
  const email = isEmail ? normalizeOptionalEmail(rawIdentifier) : null
  const username = !isEmail ? normalizeUsername(rawIdentifier) : null
  const key = email ?? username
  const recoveryHash = hashRecoveryKey(body.recoveryKey)

  if (!key || !recoveryHash || !validPassword(body.password)) {
    return jsonError('Benutzername/E-Mail, Wiederherstellungsschlüssel oder Passwort ungültig.')
  }
  if (!await allowAttempt(`recover:${key}`, 5) || !await allowAttempt(`recover-ip:${requestBucket(request)}`, 10)) {
    return jsonError('Bitte später erneut versuchen.', 429)
  }

  const recoveryKey = createRecoveryKey()
  const result = await prisma.user.updateMany({
    where: email
      ? { email: { equals: email, mode: 'insensitive' }, recoveryHash }
      : { username: username!, recoveryHash },
    data: {
      passwordHash: await hashPassword(body.password),
      recoveryHash: hashRecoveryKey(recoveryKey),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      sessionVersion: { increment: 1 },
    },
  })

  if (result.count !== 1) return jsonError('Konto konnte mit diesen Angaben nicht wiederhergestellt werden.', 400)
  return NextResponse.json({ recoveryKey }, { headers: { 'Cache-Control': 'no-store' } })
}
