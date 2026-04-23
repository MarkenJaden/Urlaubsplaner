import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getOrCreateUser } from '@/lib/user'
import { CalendarClient } from '@/components/calendar/calendar-client'

export default async function HomePage() {
  const session = await auth()
  if (!session?.user?.keycloakId) {
    redirect('/login')
  }

  const user = await getOrCreateUser(
    session.user.keycloakId,
    session.user.email,
    session.user.name
  )

  return <CalendarClient userId={user.id} preferences={user.preferences as Record<string, unknown>} />
}
