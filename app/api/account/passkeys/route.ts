import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { jsonError, readJson, validOrigin } from '@/lib/request'
import { allowAttempt, requestBucket } from '@/lib/rate-limit'
import { normalizeOptionalEmail, normalizeUsername } from '@/lib/password'
import {
  createSignedChallenge,
  resolveRpId,
  signPasskeyLoginToken,
  verifyPasskeyAssertion,
  verifyPasskeyRegistration,
  verifySignedChallenge,
} from '@/lib/totp-webauthn'

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const body = await readJson(request)
  const action = typeof body?.action === 'string' ? body.action : ''
  const rpId = resolveRpId(request)

  // 1. Public WebAuthn Authentication Options (for Login page)
  if (action === 'auth_options') {
    if (!(await allowAttempt(`passkey-opt:${requestBucket(request)}`, 40))) {
      return jsonError('Zu viele Versuche.', 429)
    }
    const identifier = typeof body?.username === 'string' ? body.username.trim() : ''
    let allowCredentials: Array<{ id: string; transports?: string[] }> = []

    if (identifier) {
      const isEmail = identifier.includes('@')
      const email = isEmail ? normalizeOptionalEmail(identifier) : null
      const username = !isEmail ? normalizeUsername(identifier) : null
      const user = email
        ? await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            include: { passkeys: true },
          })
        : username
          ? await prisma.user.findUnique({
              where: { username },
              include: { passkeys: true },
            })
          : null

      if (user?.passkeys?.length) {
        allowCredentials = user.passkeys.map(pk => ({
          id: pk.credentialId,
          ...(pk.transports ? { transports: pk.transports.split(',').filter(Boolean) } : {}),
        }))
      }
    }

    const { challenge, token } = createSignedChallenge({ type: 'auth', rpId })
    return NextResponse.json({
      challenge,
      token,
      rpId,
      allowCredentials,
    })
  }

  // 2. Public WebAuthn Assertion Verification (for Login page)
  if (action === 'auth_verify') {
    if (!(await allowAttempt(`passkey-verify:${requestBucket(request)}`, 25))) {
      return jsonError('Zu viele Anmeldeversuche.', 429)
    }
    const token = typeof body?.token === 'string' ? body.token : ''
    const credentialId = typeof body?.credentialId === 'string' ? body.credentialId : ''
    const clientDataJSON = typeof body?.clientDataJSON === 'string' ? body.clientDataJSON : ''
    const authenticatorData = typeof body?.authenticatorData === 'string' ? body.authenticatorData : ''
    const signature = typeof body?.signature === 'string' ? body.signature : ''

    const challengeData = verifySignedChallenge(token)
    if (!challengeData || challengeData.type !== 'auth' || challengeData.rpId !== rpId) {
      return jsonError('Passkey-Sitzung abgelaufen. Bitte erneut versuchen.')
    }

    const stored = await prisma.passkeyCredential.findUnique({
      where: { credentialId },
    })
    if (!stored) {
      return jsonError('Dieser Passkey ist keinem Konto zugeordnet.', 401)
    }

    const result = verifyPasskeyAssertion({
      clientDataJSON,
      authenticatorData,
      signature,
      publicKeySpki: stored.publicKey,
      expectedChallenge: challengeData.challenge,
      expectedRpId: rpId,
      previousCounter: stored.counter,
    })

    if (!result.valid) {
      return jsonError('Passkey-Signatur konnte nicht verifiziert werden.', 401)
    }

    await prisma.passkeyCredential.update({
      where: { id: stored.id },
      data: {
        counter: Math.max(stored.counter, result.newCounter),
        lastUsedAt: new Date(),
      },
    })

    const passkeyLoginToken = signPasskeyLoginToken(stored.userId)
    return NextResponse.json({ passkeyLoginToken })
  }

  // Authenticated actions below (Registering a new Passkey)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Nicht angemeldet.', 401)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { passkeys: true },
  })
  if (!user) return jsonError('Konto nicht gefunden.', 404)

  if (action === 'register_options') {
    const { challenge, token } = createSignedChallenge({
      type: 'register',
      rpId,
      userId: user.id,
    })
    const displayName = user.username || user.email || user.name || 'Urlaubsplaner-Nutzer'
    return NextResponse.json({
      challenge,
      token,
      rpId,
      rpName: 'Urlaubsplaner',
      user: {
        id: Buffer.from(user.id, 'utf8').toString('base64url'),
        name: displayName,
        displayName,
      },
      excludeCredentials: user.passkeys.map(pk => ({
        id: pk.credentialId,
      })),
    })
  }

  if (action === 'register_verify') {
    if (user.passkeys.length >= 15) {
      return jsonError('Maximal 15 Passkeys pro Konto möglich.')
    }
    const token = typeof body?.token === 'string' ? body.token : ''
    const credentialId = typeof body?.credentialId === 'string' ? body.credentialId : ''
    const publicKeySpki = typeof body?.publicKeySpki === 'string' ? body.publicKeySpki : ''
    const clientDataJSON = typeof body?.clientDataJSON === 'string' ? body.clientDataJSON : ''
    const authenticatorData = typeof body?.authenticatorData === 'string' ? body.authenticatorData : ''
    const algorithm = typeof body?.algorithm === 'number' ? body.algorithm : -7
    const nameInput = typeof body?.name === 'string' ? body.name.trim().slice(0, 60) : ''
    const transports = Array.isArray(body?.transports)
      ? body.transports.filter((t: unknown) => typeof t === 'string').join(',')
      : undefined

    if (!credentialId || credentialId.length > 512 || !publicKeySpki) {
      return jsonError('Ungültige Passkey-Daten.')
    }

    const challengeData = verifySignedChallenge(token)
    if (
      !challengeData ||
      challengeData.type !== 'register' ||
      challengeData.userId !== user.id ||
      challengeData.rpId !== rpId
    ) {
      return jsonError('Passkey-Registrierung abgelaufen. Bitte erneut versuchen.')
    }

    const verified = verifyPasskeyRegistration({
      clientDataJSON,
      authenticatorData,
      publicKeySpki,
      algorithm,
      expectedChallenge: challengeData.challenge,
      expectedRpId: rpId,
    })

    if (!verified.valid) {
      return jsonError('Passkey konnte nicht verifiziert werden.')
    }

    const existing = await prisma.passkeyCredential.findUnique({ where: { credentialId } })
    if (existing) {
      return jsonError('Dieser Passkey ist bereits registriert.')
    }

    const created = await prisma.passkeyCredential.create({
      data: {
        userId: user.id,
        credentialId,
        publicKey: publicKeySpki,
        algorithm,
        counter: verified.counter,
        transports: transports || null,
        name: nameInput || `Passkey ${user.passkeys.length + 1}`,
      },
    })

    return NextResponse.json({
      passkey: {
        id: created.id,
        name: created.name,
        createdAt: created.createdAt.toISOString(),
        lastUsedAt: null,
      },
    })
  }

  return jsonError('Unbekannte Aktion.')
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Nicht angemeldet.', 401)
  const body = await readJson(request)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return jsonError('Passkey-ID fehlt.')

  await prisma.passkeyCredential.deleteMany({
    where: { id, userId: session.user.id },
  })
  return NextResponse.json({ ok: true })
}
