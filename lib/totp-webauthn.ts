import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as cryptoVerify,
} from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function getServerSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'urlaubsplaner-totp-webauthn-secret-fallback'
  )
}

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(`totp-enc:${getServerSecret()}`).digest()
}

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength))
}

export function buildOtpAuthUri(
  accountName: string,
  secret: string,
  issuer = 'Urlaubsplaner',
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

export function generateTotpCode(
  secretBase32: string,
  timestampMs = Date.now(),
  stepSeconds = 30,
): string {
  const key = base32Decode(secretBase32)
  const counter = Math.floor(timestampMs / 1000 / stepSeconds)
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigUInt64BE(BigInt(counter))

  const hmac = createHmac('sha1', key).update(counterBuf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const otp = binary % 1_000_000
  return String(otp).padStart(6, '0')
}

export function verifyTotpCode(
  secretBase32: string,
  codeInput: string,
  timestampMs = Date.now(),
  windowSteps = 1,
): boolean {
  const cleaned = codeInput.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(cleaned)) return false
  const stepMs = 30_000
  for (let w = -windowSteps; w <= windowSteps; w++) {
    const candidate = generateTotpCode(secretBase32, timestampMs + w * stepMs)
    const a = Buffer.from(candidate)
    const b = Buffer.from(cleaned)
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true
    }
  }
  return false
}

