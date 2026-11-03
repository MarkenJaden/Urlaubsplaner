import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseEntry } from '@/lib/preferences'
import { jsonError, readJson, validOrigin } from '@/lib/request'
import type { UserPreferences } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return jsonError('Ungültiger Link.', 404)

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const yearFilter = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined

  const share = await prisma.planShare.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          name: true,
          username: true,
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

  const share = await prisma.planShare.findUnique({ where: { token } })
  if (!share) return jsonError('Geteilter Plan nicht gefunden.', 404)
  if (share.permission !== 'edit') return jsonError('Dieser Link erlaubt nur Lesezugriff.', 403)

  const body = await readJson(request)
  if (!body) return jsonError('Ungültige Anfrage.')

  const action = body.action === 'remove' ? 'remove' : 'toggle'
  const parsed = parseEntry(body)
  if (!parsed) return jsonError('Ungültiger Eintrag.')
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
