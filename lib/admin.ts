import { prisma } from './prisma'

const ADMIN_USERNAME = 'markenjaden'

export function isUserAdmin(user: {
  isAdmin?: boolean | null
  username?: string | null
  email?: string | null
} | null | undefined): boolean {
  if (!user) return false
  if (user.isAdmin) return true

  const envAdmin = process.env.ADMIN_USERNAME?.trim().toLowerCase()
  const username = user.username?.trim().toLowerCase()

  if (username && (username === ADMIN_USERNAME || (envAdmin && username === envAdmin))) {
    return true
  }

  const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const email = user.email?.trim().toLowerCase()
  if (email && envAdminEmail && email === envAdminEmail) {
    return true
  }

  return false
}

export interface StoredOAuthConfig {
  googleEnabled?: boolean
  googleClientId?: string
  googleClientSecret?: string
  githubEnabled?: boolean
  githubClientId?: string
  githubClientSecret?: string
}

const OAUTH_SETTING_KEY = 'oauth_providers'

export async function getOAuthSettings(): Promise<StoredOAuthConfig> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: OAUTH_SETTING_KEY },
    })
    const dbVal = (row?.value && typeof row.value === 'object' ? row.value : {}) as StoredOAuthConfig
    return {
      googleEnabled: dbVal.googleEnabled ?? Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
      googleClientId: dbVal.googleClientId || process.env.AUTH_GOOGLE_ID || '',
      googleClientSecret: dbVal.googleClientSecret || process.env.AUTH_GOOGLE_SECRET || '',
      githubEnabled: dbVal.githubEnabled ?? Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
      githubClientId: dbVal.githubClientId || process.env.AUTH_GITHUB_ID || '',
      githubClientSecret: dbVal.githubClientSecret || process.env.AUTH_GITHUB_SECRET || '',
    }
  } catch {
    return {
      googleEnabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
      googleClientId: process.env.AUTH_GOOGLE_ID || '',
      googleClientSecret: process.env.AUTH_GOOGLE_SECRET || '',
      githubEnabled: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
      githubClientId: process.env.AUTH_GITHUB_ID || '',
      githubClientSecret: process.env.AUTH_GITHUB_SECRET || '',
    }
  }
}

export async function getPublicOAuthStatus(): Promise<{
  googleEnabled: boolean
  githubEnabled: boolean
  smtpEnabled: boolean
}> {
  const [cfg, smtp] = await Promise.all([getOAuthSettings(), getSmtpSettings()])
  return {
    googleEnabled: Boolean(cfg.googleEnabled && cfg.googleClientId && cfg.googleClientSecret),
    githubEnabled: Boolean(cfg.githubEnabled && cfg.githubClientId && cfg.githubClientSecret),
    smtpEnabled: Boolean(smtp.enabled && smtp.host && smtp.fromEmail),
  }
}

/**
 * Returns masked OAuth configuration for the Admin UI (NEVER exposes client secrets).
 */
export async function getSafeAdminOAuthSettings() {
  const cfg = await getOAuthSettings()
  return {
    googleEnabled: Boolean(cfg.googleEnabled),
    googleClientId: cfg.googleClientId || '',
    hasGoogleSecret: Boolean(cfg.googleClientSecret),
    githubEnabled: Boolean(cfg.githubEnabled),
    githubClientId: cfg.githubClientId || '',
    hasGithubSecret: Boolean(cfg.githubClientSecret),
  }
}

export async function saveAdminOAuthSettings(input: {
  googleEnabled?: boolean
  googleClientId?: string
  googleClientSecret?: string
  githubEnabled?: boolean
  githubClientId?: string
  githubClientSecret?: string
}) {
  const existing = await getOAuthSettings()
  const next: StoredOAuthConfig = {
    googleEnabled: input.googleEnabled ?? existing.googleEnabled ?? false,
    googleClientId: typeof input.googleClientId === 'string' ? input.googleClientId.trim() : existing.googleClientId,
    // Only overwrite secret if a non-empty new secret was submitted
    googleClientSecret:
      typeof input.googleClientSecret === 'string' && input.googleClientSecret.trim().length > 0
        ? input.googleClientSecret.trim()
        : existing.googleClientSecret,
    githubEnabled: input.githubEnabled ?? existing.githubEnabled ?? false,
    githubClientId: typeof input.githubClientId === 'string' ? input.githubClientId.trim() : existing.githubClientId,
    githubClientSecret:
      typeof input.githubClientSecret === 'string' && input.githubClientSecret.trim().length > 0
        ? input.githubClientSecret.trim()
        : existing.githubClientSecret,
  }

  await prisma.systemSetting.upsert({
    where: { key: OAUTH_SETTING_KEY },
    create: { key: OAUTH_SETTING_KEY, value: next as object },
    update: { value: next as object },
  })

  return getSafeAdminOAuthSettings()
}

