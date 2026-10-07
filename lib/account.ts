import { randomUUID, randomBytes } from 'node:crypto'
import { prisma } from './prisma'
import { createRecoveryKey, hashPassword, hashRecoveryKey, normalizeUsername, validPassword, verifyPassword } from './password'
import { allowAttempt } from './rate-limit'

export async function authenticate(usernameInput: unknown, passwordInput: unknown) {
  const username = normalizeUsername(usernameInput)
  if (!username || typeof passwordInput !== 'string' || passwordInput.length > 128) return null
  if (!await allowAttempt(`login:${username}`, 8)) return null
  const user = await prisma.user.findUnique({ where: { username } })
  // Spend the same password work for unknown users to reduce enumeration.
  const fallback = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`
  const valid = await verifyPassword(passwordInput, user?.passwordHash ?? fallback)
  return user && valid ? user : null
}

export async function registerAccount(usernameInput: unknown, password: unknown, nameInput: unknown) {
  const username = normalizeUsername(usernameInput)
  if (!username || !validPassword(password)) throw new Error('INVALID_INPUT')
  const recoveryKey = createRecoveryKey()
  const user = await prisma.user.create({ data: {
    username, calendarToken: randomBytes(32).toString('base64url'), keycloakId: `local:${randomUUID()}`,
    passwordHash: await hashPassword(password), recoveryHash: hashRecoveryKey(recoveryKey),
    name: typeof nameInput === 'string' ? nameInput.trim().slice(0, 80) || username : username,
  } })
  return { user, recoveryKey }
}
