import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { validOrigin, readJson, jsonError } from '@/lib/request'

const MAX_WIDGETS = 15

function parseOptionalYear(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null || raw === '') return null
  const num = Number(raw)
  if (Number.isInteger(num) && num >= 2020 && num <= 2100) return num
  return undefined
}

function sanitizeOverlayIds(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && item.length <= 80)
    .map(item => item.trim())
    .slice(0, 30)
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const widgets = await prisma.calendarWidget.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ widgets })
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const count = await prisma.calendarWidget.count({ where: { userId: session.user.id } })
  if (count >= MAX_WIDGETS) {
    return NextResponse.json(
      { error: `Es können maximal ${MAX_WIDGETS} persönliche Widgets angelegt werden.` },
      { status: 400 },
    )
  }

  const body = await readJson(request)
  if (!body) return jsonError('Ungültige Eingabe.')

  const rawName = typeof body.name === 'string' ? body.name.trim() : ''
  const name = rawName.length >= 1 && rawName.length <= 60 ? rawName : 'Mein Widget'
  const parsedYear = parseOptionalYear(body.year)
  const year = parsedYear === undefined ? null : parsedYear
  const viewMode = body.viewMode === 'list' ? 'list' : 'calendar'
  const sharedOverlayIds = sanitizeOverlayIds(body.sharedOverlayIds) ?? []

  const token = randomBytes(32).toString('base64url')

  const widget = await prisma.calendarWidget.create({
    data: {
      userId: session.user.id,
      token,
      name,
      year,
      viewMode,
      includeVacations: body.includeVacations !== false,
      includeGleittage: body.includeGleittage !== false,
      includeSpecial: body.includeSpecial !== false,
      includeNotes: Boolean(body.includeNotes),
      includeNoteTitles: Boolean(body.includeNoteTitles),
      includePublicHolidays: body.includePublicHolidays !== false,
      includeSchoolHolidays: body.includeSchoolHolidays !== false,
      includeBridgeDays: Boolean(body.includeBridgeDays),
      includeSharedOverlays: Boolean(body.includeSharedOverlays),
      sharedOverlayIds,
      showLegend: body.showLegend !== false,
      showStats: body.showStats !== false,
    },
  })

  return NextResponse.json({ widget }, { status: 201 })
}

export async function PATCH(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const body = await readJson(request)
  if (!body || typeof body.id !== 'string') return jsonError('Widget-ID fehlt.')

  const existing = await prisma.calendarWidget.findFirst({
    where: { id: body.id, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Widget nicht gefunden.' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim()
    if (trimmed.length >= 1 && trimmed.length <= 60) data.name = trimmed
  }
  const parsedYear = parseOptionalYear(body.year)
  if (parsedYear !== undefined) data.year = parsedYear
  if (body.viewMode === 'calendar' || body.viewMode === 'list') data.viewMode = body.viewMode

  const boolKeys = [
    'includeVacations',
    'includeGleittage',
    'includeSpecial',
    'includeNotes',
    'includeNoteTitles',
    'includePublicHolidays',
    'includeSchoolHolidays',
    'includeBridgeDays',
    'includeSharedOverlays',
    'showLegend',
    'showStats',
  ] as const

  for (const key of boolKeys) {
    if (typeof body[key] === 'boolean') data[key] = body[key]
  }

  const overlayIds = sanitizeOverlayIds(body.sharedOverlayIds)
  if (overlayIds !== undefined) data.sharedOverlayIds = overlayIds

  if (body.regenerateToken === true) {
    data.token = randomBytes(32).toString('base64url')
  }

  const widget = await prisma.calendarWidget.update({
    where: { id: existing.id },
    data,
  })

  return NextResponse.json({ widget })
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  let id = searchParams.get('id')
  if (!id) {
    const body = await readJson(request).catch(() => null)
    if (body && typeof body.id === 'string') id = body.id
  }
  if (!id) return jsonError('Widget-ID fehlt.')

  const result = await prisma.calendarWidget.deleteMany({
    where: { id, userId: session.user.id },
  })
  if (result.count === 0) {
    return NextResponse.json({ error: 'Widget nicht gefunden.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
