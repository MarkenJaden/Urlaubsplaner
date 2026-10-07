import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const username = value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) ? username : null
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128
}

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  return `scrypt:${salt}:${(await derive(password, salt)).toString('hex')}`
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  const parts = hash?.split(':') ?? []
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false
  if (password.length > 128) return false
  return timingSafeEqual(await derive(password, parts[1]), Buffer.from(parts[2], 'hex'))
}

export function createRecoveryKey(): string { return randomBytes(32).toString('base64url') }

export function hashRecoveryKey(key: unknown): string | null {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{43}$/.test(key)
    ? createHash('sha256').update(key).digest('hex') : null
}
