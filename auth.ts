import NextAuth from 'next-auth'
import Keycloak from 'next-auth/providers/keycloak'
import type { NextAuthConfig } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      keycloakId: string
    }
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.keycloakId = profile.sub
      }
      return token
    },
    async session({ session, token }) {
      if (token.keycloakId) {
        session.user.keycloakId = token.keycloakId as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login'
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
