import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { jsonError, readJson, validOrigin } from '@/lib/request'
import { allowAttempt, requestBucket } from '@/lib/rate-limit'
import {
  normalizeOptionalEmail,
  normalizeUsername,
  verifyPassword,
} from '@/lib/password'
import {
  buildOtpAuthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotpCode,
} from '@/lib/totp-webauthn'

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const body = await readJson(request)
  const action = typeof body?.action === 'string' ? body.action : ''

  // Login precheck: checks if credentials require a 2FA code step before calling NextAuth signIn
  if (action === 'precheck') {
    if (
      !(await allowAttempt('totp-precheck-global', 200, 900)) ||
      !(await allowAttempt(`totp-precheck-ip:${requestBucket(request)}`, 25))
    ) {
      return jsonError('Zu viele Versuche. Bitte später erneut versuchen.', 429)
    }
    const identifier = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!identifier || !password || password.length > 128) {
      return NextResponse.json({ requiresTotp: false })
    }
    const isEmail = identifier.includes('@')
    const email = isEmail ? normalizeOptionalEmail(identifier) : null
    const username = !isEmail ? normalizeUsername(identifier) : null
    const key = email ?? username
    if (!key) return NextResponse.json({ requiresTotp: false })

    const user = email
      ? await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
      : await prisma.user.findUnique({ where: { username: username! } })

    const fallback = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`
    const valid = await verifyPassword(password, user?.passwordHash ?? fallback)
    if (!user || !valid) {
      return NextResponse.json({ requiresTotp: false })
    }
    return NextResponse.json({ requiresTotp: Boolean(user.totpEnabled && user.totpSecretEncrypted) })
  }

  const session = await auth()
  if (!session?.user?.id) return jsonError('Nicht angemeldet.', 401)
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return jsonError('Konto nicht gefunden.', 404)

  if (action === 'setup') {
    const secret = generateTotpSecret()
    const encrypted = encryptTotpSecret(secret)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecretEncrypted: encrypted,
        totpEnabled: false,
      },
    })
    const accountLabel = user.username || user.email || user.name || 'Nutzer'
    const otpauthUri = buildOtpAuthUri(accountLabel, secret, 'Urlaubsplaner')
    return NextResponse.json({ secret, otpauthUri })
  }

  if (action === 'enable') {
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!user.totpSecretEncrypted) {
      return jsonError('Bitte starte zuerst die 2FA-Einrichtung.')
    }
    const plainSecret = decryptTotpSecret(user.totpSecretEncrypted)
    if (!plainSecret || !verifyTotpCode(plainSecret, code)) {
      return jsonError('Der eingegebene 6-stellige Code ist ungültig. Prüfe die Uhrzeit deines Geräts.')
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
    })
    return NextResponse.json({ totpEnabled: true })
  }

  if (action === 'disable') {
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    let authorized = false
    if (code && user.totpSecretEncrypted) {
      const plainSecret = decryptTotpSecret(user.totpSecretEncrypted)
      if (plainSecret && verifyTotpCode(plainSecret, code)) authorized = true
    }
    if (!authorized && password && user.passwordHash) {
      if (await verifyPassword(password, user.passwordHash)) authorized = true
    }
    if (!authorized && !user.passwordHash && !user.totpSecretEncrypted) {
      authorized = true
    }

    if (!authorized) {
      return jsonError('Bitte bestätige das Deaktivieren mit deinem aktuellen 2FA-Code oder Passwort.')
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: false,
        totpSecretEncrypted: null,
      },
    })
    return NextResponse.json({ totpEnabled: false })
  }

  return jsonError('Unbekannte Aktion.')
}
