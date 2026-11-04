import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

function sanitizePath(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const clean = input.split('?')[0].split('#')[0].trim().slice(0, 120)
  if (!clean.startsWith('/')) return null
  return clean
}

function sanitizeDeviceType(input: unknown): 'mobile' | 'tablet' | 'desktop' | null {
  if (input === 'mobile' || input === 'tablet' || input === 'desktop') return input
  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawVisitorId = typeof body?.visitorId === 'string' ? body.visitorId.trim().slice(0, 80) : ''
    if (!rawVisitorId || rawVisitorId.length < 6) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const now = new Date()
    const session = await auth()
    const userId = session?.user?.id || null
    const isRegistered = Boolean(userId)

    // Keep User.lastActiveAt fresh whenever a signed-in user pings from any page
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: now },
      }).catch(() => undefined)
    }

    const currentPath = sanitizePath(body?.path)
    // Skip public visitor counting for the Admin Dashboard itself so live analytics stay accurate
    if (currentPath?.startsWith('/admin')) {
      return NextResponse.json({ ok: true })
    }

    const isHeartbeat = Boolean(body?.heartbeat)
    const country = typeof body?.country === 'string' && body.country.trim() ? body.country.trim().slice(0, 8) : null
    const subdivision = typeof body?.subdivision === 'string' && body.subdivision.trim() ? body.subdivision.trim().slice(0, 20) : null
    const deviceType = sanitizeDeviceType(body?.deviceType)
    const hasPlannedDays = typeof body?.plannedDaysCount === 'number' && Number.isFinite(body.plannedDaysCount)
    const plannedDays = hasPlannedDays
      ? Math.max(0, Math.min(366, Math.round(body.plannedDaysCount)))
      : undefined

    const todayKey = format(now, 'yyyy-MM-dd')

    const existingVisitor = await prisma.analyticsVisitor.findUnique({
      where: { visitorId: rawVisitorId },
    })

    const isNewToday =
      !existingVisitor ||
      format(existingVisitor.lastSeenAt, 'yyyy-MM-dd') !== todayKey

    await prisma.analyticsVisitor.upsert({
      where: { visitorId: rawVisitorId },
      create: {
        visitorId: rawVisitorId,
        userId,
        isRegistered,
        country,
        subdivision,
        deviceType,
        currentPath: currentPath ?? '/',
        plannedDays: plannedDays ?? 0,
        firstSeenAt: now,
        lastSeenAt: now,
        pageViews: 1,
      },
      update: {
        lastSeenAt: now,
        userId: userId ?? existingVisitor?.userId ?? null,
        isRegistered: isRegistered || existingVisitor?.isRegistered || false,
        country: country ?? existingVisitor?.country,
        subdivision: subdivision ?? existingVisitor?.subdivision,
        deviceType: deviceType ?? existingVisitor?.deviceType,
        currentPath: currentPath ?? existingVisitor?.currentPath,
        ...(plannedDays !== undefined ? { plannedDays } : {}),
        ...(!isHeartbeat ? { pageViews: { increment: 1 } } : {}),
      },
    })

    if (!isHeartbeat || isNewToday) {
      await prisma.analyticsDaily.upsert({
        where: { date: todayKey },
        create: {
          date: todayKey,
          pageViews: 1,
          totalVisitors: 1,
          authedVisitors: isRegistered ? 1 : 0,
          guestVisitors: isRegistered ? 0 : 1,
        },
        update: {
          ...(!isHeartbeat ? { pageViews: { increment: 1 } } : {}),
          ...(isNewToday
            ? {
                totalVisitors: { increment: 1 },
                ...(isRegistered
                  ? { authedVisitors: { increment: 1 } }
                  : { guestVisitors: { increment: 1 } }),
              }
            : {}),
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