export function encryptTotpSecret(plainSecret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptTotpSecret(payload: string): string | null {
  try {
    const parts = payload.split('.')
    if (parts.length !== 3) return null
    const [ivB64, tagB64, dataB64] = parts
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      Buffer.from(ivB64, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch {
    return null
  }
}

export interface SignedWebAuthnChallenge {
  challenge: string
  type: 'register' | 'auth'
  rpId: string
  userId?: string
  exp: number
}

export function createSignedChallenge(params: {
  type: 'register' | 'auth'
  rpId: string
  userId?: string
}): { challenge: string; token: string } {
  const challenge = randomBytes(32).toString('base64url')
  const payload: SignedWebAuthnChallenge = {
    challenge,
    type: params.type,
    rpId: params.rpId,
    ...(params.userId ? { userId: params.userId } : {}),
    exp: Math.floor(Date.now() / 1000) + 300,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', getServerSecret()).update(encoded).digest('base64url')
  return { challenge, token: `${encoded}.${sig}` }
}

export function verifySignedChallenge(token: string): SignedWebAuthnChallenge | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [encoded, sig] = parts
    const expectedSig = createHmac('sha256', getServerSecret()).update(encoded).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as SignedWebAuthnChallenge
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function signPasskeyLoginToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60
  const nonce = randomBytes(12).toString('base64url')
  const payload = `pklogin.${userId}.${exp}.${nonce}`
  const sig = createHmac('sha256', getServerSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyPasskeyLoginToken(token: unknown): string | null {
  if (typeof token !== 'string' || !token) return null
  const parts = token.split('.')
  if (parts.length !== 5 || parts[0] !== 'pklogin') return null
  const [, userId, expStr, nonce, sig] = parts
  const exp = Number(expStr)
  if (!userId || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null
  const payload = `pklogin.${userId}.${expStr}.${nonce}`
  const expectedSig = createHmac('sha256', getServerSecret()).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return userId
}

export function resolveRpId(request: Request): string {
  const hostHeader =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    new URL(request.url).hostname
  const host = hostHeader.split(',')[0].trim().split(':')[0].toLowerCase()
  return host || 'localhost'
}

export function verifyPasskeyRegistration(params: {
  clientDataJSON: string
  authenticatorData: string
  publicKeySpki: string
  algorithm?: number
  expectedChallenge: string
  expectedRpId: string
}): { valid: boolean; counter: number } {
  try {
    const clientDataBuf = Buffer.from(params.clientDataJSON, 'base64url')
    const clientData = JSON.parse(clientDataBuf.toString('utf8')) as {
      type?: string
      challenge?: string
      origin?: string
    }
    if (clientData.type !== 'webauthn.create') return { valid: false, counter: 0 }
    if (clientData.challenge !== params.expectedChallenge) return { valid: false, counter: 0 }
    if (!clientData.origin) return { valid: false, counter: 0 }
    const originHost = new URL(clientData.origin).hostname.toLowerCase()
    if (
      originHost !== params.expectedRpId &&
      !originHost.endsWith(`.${params.expectedRpId}`)
    ) {
      return { valid: false, counter: 0 }
    }

    const authData = Buffer.from(params.authenticatorData, 'base64url')
    if (authData.length < 37) return { valid: false, counter: 0 }
    const rpIdHash = authData.subarray(0, 32)
    const expectedRpIdHash = createHash('sha256').update(params.expectedRpId).digest()
    if (!timingSafeEqual(rpIdHash, expectedRpIdHash)) return { valid: false, counter: 0 }

    const flags = authData[32]
    const userPresent = (flags & 0x01) !== 0
    if (!userPresent) return { valid: false, counter: 0 }

    const counter = authData.readUInt32BE(33)

    // Verify that the provided SPKI public key is valid and parseable by Node crypto
    const spkiBuf = Buffer.from(params.publicKeySpki, 'base64url')
    createPublicKey({ key: spkiBuf, format: 'der', type: 'spki' })

    return { valid: true, counter }
  } catch {
    return { valid: false, counter: 0 }
  }
}

export function verifyPasskeyAssertion(params: {
  clientDataJSON: string
  authenticatorData: string
  signature: string
  publicKeySpki: string
  expectedChallenge: string
  expectedRpId: string
  previousCounter: number
}): { valid: boolean; newCounter: number } {
  try {
    const clientDataBuf = Buffer.from(params.clientDataJSON, 'base64url')
    const clientData = JSON.parse(clientDataBuf.toString('utf8')) as {
      type?: string
      challenge?: string
      origin?: string
    }
    if (clientData.type !== 'webauthn.get') return { valid: false, newCounter: 0 }
    if (clientData.challenge !== params.expectedChallenge) return { valid: false, newCounter: 0 }
    if (!clientData.origin) return { valid: false, newCounter: 0 }
    const originHost = new URL(clientData.origin).hostname.toLowerCase()
    if (
      originHost !== params.expectedRpId &&
      !originHost.endsWith(`.${params.expectedRpId}`)
    ) {
      return { valid: false, newCounter: 0 }
    }

    const authData = Buffer.from(params.authenticatorData, 'base64url')
    if (authData.length < 37) return { valid: false, newCounter: 0 }
    const rpIdHash = authData.subarray(0, 32)
    const expectedRpIdHash = createHash('sha256').update(params.expectedRpId).digest()
    if (!timingSafeEqual(rpIdHash, expectedRpIdHash)) return { valid: false, newCounter: 0 }

    const flags = authData[32]
    const userPresent = (flags & 0x01) !== 0
    if (!userPresent) return { valid: false, newCounter: 0 }

    const newCounter = authData.readUInt32BE(33)
    if (params.previousCounter > 0 && newCounter > 0 && newCounter <= params.previousCounter) {
      return { valid: false, newCounter: 0 }
    }

    const clientDataHash = createHash('sha256').update(clientDataBuf).digest()
    const signedData = Buffer.concat([authData, clientDataHash])
    const sigBuf = Buffer.from(params.signature, 'base64url')
    const pubKey = createPublicKey({
      key: Buffer.from(params.publicKeySpki, 'base64url'),
      format: 'der',
      type: 'spki',
    })

    const signatureValid = cryptoVerify('sha256', signedData, pubKey, sigBuf)
    return { valid: signatureValid, newCounter }
  } catch {
    return { valid: false, newCounter: 0 }
  }
}
