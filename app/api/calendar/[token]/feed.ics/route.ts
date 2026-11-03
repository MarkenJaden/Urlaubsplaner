import { getUserByToken } from '@/lib/user'
import { createCalendar, holidayEvents } from '@/lib/calendar'
import type { CalendarEntry } from '@/lib/calendar'
import { fetchHolidays, fetchSubdivisions, resolveSchoolGroup } from '@/lib/holiday-api'
import { DEFAULT_COUNTRY } from '@/lib/holiday-regions'
import { detectBridgeDays } from '@/lib/bridge-days'
import type { UserPreferences, Holiday } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function boolParam(searchParams: URLSearchParams, key: string, fallback: boolean): boolean {
  const val = searchParams.get(key)
  if (val === '1' || val === 'true') return true
  if (val === '0' || val === 'false') return false
  return fallback
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })

  const user = await getUserByToken(token)
  if (!user) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const { searchParams } = new URL(request.url)
  const prefs = user.preferences as UserPreferences

  const includeVacations = boolParam(searchParams, 'vacations', prefs.feedIncludeVacations ?? true)
  const includeGleittage = boolParam(searchParams, 'gleittag', prefs.feedIncludeGleittage ?? true)
  const includeNotes = boolParam(searchParams, 'notes', Boolean(prefs.feedIncludeNotes))
  const includeNoteTitles = boolParam(searchParams, 'noteTitles', prefs.feedIncludeNoteTitles ?? true)
  const includePublicHolidays = boolParam(searchParams, 'public', Boolean(prefs.feedIncludePublicHolidays))
  const includeSchoolHolidays = boolParam(searchParams, 'school', Boolean(prefs.feedIncludeSchoolHolidays))
  const includeBridgeDays = boolParam(searchParams, 'bridge', Boolean(prefs.feedIncludeBridgeDays))

  const entries: CalendarEntry[] = user.vacations
    .filter(entry => {
      if (entry.type === 'vacation') return includeVacations
      if (entry.type === 'gleittag') return includeGleittage
      if (entry.type === 'note') return includeNotes
      return true
    })
    .map(entry => ({
      ...entry,
      title: entry.type === 'note' && !includeNoteTitles ? null : entry.title,
      date: entry.date.toISOString(),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }))

  if (includePublicHolidays || includeSchoolHolidays || includeBridgeDays) {
    const country = prefs.country ?? DEFAULT_COUNTRY
    const year = new Date().getUTCFullYear()
    try {
      // Without a region only countries without subdivisions have a well-defined holiday set.
      const located = Boolean(prefs.subdivision || prefs.holidayGroup) || (await fetchSubdivisions(country)).length === 0
      if (located) {
        const group = includeSchoolHolidays ? await resolveSchoolGroup(country, prefs.subdivision, prefs.holidayGroup) : undefined
        const needPublic = includePublicHolidays || includeBridgeDays
        const years = [year - 1, year, year + 1]

        let publicByYear: Holiday[][] = []
        if (needPublic) {
          publicByYear = await Promise.all(years.map(y => fetchHolidays(country, prefs.subdivision, y, 'public')))
        }
        if (includePublicHolidays) {
          entries.push(...holidayEvents(user.id, 'public', publicByYear.flat()))
        }
        if (includeSchoolHolidays) {
          const schoolAll = (await Promise.all(years.map(y => fetchHolidays(country, prefs.subdivision, y, 'school', group)))).flat()
          entries.push(...holidayEvents(user.id, 'school', schoolAll))
        }
        if (includeBridgeDays) {
          for (let idx = 0; idx < years.length; idx++) {
            const y = years[idx]
            const bridges = detectBridgeDays(y, publicByYear[idx] ?? [])
            for (const b of bridges) {
              entries.push({
                id: `bridge-${b.date}`,
                userId: user.id,
                type: 'Brückentag',
                date: b.date,
                title: `1 Urlaubstag → ${b.freeDaysGained} Tage frei (${b.connectsBeforeName} – ${b.connectsAfterName})`,
                year: y,
                createdAt: `${b.date}T00:00:00Z`,
                updatedAt: `${b.date}T00:00:00Z`,
              })
            }
          }
        }
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
