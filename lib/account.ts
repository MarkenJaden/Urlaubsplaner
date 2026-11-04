import { randomUUID, randomBytes } from 'node:crypto'
import { prisma } from './prisma'
import { createRecoveryKey, hashPassword, hashRecoveryKey, normalizeOptionalEmail, normalizeUsername, validPassword, verifyPassword } from './password'
import { allowAttempt } from './rate-limit'

export async function authenticate(identifierInput: unknown, passwordInput: unknown) {
  if (typeof identifierInput !== 'string' || typeof passwordInput !== 'string' || passwordInput.length > 128) return null
  const trimmed = identifierInput.trim()
  const isEmail = trimmed.includes('@')

  const email = isEmail ? normalizeOptionalEmail(trimmed) : null
  const username = !isEmail ? normalizeUsername(trimmed) : null
  const key = email ?? username
  if (!key) return null

  if (!await allowAttempt(`login:${key}`, 8)) return null

  const user = email
    ? await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
    : await prisma.user.findUnique({ where: { username: username! } })

  // Spend the same password work for unknown users to reduce enumeration.
  const fallback = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`
  const valid = await verifyPassword(passwordInput, user?.passwordHash ?? fallback)
  if (!user || !valid) return null

  const now = new Date()
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: now },
  }).catch(() => undefined)
  user.lastActiveAt = now
  return user
}

export async function registerAccount(usernameInput: unknown, password: unknown, nameInput: unknown, emailInput?: unknown) {
  const username = normalizeUsername(usernameInput)
  const email = normalizeOptionalEmail(emailInput)
  if (!username || !validPassword(password) || email === undefined) throw new Error('INVALID_INPUT')

  if (email) {
    const existingEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })
    if (existingEmail) {
      throw new Error('EMAIL_TAKEN')
    }
  }

  const recoveryKey = createRecoveryKey()
  const isOwner = username === 'markenjaden'
  const user = await prisma.user.create({
    data: {
      username,
      email,
      isAdmin: isOwner,
      lastActiveAt: new Date(),
      calendarToken: randomBytes(32).toString('base64url'),
      keycloakId: `local:${randomUUID()}`,
      passwordHash: await hashPassword(password),
      recoveryHash: hashRecoveryKey(recoveryKey),
      name: typeof nameInput === 'string' ? nameInput.trim().slice(0, 80) || username : username,
    },
  })
  return { user, recoveryKey }
}
