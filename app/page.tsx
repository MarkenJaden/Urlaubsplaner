import { auth } from '@/auth'
import { getOrCreateUser } from '@/lib/user'
import { CalendarClient } from '@/components/calendar/calendar-client'

export default async function HomePage() {
  const session = await auth()

  // Wenn eingeloggt: Nutzerdaten laden für gespeicherte Einstellungen
  let userId: string | undefined
  let preferences: Record<string, unknown> = {}

  if (session?.user?.keycloakId) {
    try {
      const user = await getOrCreateUser(
        session.user.keycloakId,
        session.user.email,
        session.user.name
      )
      userId = user.id
      preferences = user.preferences as Record<string, unknown>
    } catch {
      // DB nicht erreichbar o.ä. — trotzdem rendern
    }
  }

  return <CalendarClient userId={userId} preferences={preferences} isLoggedIn={!!session?.user?.keycloakId} />
}
