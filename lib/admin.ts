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
}> {
  const cfg = await getOAuthSettings()
  return {
    googleEnabled: Boolean(cfg.googleEnabled && cfg.googleClientId && cfg.googleClientSecret),
    githubEnabled: Boolean(cfg.githubEnabled && cfg.githubClientId && cfg.githubClientSecret),
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
