import { getUserByToken } from '@/lib/user'
import ical from 'ical-generator'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const user = await getUserByToken(token)
  if (!user) {
    return new Response('Not found', { status: 404 })
  }

  const calendar = ical({
    name: `Urlaubsplaner - ${user.name ?? user.email ?? 'User'}`,
    prodId: { company: 'Urlaubsplaner', product: 'Urlaubsplaner', language: 'DE' },
    timezone: 'Europe/Berlin'
  })

  for (const entry of user.vacations) {
    const typeLabel =
      entry.type === 'vacation'
        ? 'Urlaub'
        : entry.type === 'gleittag'
        ? 'Gleittag'
        : entry.title ?? 'Notiz'

    calendar.createEvent({
      start: entry.date,
      end: entry.date,
      allDay: true,
      summary: typeLabel,
      description: entry.title ?? undefined,
    })
  }

  return new Response(calendar.toString(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="urlaubsplaner.ics"',
      'Cache-Control': 'no-cache'
    }
  })
}
