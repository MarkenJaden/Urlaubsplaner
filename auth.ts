import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Keycloak from 'next-auth/providers/keycloak'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import type { NextAuthConfig } from 'next-auth'
import { authenticate } from '@/lib/account'
import { getOrCreateUser } from '@/lib/user'
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
          // Use provider-scoped subject identifier; never auto-link accounts via unverified email.
          const subjectKey = `${account.provider}:${account.providerAccountId}`
          const displayName = (profile?.name as string | undefined) ?? user?.name ?? undefined
          const email = (profile?.email as string | undefined) ?? user?.email ?? undefined
          const stored = await getOrCreateUser(subjectKey, email, displayName)
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