// ============================================================================
// SMTP Settings Management
// ============================================================================

export interface StoredSmtpConfig {
  enabled?: boolean
  host?: string
  port?: number
  secure?: boolean
  user?: string
  pass?: string
  fromEmail?: string
  fromName?: string
}

const SMTP_SETTING_KEY = 'smtp_settings'

export async function getSmtpSettings(): Promise<StoredSmtpConfig> {
  const defaultPort = Number(process.env.SMTP_PORT) || 587
  const defaultSecure = process.env.SMTP_SECURE === 'true' || defaultPort === 465

  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SMTP_SETTING_KEY },
    })
    const dbVal = (row?.value && typeof row.value === 'object' ? row.value : {}) as StoredSmtpConfig
    const port = typeof dbVal.port === 'number' && dbVal.port > 0 && dbVal.port <= 65535 ? dbVal.port : defaultPort
    return {
      enabled: dbVal.enabled ?? Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
      host: dbVal.host || process.env.SMTP_HOST || '',
      port,
      secure: dbVal.secure ?? defaultSecure,
      user: dbVal.user ?? process.env.SMTP_USER ?? '',
      pass: dbVal.pass || process.env.SMTP_PASS || '',
      fromEmail: dbVal.fromEmail || process.env.SMTP_FROM || '',
      fromName: dbVal.fromName || process.env.SMTP_FROM_NAME || 'Urlaubsplaner',
    }
  } catch {
    return {
      enabled: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
      host: process.env.SMTP_HOST || '',
      port: defaultPort,
      secure: defaultSecure,
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.SMTP_FROM || '',
      fromName: process.env.SMTP_FROM_NAME || 'Urlaubsplaner',
    }
  }
}

export async function getSafeAdminSmtpSettings() {
  const cfg = await getSmtpSettings()
  return {
    enabled: Boolean(cfg.enabled),
    host: cfg.host || '',
    port: cfg.port || 587,
    secure: Boolean(cfg.secure),
    user: cfg.user || '',
    hasPass: Boolean(cfg.pass),
    fromEmail: cfg.fromEmail || '',
    fromName: cfg.fromName || 'Urlaubsplaner',
  }
}

export async function saveAdminSmtpSettings(input: {
  enabled?: boolean
  host?: string
  port?: number
  secure?: boolean
  user?: string
  pass?: string
  fromEmail?: string
  fromName?: string
}) {
  const existing = await getSmtpSettings()
  const port = typeof input.port === 'number' && input.port > 0 && input.port <= 65535 ? Math.floor(input.port) : (existing.port ?? 587)
  const next: StoredSmtpConfig = {
    enabled: input.enabled ?? existing.enabled ?? false,
    host: typeof input.host === 'string' ? input.host.trim() : existing.host,
    port,
    secure: input.secure ?? existing.secure ?? (port === 465),
    user: typeof input.user === 'string' ? input.user.trim() : existing.user,
    pass:
      typeof input.pass === 'string' && input.pass.trim().length > 0
        ? input.pass.trim()
        : existing.pass,
    fromEmail: typeof input.fromEmail === 'string' ? input.fromEmail.trim() : existing.fromEmail,
    fromName: typeof input.fromName === 'string' ? input.fromName.trim() || 'Urlaubsplaner' : existing.fromName,
  }

  await prisma.systemSetting.upsert({
    where: { key: SMTP_SETTING_KEY },
    create: { key: SMTP_SETTING_KEY, value: next as object },
    update: { value: next as object },
  })

  return getSafeAdminSmtpSettings()
}
