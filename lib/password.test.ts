import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword, normalizeUsername, validPassword, createRecoveryKey, hashRecoveryKey } from './password'

describe('local credentials', () => {
  it('normalizes usernames and rejects ambiguous identifiers', () => {
    expect(normalizeUsername('  Niklas.Test  ')).toBe('niklas.test')
    expect(normalizeUsername('a')).toBeNull()
    expect(normalizeUsername('person@example.com')).toBeNull()
  })
  it('requires passwords between 12 and 128 characters', () => {
    expect(validPassword('too-short')).toBe(false)
    expect(validPassword('a'.repeat(12))).toBe(true)
    expect(validPassword('a'.repeat(129))).toBe(false)
  })
  it('salts hashes and verifies without accepting malformed stored hashes', async () => {
    const password = 'correct horse battery staple'
    const hash = await hashPassword(password)
    expect(hash).not.toBe(await hashPassword(password))
    expect(await verifyPassword(password, hash)).toBe(true)
    expect(await verifyPassword('wrong password!', hash)).toBe(false)
    expect(await verifyPassword(password, 'scrypt:broken')).toBe(false)
  })
  it('generates recovery keys without storing the original key', () => {
    const key = createRecoveryKey()
    expect(key).toHaveLength(43)
    expect(hashRecoveryKey(key)).not.toBe(key)
    expect(hashRecoveryKey(key)).toBe(hashRecoveryKey(key))
    expect(hashRecoveryKey('123456')).toBeNull()
  })
})
