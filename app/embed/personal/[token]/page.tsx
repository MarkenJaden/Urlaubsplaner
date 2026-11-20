import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Calendar, CalendarHeart, StickyNote } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { fetchHolidays, resolveSchoolGroup } from '@/lib/holiday-api'
import { DEFAULT_COUNTRY, localizedName } from '@/lib/holiday-regions'
import { detectBridgeDays } from '@/lib/bridge-days'
import { buildPlannerHref } from '@/lib/seo-regions'
import {
  DEFAULT_WORK_DAYS,
  formatDays,
  holidayDateSet,
  summarizeVacation,
  vacationBudget,
} from '@/lib/vacation-accounting'
import { recordWidgetView } from '@/lib/widget-analytics'
import {
  PublicYearCalendar,
  type PublicPersonalEntry,
  type PublicSharedDayItem,
} from '@/components/calendar/public-year-calendar'
import type { EntryType, Holiday, SharedPlanOverlay, UserPreferences } from '@/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Persönliches Urlaubs-Widget · Urlaubsplaner',
  robots: { index: false, follow: false },
}

interface PersonalEmbedProps {
  params: Promise<{ token: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function NotFoundCard() {
  return (
    <div className="min-h-screen bg-card p-6 text-card-foreground flex items-center justify-center">
      <div className="max-w-sm rounded-xl border bg-background p-5 text-center space-y-2 text-xs">
        <p className="font-semibold text-sm text-foreground">Widget nicht gefunden</p>
        <p className="text-muted-foreground">
          Dieser persönliche Widget-Link ist ungültig oder wurde vom Eigentümer widerrufen.
        </p>
      </div>
    </div>
  )
}

export default async function EmbedPersonalWidgetPage({
  params,
  searchParams,
}: PersonalEmbedProps) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) {
    return <NotFoundCard />
  }

