import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseEntry, parsePreferences } from '@/lib/preferences'
import { jsonError, readJson, validOrigin } from '@/lib/request'
import { publishPlanUpdate } from '@/lib/realtime-hub'
import { DEFAULT_WORK_DAYS } from '@/lib/vacation-accounting'
import type { UserPreferences } from '@/types'

export const dynamic = 'force-dynamic'

interface GuestShareRecord {
  id: string
  token: string
  ownerSecret: string
  label: string
  permission: 'view' | 'edit'
  includeNotes: boolean
  color: string
  ownerName: string
  preferences?: UserPreferences
  entries: Array<{ id?: string; date: string; type: string; title?: string | null; year?: number }>
  createdAt: string
  updatedAt: string
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return jsonError('Ungültiger Link.', 404)

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const yearFilter = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined

  // Handle Guest Live Share token
  if (token.startsWith('g_')) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: `guest_share:${token}` },
    })
    const record = setting?.value as unknown as GuestShareRecord | undefined
    if (!record || !record.token) {
      return jsonError('Geteilter Plan nicht gefunden oder widerrufen.', 404)
    }
    const prefs = (record.preferences ?? {}) as UserPreferences
    const entries = (record.entries ?? [])
      .filter(e => (record.includeNotes || e.type !== 'note') && (!yearFilter || e.date.startsWith(`${yearFilter}-`)))
      .map((e, i) => ({
        id: e.id ?? `ge-${i}-${e.date.slice(0, 10)}`,
        date: e.date.slice(0, 10),
        type: e.type,
        title: e.title ?? null,
        year: e.year ?? Number(e.date.slice(0, 4)),
      }))

    return NextResponse.json(
      {
        id: record.id,
        token: record.token,
        label: record.label,
        color: record.color,
        permission: record.permission,
        includeNotes: record.includeNotes,
        ownerName: record.ownerName || 'Gast',
        country: prefs.country ?? 'DE',
        subdivision: prefs.subdivision,
        workDays: prefs.workDays ?? DEFAULT_WORK_DAYS,
        vacationDays: prefs.vacationDays ?? 30,
        vacationDaysPerYear: prefs.vacationDaysPerYear ?? {},
        halfDaysChristmas: prefs.halfDaysChristmas ?? true,
        countWeekendsAsVacation: prefs.countWeekendsAsVacation ?? false,
        updatedAt: record.updatedAt ?? setting?.updatedAt.toISOString(),
        entries,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const share = await prisma.planShare.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          name: true,
          username: true,
          updatedAt: true,
          preferences: true,
          vacations: {
            where: yearFilter ? { year: yearFilter } : undefined,
            orderBy: { date: 'asc' },
          },
        },
      },
    },
  })

  if (!share) return jsonError('Geteilter Plan nicht gefunden oder widerrufen.', 404)

  const prefs = (share.user.preferences ?? {}) as UserPreferences
  const entries = share.user.vacations
    .filter(e => share.includeNotes || e.type !== 'note')
    .map(e => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      type: e.type,
      title: e.title,
      year: e.year,
    }))

  const latestTimestamp = Math.max(
    share.updatedAt.getTime(),
    share.user.updatedAt.getTime(),
    ...share.user.vacations.map(v => v.updatedAt.getTime()),
  )

  return NextResponse.json(
    {
      id: share.id,
      token: share.token,
      label: share.label,
      color: share.color,
      permission: share.permission,
      includeNotes: share.includeNotes,
      ownerName: share.user.name || share.user.username || 'Geteilter Plan',
      country: prefs.country ?? 'DE',
      subdivision: prefs.subdivision,
      workDays: prefs.workDays ?? DEFAULT_WORK_DAYS,
      vacationDays: prefs.vacationDays ?? 30,
      vacationDaysPerYear: prefs.vacationDaysPerYear ?? {},
      halfDaysChristmas: prefs.halfDaysChristmas ?? true,
      countWeekendsAsVacation: prefs.countWeekendsAsVacation ?? false,
      updatedAt: new Date(latestTimestamp).toISOString(),
      entries,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return jsonError('Ungültiger Link.', 404)

  const body = await readJson(request)
  if (!body) return jsonError('Ungültige Anfrage.')

  const action = body.action === 'remove' ? 'remove' : 'toggle'
  const parsed = parseEntry(body)
  if (!parsed) return jsonError('Ungültiger Eintrag.')

  // Guest live share collaborative edit
  if (token.startsWith('g_')) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: `guest_share:${token}` },
    })
    const record = setting?.value as unknown as GuestShareRecord | undefined
    if (!record || !record.token) return jsonError('Geteilter Plan nicht gefunden.', 404)
    if (record.permission !== 'edit') return jsonError('Dieser Link erlaubt nur Lesezugriff.', 403)
    if (parsed.type === 'note' && !record.includeNotes) {
      return jsonError('Notizen sind für diesen geteilten Plan deaktiviert.', 403)
    }

    const dateStr = parsed.date.toISOString().slice(0, 10)
    const existingIdx = (record.entries ?? []).findIndex(
      e => e.date.slice(0, 10) === dateStr && e.type === parsed.type,
    )

    if (existingIdx >= 0 && (action === 'remove' || action === 'toggle')) {
      record.entries.splice(existingIdx, 1)
      record.updatedAt = new Date().toISOString()
      await prisma.systemSetting.update({
        where: { key: `guest_share:${token}` },
        data: { value: record as unknown as object },
      })
      publishPlanUpdate({ tokens: [token] })
      return NextResponse.json({ removed: true, date: dateStr, type: parsed.type })
    }

    const createdEntry = {
      id: `ge-${Date.now()}-${dateStr}-${parsed.type}`,
      date: dateStr,
      type: parsed.type,
      title: parsed.title ?? null,
      year: parsed.year,
    }
    record.entries = [...(record.entries ?? []), createdEntry].sort((a, b) => a.date.localeCompare(b.date))
    record.updatedAt = new Date().toISOString()

    await prisma.systemSetting.update({
      where: { key: `guest_share:${token}` },
      data: { value: record as unknown as object },
    })
    publishPlanUpdate({ tokens: [token] })
    return NextResponse.json({ added: true, entry: createdEntry })
  }

  const share = await prisma.planShare.findUnique({ where: { token } })
  if (!share) return jsonError('Geteilter Plan nicht gefunden.', 404)
  if (share.permission !== 'edit') return jsonError('Dieser Link erlaubt nur Lesezugriff.', 403)

  if (parsed.type === 'note' && !share.includeNotes) {
    return jsonError('Notizen sind für diesen geteilten Plan deaktiviert.', 403)
  }

  const existing = await prisma.vacationEntry.findUnique({
    where: {
      userId_date_type: {
        userId: share.userId,
        date: parsed.date,
        type: parsed.type,
      },
    },
  })

  if (existing && (action === 'remove' || action === 'toggle')) {
    await prisma.vacationEntry.delete({ where: { id: existing.id } })
    publishPlanUpdate({ userId: share.userId, tokens: [token] })
    return NextResponse.json({ removed: true, date: parsed.date.toISOString().slice(0, 10), type: parsed.type })
  }

  const created = await prisma.vacationEntry.create({
    data: {
      userId: share.userId,
      date: parsed.date,
      type: parsed.type,
      title: parsed.title,
      year: parsed.year,
    },
  })

  publishPlanUpdate({ userId: share.userId, tokens: [token] })

  return NextResponse.json({
    added: true,
    entry: {
      id: created.id,
      date: created.date.toISOString().slice(0, 10),
      type: created.type,
      title: created.title,
      year: created.year,
    },
  })
}

