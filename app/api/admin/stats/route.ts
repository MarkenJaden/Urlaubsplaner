import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/user'
import {
  isUserAdmin,
  getSafeAdminOAuthSettings,
  saveAdminOAuthSettings,
} from '@/lib/admin'
import { validOrigin } from '@/lib/request'
import { subDays } from 'date-fns'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const user = await getUserFromSession(session)
  const admin = isUserAdmin(user)
  if (!admin) {
    return NextResponse.json(
      {
        error:
          'Zugriff verweigert. Nur das Administrator-Konto („markenjaden“) hat Zugriff auf das Admin-Dashboard.',
      },
      { status: 403 }
    )
  }

  if (!user.isAdmin) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true },
    }).catch(() => undefined)
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
    oauthSettings,
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
    getSafeAdminOAuthSettings(),
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
    oauthSettings,
    umamiUrl: 'https://umami.urlaubsplaner.me',
  })
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 403 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const user = await getUserFromSession(session)
  if (!isUserAdmin(user)) {
    return NextResponse.json(
      { error: 'Zugriff verweigert. Nur für „markenjaden“ freigegeben.' },
      { status: 403 }
    )
  }

  const body = await request.json()

  if (body?.action === 'save_oauth' && body.oauth && typeof body.oauth === 'object') {
    await saveAdminOAuthSettings({
      googleEnabled: Boolean(body.oauth.googleEnabled),
      googleClientId: typeof body.oauth.googleClientId === 'string' ? body.oauth.googleClientId : '',
      googleClientSecret:
        typeof body.oauth.googleClientSecret === 'string' ? body.oauth.googleClientSecret : undefined,
      githubEnabled: Boolean(body.oauth.githubEnabled),
      githubClientId: typeof body.oauth.githubClientId === 'string' ? body.oauth.githubClientId : '',
      githubClientSecret:
        typeof body.oauth.githubClientSecret === 'string' ? body.oauth.githubClientSecret : undefined,
    })
    const oauthSettings = await getSafeAdminOAuthSettings()
    return NextResponse.json({ ok: true, oauthSettings })
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
