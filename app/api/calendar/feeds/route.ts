import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { jsonError, readJson, validOrigin } from '@/lib/request'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return jsonError('Nicht angemeldet.', 401)

  const feeds = await prisma.calendarFeed.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ feeds }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Nicht angemeldet.', 401)

  const existingCount = await prisma.calendarFeed.count({
    where: { userId: session.user.id },
  })
  if (existingCount >= 15) {
    return jsonError('Du kannst maximal 15 separate Kalender-Abos anlegen.', 400)
  }

  const body = await readJson(request)
  const rawName = typeof body?.name === 'string' ? body.name.trim().slice(0, 60) : ''
  const name = rawName || `Kalender-Abo ${existingCount + 2}`

  const feed = await prisma.calendarFeed.create({
    data: {
      userId: session.user.id,
      name,
      token: randomBytes(32).toString('base64url'),
      includeVacations: body?.includeVacations !== undefined ? Boolean(body.includeVacations) : true,
      includeGleittage: body?.includeGleittage !== undefined ? Boolean(body.includeGleittage) : true,
      includeNotes: Boolean(body?.includeNotes),
      includeNoteTitles: body?.includeNoteTitles !== undefined ? Boolean(body.includeNoteTitles) : true,
      includePublicHolidays: Boolean(body?.includePublicHolidays),
      includeSchoolHolidays: Boolean(body?.includeSchoolHolidays),
      includeBridgeDays: Boolean(body?.includeBridgeDays),
    },
  })

  return NextResponse.json({ feed }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Nicht angemeldet.', 401)

  const body = await readJson(request)
  if (!body) return jsonError('Ungültige Anfrage.', 400)
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return jsonError('Ungültige Abo-ID.', 400)

  const existing = await prisma.calendarFeed.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) return jsonError('Kalender-Abo nicht gefunden.', 404)

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string') {
    const clean = body.name.trim().slice(0, 60)
    if (clean) data.name = clean
  }
  if (typeof body.includeVacations === 'boolean') data.includeVacations = body.includeVacations
  if (typeof body.includeGleittage === 'boolean') data.includeGleittage = body.includeGleittage
  if (typeof body.includeNotes === 'boolean') data.includeNotes = body.includeNotes
  if (typeof body.includeNoteTitles === 'boolean') data.includeNoteTitles = body.includeNoteTitles
  if (typeof body.includePublicHolidays === 'boolean') data.includePublicHolidays = body.includePublicHolidays
  if (typeof body.includeSchoolHolidays === 'boolean') data.includeSchoolHolidays = body.includeSchoolHolidays
  if (typeof body.includeBridgeDays === 'boolean') data.includeBridgeDays = body.includeBridgeDays
  if (body.rotateToken === true) {
    data.token = randomBytes(32).toString('base64url')
  }

  const feed = await prisma.calendarFeed.update({
    where: { id: existing.id },
    data,
  })

  return NextResponse.json({ feed }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Nicht angemeldet.', 401)

  const body = await readJson(request)
  if (!body) return jsonError('Ungültige Anfrage.', 400)
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return jsonError('Ungültige Abo-ID.', 400)

  const deleted = await prisma.calendarFeed.deleteMany({
    where: { id, userId: session.user.id },
  })
  if (deleted.count !== 1) return jsonError('Kalender-Abo nicht gefunden.', 404)

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
