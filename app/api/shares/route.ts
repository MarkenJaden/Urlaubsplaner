import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { parseEntry, parsePreferences } from '@/lib/preferences'
import { jsonError, readJson, validOrigin } from '@/lib/request'
import { publishPlanUpdate } from '@/lib/realtime-hub'

const ALLOWED_COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444']

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)
  const shares = await prisma.planShare.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(shares, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()

  const body = await readJson(request)
  if (!body) return jsonError('Ungültige Daten.')

  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 60) : 'Mein Urlaubsplan'
  const permission = body.permission === 'edit' ? 'edit' : 'view'
  const includeNotes = Boolean(body.includeNotes)
  const color = typeof body.color === 'string' && ALLOWED_COLORS.includes(body.color) ? body.color : '#10b981'

  // Logged-in account live share
  if (session?.user?.id) {
    const existingCount = await prisma.planShare.count({ where: { userId: session.user.id } })
    if (existingCount >= 15) return jsonError('Maximal 15 aktive Freigabe-Links pro Konto möglich.')

    const share = await prisma.planShare.create({
      data: {
        userId: session.user.id,
        token: randomBytes(24).toString('base64url'),
        label,
        permission,
        includeNotes,
        color,
      },
    })

    return NextResponse.json(share, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  }

  // Guest live share (persisted in SystemSetting so guests also get real-time live synchronization!)
  const token = `g_${randomBytes(20).toString('base64url')}`
  const ownerSecret = randomBytes(20).toString('base64url')
  const rawEntries = Array.isArray(body.entries) ? body.entries.slice(0, 1000) : []
  const validEntries = rawEntries
    .map(parseEntry)
    .filter((e): e is NonNullable<ReturnType<typeof parseEntry>> => Boolean(e))
    .map((e, i) => ({
      id: `ge-${i}-${e.date.toISOString().slice(0, 10)}-${e.type}`,
      date: e.date.toISOString().slice(0, 10),
      type: e.type,
      title: e.title ?? null,
      year: e.year,
    }))
  const validPrefs = parsePreferences(body.preferences ?? {}) ?? {}
  const nowIso = new Date().toISOString()

  const guestShareRecord = {
    id: token,
    token,
    ownerSecret,
    label,
    permission,
    includeNotes,
    color,
    ownerName: label,
    preferences: validPrefs,
    entries: validEntries,
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  await prisma.systemSetting.upsert({
    where: { key: `guest_share:${token}` },
    update: { value: guestShareRecord as object },
    create: { key: `guest_share:${token}`, value: guestShareRecord as object },
  })

  publishPlanUpdate({ tokens: [token] })

  return NextResponse.json(
    {
      id: token,
      token,
      ownerSecret,
      label,
      permission,
      includeNotes,
      color,
      createdAt: nowIso,
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const ownerSecret = searchParams.get('ownerSecret')
  if (!id) return jsonError('ID fehlt.')

  if (id.startsWith('g_') && ownerSecret) {
    const setting = await prisma.systemSetting.findUnique({ where: { key: `guest_share:${id}` } })
    const val = setting?.value as { ownerSecret?: string } | undefined
    if (!val || val.ownerSecret !== ownerSecret) return jsonError('Nicht gefunden.', 404)
    await prisma.systemSetting.delete({ where: { key: `guest_share:${id}` } })
    return NextResponse.json({ success: true })
  }

  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)

  const share = await prisma.planShare.findUnique({ where: { id } })
  if (!share || share.userId !== session.user.id) return jsonError('Nicht gefunden.', 404)

  await prisma.planShare.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
