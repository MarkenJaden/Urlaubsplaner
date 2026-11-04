import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Keycloak from 'next-auth/providers/keycloak'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import type { NextAuthConfig } from 'next-auth'
import { authenticate } from '@/lib/account'
import { getOrCreateUser, linkOrCreateOAuthUser } from '@/lib/user'
import { getOAuthSettings } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { allowAttempt, requestBucket } from '@/lib/rate-limit'

declare module 'next-auth' {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null; keycloakId: string; username?: string | null }
  }
  interface User { sessionVersion?: number; username?: string | null }
}

export const legacyLoginEnabled = Boolean(process.env.AUTH_KEYCLOAK_ID && process.env.AUTH_KEYCLOAK_SECRET && process.env.AUTH_KEYCLOAK_ISSUER)

export const LINK_COOKIE_NAME = 'up_oauth_link_uid'

function getLinkSecret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'urlaubsplaner-link-secret-fallback'
}

export function signLinkUserId(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 600 // 10 minutes
  const payload = `${userId}.${exp}`
  const sig = createHmac('sha256', getLinkSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyLinkUserId(cookieVal?: string | null): string | null {
  if (!cookieVal) return null
  const parts = cookieVal.split('.')
  if (parts.length !== 3) return null
  const [userId, expStr, sig] = parts
  const exp = Number(expStr)
  if (!userId || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null
  const expectedSig = createHmac('sha256', getLinkSecret()).update(`${userId}.${expStr}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return userId
}

async function readPendingLinkUserId(): Promise<string | null> {
  try {
    const store = await cookies()
    const raw = store.get(LINK_COOKIE_NAME)?.value
    const verified = verifyLinkUserId(raw)
    if (verified) {
      try {
        store.delete(LINK_COOKIE_NAME)
      } catch {
        // Ignore if headers are read-only in this context
      }
    }
    return verified
  } catch {
    return null
  }
}

export async function buildAuthConfig(): Promise<NextAuthConfig> {
  const oauth = await getOAuthSettings()
  const googleReady = Boolean(oauth.googleEnabled && oauth.googleClientId && oauth.googleClientSecret)
  const githubReady = Boolean(oauth.githubEnabled && oauth.githubClientId && oauth.githubClientSecret)

  return {
    trustHost: true,
    session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
    providers: [
      Credentials({
        credentials: { username: { type: 'text' }, password: { type: 'password' } },
        async authorize(credentials, request) {
          if (!await allowAttempt(`login-global`, 300, 900) || !await allowAttempt(`login-ip:${requestBucket(request)}`, 30)) return null
          const user = await authenticate(credentials.username, credentials.password)
          return user ? { id: user.id, name: user.name, email: user.email, username: user.username, sessionVersion: user.sessionVersion } : null
        },
      }),
      ...(googleReady
        ? [
            Google({
              clientId: oauth.googleClientId!,
              clientSecret: oauth.googleClientSecret!,
            }),
          ]
        : []),
      ...(githubReady
        ? [
            GitHub({
              clientId: oauth.githubClientId!,
              clientSecret: oauth.githubClientSecret!,
            }),
          ]
        : []),
      ...(legacyLoginEnabled
        ? [
            Keycloak({
              clientId: process.env.AUTH_KEYCLOAK_ID!,
              clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
              issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
            }),
          ]
        : []),
    ],
    callbacks: {
      async jwt({ token, user, account, profile }) {
        if (account?.provider === 'keycloak' && profile?.sub) {
          const stored = await getOrCreateUser(profile.sub, profile.email as string | undefined, profile.name as string | undefined)
          token.userId = stored.id
          token.sessionVersion = stored.sessionVersion
        } else if ((account?.provider === 'google' || account?.provider === 'github') && account.providerAccountId) {
          const pendingLinkUserId = (await readPendingLinkUserId()) ?? (typeof token.userId === 'string' && token.userId ? token.userId : null)
          const displayName = (profile?.name as string | undefined) ?? user?.name ?? undefined
          const email = (profile?.email as string | undefined) ?? user?.email ?? undefined
          const stored = await linkOrCreateOAuthUser({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            email,
            name: displayName,
            loggedInUserId: pendingLinkUserId,
          })
          token.userId = stored.id
          token.sessionVersion = stored.sessionVersion
        } else if (user?.id) {
          token.userId = user.id
          token.sessionVersion = user.sessionVersion ?? 0
        } else if (!token.userId && typeof token.keycloakId === 'string') {
          const stored = await prisma.user.findUnique({ where: { keycloakId: token.keycloakId } })
          if (stored) { token.userId = stored.id; token.sessionVersion = 0 }
        }
        return token
      },
      async session({ session, token }) {
        const user = typeof token.userId === 'string' ? await prisma.user.findUnique({ where: { id: token.userId } }) : null
        if (user && user.sessionVersion === token.sessionVersion) {
          Object.assign(session.user, { id: user.id, keycloakId: user.keycloakId, name: user.name, email: user.email ?? '', username: user.username })
        } else {
          Object.assign(session.user, { id: '', keycloakId: '', name: null, email: '', username: null })
        }
        return session
      },
    },
    pages: { signIn: '/login' },
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(buildAuthConfig)
