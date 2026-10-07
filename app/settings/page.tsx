export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/user'
import { SettingsClient } from '@/components/settings/settings-client'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const user = await getUserFromSession(session)

  return (
    <SettingsClient
      username={user.username}
      hasLocalAccount={Boolean(user.passwordHash)}
      calendarToken={user.calendarToken}
      preferences={user.preferences as Record<string, unknown>}
    />
  )
}
