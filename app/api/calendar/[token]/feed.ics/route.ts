import { getUserByToken } from '@/lib/user'
import { createCalendar } from '@/lib/calendar'
import type { CalendarEntry } from '@/lib/calendar'
import { fetchHolidays } from '@/lib/holiday-api'
import type { UserPreferences } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new Response('Not found', { status: 404 })

  const user = await getUserByToken(token)
  if (!user) {
    return new Response('Not found', { status: 404 })
  }

  const prefs = user.preferences as UserPreferences
  const entries: CalendarEntry[] = user.vacations
    .filter(entry => entry.type !== 'note' || prefs.feedIncludeNotes)
    .map(entry => ({ ...entry, date: entry.date.toISOString(), createdAt: entry.createdAt.toISOString(), updatedAt: entry.updatedAt.toISOString() }))
  if (prefs.subdivision && (prefs.feedIncludePublicHolidays || prefs.feedIncludeSchoolHolidays)) {
    const year = new Date().getUTCFullYear()
    try {
      const tasks = [year - 1, year, year + 1].flatMap(y => (['public', 'school'] as const)
        .filter(type => type === 'public' ? prefs.feedIncludePublicHolidays : prefs.feedIncludeSchoolHolidays)
        .map(async type => ({ type, holidays: await fetchHolidays('DE', prefs.subdivision, y, type) })))
      for (const { type, holidays } of await Promise.all(tasks)) {
        for (const holiday of holidays) {
          const current = new Date(`${holiday.startDate}T00:00:00Z`)
          const end = new Date(`${holiday.endDate}T00:00:00Z`)
          while (current <= end) {
            const date = current.toISOString().slice(0, 10)
            entries.push({ id: holiday.id, userId: user.id, date, type, title: holiday.name.find(n => n.language === 'DE')?.text ?? holiday.name[0]?.text, year: current.getUTCFullYear(), createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z` })
            current.setUTCDate(current.getUTCDate() + 1)
          }
        }
      }
    } catch {
      // Avoid serving a partial feed that calendar clients could interpret as deletions.
      return new Response('Holiday data temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } })
    }
  }
  return new Response(createCalendar(entries, `Urlaubsplaner - ${user.name ?? 'Mein Plan'}`), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="urlaubsplaner.ics"',
      'Cache-Control': 'private, no-cache, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer'
    }
  })
}
