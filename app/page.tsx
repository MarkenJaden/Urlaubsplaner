import { auth } from '@/auth'
import { getUserFromSession } from '@/lib/user'
import { CalendarClient } from '@/components/calendar/calendar-client'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await auth()

  // Wenn eingeloggt: Nutzerdaten laden für gespeicherte Einstellungen
  let userId: string | undefined
  let preferences: Record<string, unknown> = {}

  if (session?.user?.id) {
    try {
      const user = await getUserFromSession(session)
      userId = user.id
      preferences = user.preferences as Record<string, unknown>
    } catch {
      // DB nicht erreichbar o.ä. — trotzdem rendern
    }
  }

  const initialTodayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  return (
    <CalendarClient
      userId={userId}
      preferences={preferences}
      isLoggedIn={!!session?.user?.id}
      initialTodayKey={initialTodayKey}
    />
  )
}
