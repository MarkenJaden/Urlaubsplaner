import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/user'
import { isUserAdmin, canClaimInitialAdmin } from '@/lib/admin'
import { subDays } from 'date-fns'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const user = await getUserFromSession(session)
  const admin = isUserAdmin(user)
  if (!admin) {
    const claimable = await canClaimInitialAdmin()
    return NextResponse.json(
      { error: 'Kein Admin-Zugriff.', canClaimAdmin: claimable },
      { status: 403 }
    )
  }

  const now = new Date()
  const sevenDaysAgo = subDays(now, 7)
  const thirtyDaysAgo = subDays(now, 30)

  const [
    totalRegisteredUsers,
    activeRegisteredUsers,
    totalSavedEntries,
    vacationEntriesCount,
    gleittagEntriesCount,
    noteEntriesCount,
    totalShares,
    totalVisitors,
    unregisteredGuests,
    guestsWithPlans,
    activeVisitors7d,
    activeVisitors30d,
    guestDaysAgg,
    dailyStats,
    contactMessages,
    visitorRegions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { vacations: { some: {} } } }),
    prisma.vacationEntry.count(),
    prisma.vacationEntry.count({ where: { type: 'vacation' } }),
    prisma.vacationEntry.count({ where: { type: 'gleittag' } }),
    prisma.vacationEntry.count({ where: { type: 'note' } }),
    prisma.planShare.count(),
    prisma.analyticsVisitor.count(),
    prisma.analyticsVisitor.count({ where: { isRegistered: false } }),
    prisma.analyticsVisitor.count({ where: { isRegistered: false, plannedDays: { gt: 0 } } }),
    prisma.analyticsVisitor.count({ where: { lastSeenAt: { gte: sevenDaysAgo } } }),
    prisma.analyticsVisitor.count({ where: { lastSeenAt: { gte: thirtyDaysAgo } } }),
    prisma.analyticsVisitor.aggregate({
      where: { isRegistered: false },
      _sum: { plannedDays: true },
    }),
    prisma.analyticsDaily.findMany({
      orderBy: { date: 'desc' },
      take: 30,
    }),
    prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.analyticsVisitor.groupBy({
      by: ['subdivision'],
      _count: { subdivision: true },
      where: { subdivision: { not: null } },
      orderBy: { _count: { subdivision: 'desc' } },
      take: 10,
    }),
  ])

  return NextResponse.json({
    overview: {
      totalRegisteredUsers,
      activeRegisteredUsers,
      unregisteredGuests,
      guestsWithPlans,
      totalUsersCombined: totalRegisteredUsers + unregisteredGuests,
      totalVisitors,
      activeVisitors7d,
      activeVisitors30d,
      totalSavedEntries,
      vacationEntriesCount,
      gleittagEntriesCount,
      noteEntriesCount,
      totalGuestPlannedDays: guestDaysAgg._sum?.plannedDays ?? 0,
      totalShares,
    },
    regions: visitorRegions.map(r => ({
      subdivision: r.subdivision ?? 'Unbekannt',
      count: r._count.subdivision,
    })),
    dailyStats: [...dailyStats].reverse().map(d => ({
      date: d.date,
      pageViews: d.pageViews,
      uniqueVisitors: d.totalVisitors,
      registeredUsers: d.authedVisitors,
      guestUsers: d.guestVisitors,
    })),
    contactMessages: contactMessages.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      subject: m.subject,
      message: m.message,
      isRead: m.status === 'read',
      createdAt: m.createdAt,
    })),
    umamiUrl: 'https://umami.urlaubsplaner.me',
  })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const user = await getUserFromSession(session)
  const body = await request.json()

  if (body?.action === 'claim_admin') {
    const claimable = await canClaimInitialAdmin()
    if (!claimable && !isUserAdmin(user)) {
      return NextResponse.json({ error: 'Es existiert bereits ein Administrator.' }, { status: 403 })
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true },
    })
    return NextResponse.json({ ok: true })
  }

  if (!isUserAdmin(user)) {
    return NextResponse.json({ error: 'Kein Admin-Zugriff.' }, { status: 403 })
  }

  if (body?.action === 'toggle_message_read' && typeof body.id === 'string') {
    await prisma.contactMessage.update({
      where: { id: body.id },
      data: { status: body.isRead ? 'read' : 'open' },
    })
    return NextResponse.json({ ok: true })
  }

  if (body?.action === 'delete_message' && typeof body.id === 'string') {
    await prisma.contactMessage.delete({
      where: { id: body.id },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ungültige Aktion.' }, { status: 400 })
}
