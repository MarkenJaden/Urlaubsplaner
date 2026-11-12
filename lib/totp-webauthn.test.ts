import { describe, expect, it } from 'vitest'
import {
  base32Decode,
  base32Encode,
  buildOtpAuthUri,
  createSignedChallenge,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpCode,
  generateTotpSecret,
  signPasskeyLoginToken,
  verifyPasskeyLoginToken,
  verifySignedChallenge,
  verifyTotpCode,
} from './totp-webauthn'

describe('TOTP 2FA and WebAuthn helpers', () => {
  it('round-trips Base32 encoding and decoding', () => {
    const raw = Buffer.from('urlaubsplaner-2fa-secret-test')
    const encoded = base32Encode(raw)
    expect(base32Decode(encoded)).toEqual(raw)
  })

  it('generates and verifies 6-digit TOTP codes within window', () => {
    const secret = generateTotpSecret()
    const now = 1_760_000_000_000
    const code = generateTotpCode(secret, now)
    expect(code).toMatch(/^\d{6}$/)
    expect(verifyTotpCode(secret, code, now)).toBe(true)
    expect(verifyTotpCode(secret, code, now + 29_000)).toBe(true)
    expect(verifyTotpCode(secret, '000000', now) && code !== '000000').toBe(false)
  })

  it('encrypts and decrypts TOTP secrets with AES-256-GCM', () => {
    const secret = generateTotpSecret()
    const encrypted = encryptTotpSecret(secret)
    expect(encrypted).not.toContain(secret)
    expect(decryptTotpSecret(encrypted)).toBe(secret)
    expect(decryptTotpSecret('invalid.payload')).toBeNull()
  })

  it('builds valid otpauth:// URI', () => {
    const uri = buildOtpAuthUri('max.mustermann', 'JBSWY3DPEHPK3PXP', 'Urlaubsplaner')
    expect(uri).toContain('otpauth://totp/Urlaubsplaner:max.mustermann')
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
  })

  it('signs and verifies WebAuthn challenges and Passkey login tokens', () => {
    const { challenge, token } = createSignedChallenge({
      type: 'register',
      rpId: 'urlaubsplaner.me',
      userId: 'user-123',
    })
    const verified = verifySignedChallenge(token)
    expect(verified?.challenge).toBe(challenge)
    expect(verified?.rpId).toBe('urlaubsplaner.me')
    expect(verified?.userId).toBe('user-123')
    expect(verifySignedChallenge(`${token}tampered`)).toBeNull()

    const loginToken = signPasskeyLoginToken('user-123')
    expect(verifyPasskeyLoginToken(loginToken)).toBe('user-123')
    expect(verifyPasskeyLoginToken(`${loginToken}x`)).toBeNull()
  })
})
