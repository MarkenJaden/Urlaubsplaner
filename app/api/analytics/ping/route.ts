import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawVisitorId = typeof body?.visitorId === 'string' ? body.visitorId.trim().slice(0, 80) : ''
    if (!rawVisitorId || rawVisitorId.length < 6) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const session = await auth()
    const isRegistered = Boolean(session?.user?.id)
    const country = typeof body?.country === 'string' ? body.country.trim().slice(0, 8) : null
    const subdivision = typeof body?.subdivision === 'string' ? body.subdivision.trim().slice(0, 20) : null
    const plannedDays = typeof body?.plannedDaysCount === 'number' && Number.isFinite(body.plannedDaysCount)
      ? Math.max(0, Math.min(366, Math.round(body.plannedDaysCount)))
      : 0

    const todayKey = format(new Date(), 'yyyy-MM-dd')

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
        userId: session?.user?.id ?? null,
        isRegistered,
        country,
        subdivision,
        plannedDays,
        pageViews: 1,
      },
      update: {
        lastSeenAt: new Date(),
        userId: session?.user?.id ?? existingVisitor?.userId ?? null,
        isRegistered: isRegistered || existingVisitor?.isRegistered || false,
        country: country ?? existingVisitor?.country,
        subdivision: subdivision ?? existingVisitor?.subdivision,
        plannedDays,
        pageViews: { increment: 1 },
      },
    })

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
        pageViews: { increment: 1 },
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

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
