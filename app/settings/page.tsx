import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getOrCreateUser } from '@/lib/user'
import { SettingsClient } from '@/components/settings/settings-client'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.keycloakId) {
    redirect('/login')
  }

  const user = await getOrCreateUser(
    session.user.keycloakId,
    session.user.email,
    session.user.name
  )

  return (
    <SettingsClient
      calendarToken={user.calendarToken}
      preferences={user.preferences as Record<string, unknown>}
    />
  )
}