  const widget = await prisma.calendarWidget.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          preferences: true,
        },
      },
    },
  })

  if (!widget) {
    return <NotFoundCard />
  }

  const query = searchParams ? await searchParams : {}
  const rawYearParam = Array.isArray(query.year) ? query.year[0] : query.year
  const parsedQueryYear = Number(rawYearParam)
  const currentYear = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(new Date()),
  )
  const targetYear =
    Number.isInteger(parsedQueryYear) && parsedQueryYear >= 2020 && parsedQueryYear <= 2100
      ? parsedQueryYear
      : (widget.year ?? currentYear)

  const prefs = ((widget.user.preferences ?? {}) as UserPreferences) ?? {}
  const country = prefs.country ?? DEFAULT_COUNTRY
  const subdivision = prefs.subdivision ?? undefined
  const workDays =
    Array.isArray(prefs.workDays) && prefs.workDays.length > 0 ? prefs.workDays : DEFAULT_WORK_DAYS

  const reqHeaders = await headers()
  void recordWidgetView({
    widgetType: 'personal',
    region: (subdivision || country).toLowerCase(),
    referer: reqHeaders.get('referer'),
    host: reqHeaders.get('x-forwarded-host') ?? reqHeaders.get('host'),
    personalWidgetId: widget.id,
  })

  const rawEntries = await prisma.vacationEntry.findMany({
    where: { userId: widget.userId, year: targetYear },
    select: { date: true, type: true, title: true },
    orderBy: { date: 'asc' },
  })

  let publicHolidays: Holiday[] = []
  let schoolHolidays: Holiday[] = []
  const needHolidays =
    widget.includePublicHolidays ||
    widget.includeBridgeDays ||
    widget.includeSchoolHolidays ||
    widget.showStats

  if (needHolidays) {
    try {
      const group = widget.includeSchoolHolidays
        ? await resolveSchoolGroup(country, subdivision, prefs.holidayGroup).catch(() => undefined)
        : undefined

      ;[publicHolidays, schoolHolidays] = await Promise.all([
        widget.includePublicHolidays || widget.includeBridgeDays || widget.showStats
          ? fetchHolidays(country, subdivision, targetYear, 'public').catch(() => [] as Holiday[])
          : Promise.resolve([] as Holiday[]),
        widget.includeSchoolHolidays
          ? fetchHolidays(country, subdivision, targetYear, 'school', group).catch(() => [] as Holiday[])
          : Promise.resolve([] as Holiday[]),
      ])
    } catch {
      publicHolidays = []
      schoolHolidays = []
    }
  }

  const effectivePublicHolidays =
    country === 'DE' && !subdivision
      ? publicHolidays.filter(h => h.nationwide)
      : publicHolidays

  const bridgeDays = widget.includeBridgeDays
    ? detectBridgeDays(targetYear, effectivePublicHolidays, workDays)
    : []

  const personalEntries: PublicPersonalEntry[] = []
  for (const row of rawEntries) {
    const type = row.type as EntryType
    if (type === 'vacation' && !widget.includeVacations) continue
    if (type === 'gleittag' && !widget.includeGleittage) continue
    if (type === 'special' && !widget.includeSpecial) continue
    if (type === 'note' && !widget.includeNotes) continue

    personalEntries.push({
      date: row.date.toISOString().slice(0, 10),
      type,
      title: widget.includeNoteTitles ? row.title : null,
    })
  }

  const personalSharedByDate: Record<string, PublicSharedDayItem[]> = {}
  if (widget.includeSharedOverlays && Array.isArray(prefs.sharedOverlays) && prefs.sharedOverlays.length > 0) {
    const selectedIds = widget.sharedOverlayIds
    const overlays: SharedPlanOverlay[] =
      selectedIds.length > 0
        ? prefs.sharedOverlays.filter(o => selectedIds.includes(o.id))
        : prefs.sharedOverlays.filter(o => o.enabled !== false)

    for (const overlay of overlays) {
      let resolved: Array<{ date: string; type: string; title?: string | null }> = overlay.entries ?? []
      if (overlay.token) {
        try {
          if (overlay.token.startsWith('g_')) {
            const setting = await prisma.systemSetting.findUnique({
              where: { key: `guest_share:${overlay.token}` },
            })
            const record = setting?.value as unknown as {
              includeNotes?: boolean
              entries?: Array<{ date: string; type: string; title?: string | null }>
            } | undefined
            if (record?.entries) {
              resolved = record.entries.filter(e => record.includeNotes || e.type !== 'note')
            }
          } else {
            const share = await prisma.planShare.findUnique({
              where: { token: overlay.token },
              select: {
                token: true,
                includeNotes: true,
                user: {
                  select: {
                    vacations: {
                      where: { year: targetYear },
                      select: { date: true, type: true, title: true },
                    },
                  },
                },
              },
            })
            if (share) {
              resolved = share.user.vacations
                .filter(v => share.includeNotes || v.type !== 'note')
                .map(v => ({
                  date: v.date.toISOString().slice(0, 10),
                  type: v.type,
                  title: v.title,
                }))
            }
          }
        } catch {
          // Fall back to snapshot
        }
      }

      for (const item of resolved) {
        const key = item.date.slice(0, 10)
        if (!key.startsWith(`${targetYear}-`)) continue
        const arr = personalSharedByDate[key] ?? []
        arr.push({
          label: overlay.label,
          color: overlay.color,
          type: item.type,
          title: widget.includeNoteTitles ? item.title : null,
        })
        personalSharedByDate[key] = arr
      }
    }
  }

  const budget = vacationBudget(prefs, targetYear)
  const accountingSummary = summarizeVacation(
    rawEntries.map(r => ({ date: r.date.toISOString().slice(0, 10), type: r.type })),
    budget,
    {
      holidayDates: holidayDateSet(effectivePublicHolidays),
      halfDaysChristmas: prefs.halfDaysChristmas ?? true,
      countWeekendsAsVacation: prefs.countWeekendsAsVacation ?? false,
      workDays,
    },
  )

  const personalStats = widget.showStats
    ? {
        vacationDays: widget.includeVacations ? accountingSummary.used : 0,
        gleittagDays: personalEntries.filter(e => e.type === 'gleittag').length,
        specialDays: personalEntries.filter(e => e.type === 'special').length,
        noteCount: personalEntries.filter(e => e.type === 'note').length,
        budgetTotal: budget,
      }
    : undefined

  const regionLabel = subdivision || country
  const plannerHref = buildPlannerHref({ year: targetYear, country, subdivision })

  if (widget.viewMode === 'list') {
    const typeLabel: Record<EntryType, string> = {
      vacation: 'Urlaub',
      gleittag: 'Gleittag',
      special: 'Sonderurlaub',
      note: 'Notiz',
    }
    const typeStyle: Record<EntryType, string> = {
      vacation: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
      gleittag: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
      special: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
      note: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    }

    return (
      <div className="min-h-screen bg-card p-4 text-card-foreground flex flex-col justify-between gap-4 text-xs">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
            <div>
              <h1 className="text-base font-bold text-foreground flex items-center gap-1.5">
                <CalendarHeart className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>
                  {widget.name} ({targetYear})
                </span>
              </h1>
              <p className="text-[11px] text-muted-foreground">Region: {regionLabel}</p>
            </div>
            {personalStats && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-blue-500/10 px-2 py-1 font-semibold text-blue-700 dark:text-blue-300">
                  Urlaub: {formatDays(personalStats.vacationDays)}/{budget} UT
                </span>
                {personalStats.gleittagDays > 0 && (
                  <span className="rounded-md bg-teal-500/10 px-2 py-1 font-semibold text-teal-700 dark:text-teal-300">
                    Gleittage: {personalStats.gleittagDays}
                  </span>
                )}
              </div>
            )}
          </div>

          {personalEntries.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Keine freigegebenen Einträge für {targetYear} vorhanden.
            </p>
          ) : (
            <div className="divide-y rounded-xl border bg-background">
              {personalEntries.map((entry, idx) => (
                <div
                  key={`${entry.date}-${entry.type}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">
                      {format(parseISO(entry.date), 'EEE, dd.MM.yyyy', { locale: de })}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeStyle[entry.type]}`}>
                      {entry.type === 'note' && <StickyNote className="h-2.5 w-2.5" aria-hidden="true" />}
                      {typeLabel[entry.type]}
                    </span>
                  </div>
                  {entry.title && (
                    <span className="text-muted-foreground truncate max-w-xs">{entry.title}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {widget.includePublicHolidays && effectivePublicHolidays.length > 0 && (
            <div className="rounded-xl border bg-background p-3 space-y-1.5">
              <h2 className="font-semibold text-[11px] text-emerald-700 dark:text-emerald-300">
                Gesetzliche Feiertage {targetYear} ({regionLabel})
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {effectivePublicHolidays.map((h, idx) => (
                  <span key={`${h.startDate}-${idx}`} className="rounded border bg-emerald-500/10 px-2 py-0.5 text-[10px]">
                    <strong>{format(parseISO(h.startDate), 'dd.MM.')}</strong> {localizedName(h.name)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-2.5 text-[11px] text-muted-foreground">
          <span>Urlaubs-Widget von urlaubsplaner.me</span>
          <Link href={plannerHref} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary underline font-medium">
            <Calendar className="h-3.5 w-3.5" />
            Urlaubsplaner öffnen
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-card p-3 text-card-foreground text-xs">
      <PublicYearCalendar
        year={targetYear}
        regionName={regionLabel}
        regionSlug={regionLabel.toLowerCase()}
        mode="personal"
        title={`${widget.name} (${targetYear})`}
        subtitle={`Persönlicher Urlaubsüberblick · Region ${regionLabel}`}
        publicHolidays={widget.includePublicHolidays ? effectivePublicHolidays : []}
        schoolHolidays={widget.includeSchoolHolidays ? schoolHolidays : []}
        bridgeDays={bridgeDays}
        personalEntries={personalEntries}
        personalSharedByDate={personalSharedByDate}
        personalStats={personalStats}
        showLegend={widget.showLegend}
        plannerHref={plannerHref}
        isEmbed
      />
    </div>
  )
}
