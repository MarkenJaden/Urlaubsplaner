import { getUserByToken } from '@/lib/user'
import { createCalendar, holidayEvents } from '@/lib/calendar'
import type { CalendarEntry } from '@/lib/calendar'
import { fetchHolidays, fetchSubdivisions, resolveSchoolGroup } from '@/lib/holiday-api'
import { DEFAULT_COUNTRY } from '@/lib/holiday-regions'
import type { UserPreferences } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })

  const user = await getUserByToken(token)
  if (!user) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const prefs = user.preferences as UserPreferences
  const entries: CalendarEntry[] = user.vacations
    .filter(entry => entry.type !== 'note' || prefs.feedIncludeNotes)
    .map(entry => ({ ...entry, date: entry.date.toISOString(), createdAt: entry.createdAt.toISOString(), updatedAt: entry.updatedAt.toISOString() }))
  if (prefs.feedIncludePublicHolidays || prefs.feedIncludeSchoolHolidays) {
    const country = prefs.country ?? DEFAULT_COUNTRY
    const year = new Date().getUTCFullYear()
    try {
      // Without a region only countries without subdivisions have a well-defined holiday set.
      const located = Boolean(prefs.subdivision || prefs.holidayGroup) || (await fetchSubdivisions(country)).length === 0
      if (located) {
        const group = prefs.feedIncludeSchoolHolidays ? await resolveSchoolGroup(country, prefs.subdivision, prefs.holidayGroup) : undefined
        const types = (['public', 'school'] as const).filter(type => type === 'public' ? prefs.feedIncludePublicHolidays : prefs.feedIncludeSchoolHolidays)
        const results = await Promise.all(types.map(async type => ({
          type, holidays: (await Promise.all([year - 1, year, year + 1].map(y => fetchHolidays(country, prefs.subdivision, y, type, group)))).flat(),
        })))
        for (const { type, holidays } of results) entries.push(...holidayEvents(user.id, type, holidays))
      }
    } catch {
      // Avoid serving a partial feed that calendar clients could interpret as deletions.
      return new Response('Holiday data temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } })
    }
  }
  return new Response(createCalendar(entries, { name: `Urlaubsplaner - ${user.name ?? 'Mein Plan'}`, refreshInterval: 'PT6H' }), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="urlaubsplaner.ics"',
      'Cache-Control': 'private, no-cache, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer'
    }
  })
}
