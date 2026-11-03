import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { jsonError, readJson, validOrigin } from '@/lib/request'

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
  if (!session?.user?.id) return jsonError('Unauthorized', 401)

  const body = await readJson(request)
  if (!body) return jsonError('Ungültige Daten.')

  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 60) : 'Mein Urlaubsplan'
  const permission = body.permission === 'edit' ? 'edit' : 'view'
  const includeNotes = Boolean(body.includeNotes)
  const color = typeof body.color === 'string' && ALLOWED_COLORS.includes(body.color) ? body.color : '#10b981'

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

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return jsonError('ID fehlt.')

  const share = await prisma.planShare.findUnique({ where: { id } })
  if (!share || share.userId !== session.user.id) return jsonError('Nicht gefunden.', 404)

  await prisma.planShare.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
