export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPublicOAuthStatus } from '@/lib/admin'
import { SettingsClient } from '@/components/settings/settings-client'

export const metadata: Metadata = {
  title: 'Kontoeinstellungen',
  robots: { index: false, follow: false },
}

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const [user, oauthStatus] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      include: {
        calendarFeeds: {
          orderBy: { createdAt: 'asc' },
        },
        passkeys: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            createdAt: true,
            lastUsedAt: true,
          },
        },
      },
    }),
    getPublicOAuthStatus(),
  ])

  return (
    <SettingsClient
      username={user.username}
      email={user.email}
      hasLocalAccount={Boolean(user.passwordHash)}
      totpEnabled={Boolean(user.totpEnabled)}
      initialPasskeys={user.passkeys.map(pk => ({
        id: pk.id,
        name: pk.name,
        createdAt: pk.createdAt.toISOString(),
        lastUsedAt: pk.lastUsedAt ? pk.lastUsedAt.toISOString() : null,
      }))}
      googleLinked={Boolean(user.googleId || user.keycloakId.startsWith('google:'))}
      githubLinked={Boolean(user.githubId || user.keycloakId.startsWith('github:'))}
      googleOAuthEnabled={oauthStatus.googleEnabled}
      githubOAuthEnabled={oauthStatus.githubEnabled}
      calendarToken={user.calendarToken}
      initialFeeds={user.calendarFeeds.map(f => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      }))}
      preferences={user.preferences as Record<string, unknown>}
    />
  )
}
