import * as userLib from '@/lib/user'
import { prisma } from '@/lib/prisma'
import { createCalendar, holidayEvents, sharedOverlayEvents } from '@/lib/calendar'
import type { CalendarEntry } from '@/lib/calendar'
import { fetchHolidays, fetchSubdivisions, resolveSchoolGroup } from '@/lib/holiday-api'
import { DEFAULT_COUNTRY } from '@/lib/holiday-regions'
import { detectBridgeDays } from '@/lib/bridge-days'
import type { UserPreferences, Holiday, SharedPlanOverlay } from '@/types'

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

  let user = await userLib.getUserByToken(token)
  let feedOverride: {
    name: string
    includeVacations: boolean
    includeGleittage: boolean
    includeNotes: boolean
    includeNoteTitles: boolean
    includePublicHolidays: boolean
    includeSchoolHolidays: boolean
    includeBridgeDays: boolean
    includeSharedOverlays?: boolean
    sharedOverlayIds?: unknown
    color?: string | null
  } | null = null

  if (!user && typeof userLib.getCalendarFeedByToken === 'function') {
    const customFeed = await userLib.getCalendarFeedByToken(token)
    if (customFeed) {
      user = customFeed.user
      feedOverride = customFeed
    }
  }

  if (!user) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const { searchParams } = new URL(request.url)
  const prefs = user.preferences as UserPreferences

  const includeVacations = boolParam(
    searchParams,
    'vacations',
    feedOverride ? feedOverride.includeVacations : (prefs.feedIncludeVacations ?? true)
  )
  const includeGleittage = boolParam(
    searchParams,
    'gleittag',
    feedOverride ? feedOverride.includeGleittage : (prefs.feedIncludeGleittage ?? true)
  )
  const includeNotes = boolParam(
    searchParams,
    'notes',
    feedOverride ? feedOverride.includeNotes : Boolean(prefs.feedIncludeNotes)
  )
  const includeNoteTitles = boolParam(
    searchParams,
    'noteTitles',
    feedOverride ? feedOverride.includeNoteTitles : (prefs.feedIncludeNoteTitles ?? true)
  )
  const includePublicHolidays = boolParam(
    searchParams,
    'public',
    feedOverride ? feedOverride.includePublicHolidays : Boolean(prefs.feedIncludePublicHolidays)
  )
  const includeSchoolHolidays = boolParam(
    searchParams,
    'school',
    feedOverride ? feedOverride.includeSchoolHolidays : Boolean(prefs.feedIncludeSchoolHolidays)
  )
  const includeBridgeDays = boolParam(
    searchParams,
    'bridge',
    feedOverride ? feedOverride.includeBridgeDays : Boolean(prefs.feedIncludeBridgeDays)
  )
  const includeSharedOverlays = boolParam(
    searchParams,
    'shared',
    feedOverride ? Boolean(feedOverride.includeSharedOverlays) : Boolean(prefs.feedIncludeSharedOverlays)
  )
  const rawOverlayIds = feedOverride ? feedOverride.sharedOverlayIds : prefs.feedSharedOverlayIds
  const selectedOverlayIds = Array.isArray(rawOverlayIds)
    ? rawOverlayIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : null

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

  const holidayDateKeys = new Set<string>()
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
          for (const h of publicByYear.flat()) {
            const cur = new Date(`${h.startDate}T00:00:00Z`)
            const end = new Date(`${h.endDate}T00:00:00Z`)
            while (cur <= end) {
              holidayDateKeys.add(cur.toISOString().slice(0, 10))
              cur.setUTCDate(cur.getUTCDate() + 1)
            }
          }
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

  if (includeSharedOverlays && Array.isArray(prefs.sharedOverlays) && prefs.sharedOverlays.length > 0) {
    const overlaysToInclude: SharedPlanOverlay[] =
      selectedOverlayIds && selectedOverlayIds.length > 0
        ? prefs.sharedOverlays.filter(o => selectedOverlayIds.includes(o.id))
        : prefs.sharedOverlays.filter(o => o.enabled !== false)

    for (const overlay of overlaysToInclude) {
      let resolvedEntries: Array<{ date: string; type: string; title?: string | null }> = overlay.entries ?? []
      let overlayWorkDays = overlay.workDays

      if (overlay.token) {
        try {
          if (overlay.token.startsWith('g_')) {
            const setting = await prisma.systemSetting.findUnique({
              where: { key: `guest_share:${overlay.token}` },
            })
            const record = setting?.value as unknown as {
              includeNotes?: boolean
              preferences?: UserPreferences
              entries?: Array<{ date: string; type: string; title?: string | null }>
            } | undefined
            if (record?.entries) {
              resolvedEntries = record.entries.filter(e => record.includeNotes || e.type !== 'note')
              if (record.preferences?.workDays) overlayWorkDays = record.preferences.workDays
            }
          } else {
            const share = await prisma.planShare.findUnique({
              where: { token: overlay.token },
              include: { user: { include: { vacations: true } } },
            })
            if (share) {
              const ownerPrefs = (share.user.preferences ?? {}) as UserPreferences
              if (ownerPrefs.workDays) overlayWorkDays = ownerPrefs.workDays
              resolvedEntries = share.user.vacations
                .filter(v => share.includeNotes || v.type !== 'note')
                .map(v => ({
                  date: v.date.toISOString().slice(0, 10),
                  type: v.type,
                  title: v.title,
                }))
            }
          }
        } catch {
          // Fall back to embedded snapshot entries if live lookup fails
        }
      }

      entries.push(
        ...sharedOverlayEvents(
          user.id,
          {
            id: overlay.id,
            label: overlay.label,
            color: overlay.color,
            workDays: overlayWorkDays,
            entries: resolvedEntries,
          },
          { holidayDates: holidayDateKeys.size > 0 ? holidayDateKeys : undefined }
        )
      )
    }
  }

  const calendarName = feedOverride
    ? `Urlaubsplaner – ${feedOverride.name}`
    : user.name
      ? `Urlaubsplaner (${user.name})`
      : 'Urlaubsplaner'

  const ics = createCalendar(entries, {
    name: calendarName,
    refreshInterval: 'PT6H',
    workDays: prefs.workDays,
    holidayDates: holidayDateKeys.size > 0 ? holidayDateKeys : undefined,
    color: feedOverride?.color ?? null,
  })

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="urlaubsplaner.ics"',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}