/**
 * Allows a guest owner to push real-time updates of their local calendar and preferences
 * to their active guest live share link.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const { token } = await params
  if (!token.startsWith('g_') || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return jsonError('Ungültiger Link.', 404)
  }

  const body = await readJson(request)
  if (!body || typeof body.ownerSecret !== 'string') return jsonError('Ungültige Anfrage.', 403)

  const setting = await prisma.systemSetting.findUnique({
    where: { key: `guest_share:${token}` },
  })
  const record = setting?.value as unknown as GuestShareRecord | undefined
  if (!record || record.ownerSecret !== body.ownerSecret) {
    return jsonError('Nicht autorisiert.', 403)
  }

  if (Array.isArray(body.entries)) {
    record.entries = body.entries
      .slice(0, 1000)
      .map(parseEntry)
      .filter((e): e is NonNullable<ReturnType<typeof parseEntry>> => Boolean(e))
      .map((e, i) => ({
        id: `ge-${i}-${e.date.toISOString().slice(0, 10)}-${e.type}`,
        date: e.date.toISOString().slice(0, 10),
        type: e.type,
        title: e.title ?? null,
        year: e.year,
      }))
  }

  if (body.preferences) {
    const validPrefs = parsePreferences(body.preferences)
    if (validPrefs) {
      record.preferences = { ...(record.preferences ?? {}), ...validPrefs } as UserPreferences
    }
  }

  record.updatedAt = new Date().toISOString()

  await prisma.systemSetting.update({
    where: { key: `guest_share:${token}` },
    data: { value: record as unknown as object },
  })

  publishPlanUpdate({ tokens: [token] })
  return NextResponse.json({ ok: true, updatedAt: record.updatedAt })
}
