import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/user'
import {
  isUserAdmin,
  getSafeAdminOAuthSettings,
  saveAdminOAuthSettings,
  getSafeAdminSmtpSettings,
  saveAdminSmtpSettings,
} from '@/lib/admin'
import {
  createRecoveryKey,
  hashPassword,
  hashRecoveryKey,
  normalizeOptionalEmail,
  normalizeUsername,
  validPassword,
} from '@/lib/password'
import {
  sendAdminBroadcastEmail,
  sendPasswordResetEmail,
  sendTestSmtpEmail,
} from '@/lib/mail'
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
          'Zugriff verweigert. Nur Administratoren haben Zugriff auf das Admin-Dashboard.',
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
  const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000)
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)
  const twentyFourHoursAgo = subDays(now, 1)
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
    activeVisitorsNowList,
    activeVisitors30m,
    activeVisitors24h,
    activeVisitors7d,
    activeVisitors30d,
    deviceBreakdown7d,
    guestDaysAgg,
    dailyStats,
    contactMessages,
    visitorRegions,
    visitorLastSeenByUser,
    oauthSettings,
    smtpSettings,
    usersList,
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
    prisma.analyticsVisitor.findMany({
      where: { lastSeenAt: { gte: threeMinutesAgo } },
      select: {
        visitorId: true,
        userId: true,
        isRegistered: true,
        currentPath: true,
        deviceType: true,
        subdivision: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    }),
    prisma.analyticsVisitor.count({ where: { lastSeenAt: { gte: thirtyMinutesAgo } } }),
    prisma.analyticsVisitor.count({ where: { lastSeenAt: { gte: twentyFourHoursAgo } } }),
    prisma.analyticsVisitor.count({ where: { lastSeenAt: { gte: sevenDaysAgo } } }),
    prisma.analyticsVisitor.count({ where: { lastSeenAt: { gte: thirtyDaysAgo } } }),
    prisma.analyticsVisitor.groupBy({
      by: ['deviceType'],
      _count: { visitorId: true },
      where: { lastSeenAt: { gte: sevenDaysAgo }, deviceType: { not: null } },
    }),
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
    prisma.analyticsVisitor.groupBy({
      by: ['userId'],
      _max: { lastSeenAt: true },
      where: { userId: { not: null } },
    }),
    getSafeAdminOAuthSettings(),
    getSafeAdminSmtpSettings(),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        _count: {
          select: {
            vacations: true,
            shares: true,
            calendarFeeds: true,
          },
        },
      },
    }),
  ])

  const visitorLastSeenMap = new Map<string, Date>()
  for (const row of visitorLastSeenByUser) {
    if (row.userId && row._max.lastSeenAt) {
      visitorLastSeenMap.set(row.userId, row._max.lastSeenAt)
    }
  }

  const mappedUsers = usersList.map(u => {
    const pingSeen = visitorLastSeenMap.get(u.id)
    const effectiveLastActive =
      u.lastActiveAt && pingSeen
        ? (u.lastActiveAt > pingSeen ? u.lastActiveAt : pingSeen)
        : (u.lastActiveAt ?? pingSeen ?? null)
    const isOnlineNow = Boolean(effectiveLastActive && effectiveLastActive >= threeMinutesAgo)

    return {
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      isAdmin: isUserAdmin(u),
      hasPassword: Boolean(u.passwordHash),
      googleLinked: Boolean(u.googleId || u.keycloakId.startsWith('google:')),
      githubLinked: Boolean(u.githubId || u.keycloakId.startsWith('github:')),
      vacationsCount: u._count.vacations,
      sharesCount: u._count.shares,
      feedsCount: u._count.calendarFeeds + 1,
      lastActiveAt: effectiveLastActive,
      isOnlineNow,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }
  })

  // Combine visitor pings in last 3m with signed-in accounts whose lastActiveAt is in last 3m (excluding current admin if only on /admin unless also browsing site)
  const activeGuestsNow = activeVisitorsNowList.filter(v => !v.isRegistered && !v.userId).length
  const onlineAuthedUserIds = new Set<string>(
    activeVisitorsNowList.map(v => v.userId).filter((id): id is string => Boolean(id))
  )
  for (const u of mappedUsers) {
    if (u.isOnlineNow && u.id !== user.id) {
      onlineAuthedUserIds.add(u.id)
    }
  }
  const activeAuthedNow = onlineAuthedUserIds.size
  const activeNow = activeGuestsNow + activeAuthedNow

  const pathCounts = new Map<string, number>()
  const liveDevices = { desktop: 0, mobile: 0, tablet: 0 }
  for (const v of activeVisitorsNowList) {
    const p = v.currentPath || '/'
    pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1)
    if (v.deviceType === 'mobile') liveDevices.mobile++
    else if (v.deviceType === 'tablet') liveDevices.tablet++
    else liveDevices.desktop++
  }

  const activePaths = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, count]) => ({ path, count }))

  const devices7d = { desktop: 0, mobile: 0, tablet: 0 }
  for (const row of deviceBreakdown7d) {
    if (row.deviceType === 'mobile') devices7d.mobile = row._count.visitorId
    else if (row.deviceType === 'tablet') devices7d.tablet = row._count.visitorId
    else if (row.deviceType === 'desktop') devices7d.desktop = row._count.visitorId
  }

  return NextResponse.json({
    currentAdminId: user.id,
    serverTimestamp: now.toISOString(),
    live: {
      activeNow,
      activeAuthedNow,
      activeGuestsNow,
      active30m: activeVisitors30m,
      active24h: activeVisitors24h,
      activePaths,
      liveDevices,
      devices7d,
    },
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
    users: mappedUsers,
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
    smtpSettings,
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
      { error: 'Zugriff verweigert. Nur für Administratoren freigegeben.' },
      { status: 403 }
    )
  }

  const body = await request.json()

  // 1. OAuth Configuration
  if (body?.action === 'save_oauth' && body.oauth && typeof body.oauth === 'object') {
    const oauthSettings = await saveAdminOAuthSettings({
      googleEnabled: Boolean(body.oauth.googleEnabled),
      googleClientId: typeof body.oauth.googleClientId === 'string' ? body.oauth.googleClientId : '',
      googleClientSecret:
        typeof body.oauth.googleClientSecret === 'string' ? body.oauth.googleClientSecret : undefined,
      githubEnabled: Boolean(body.oauth.githubEnabled),
      githubClientId: typeof body.oauth.githubClientId === 'string' ? body.oauth.githubClientId : '',
      githubClientSecret:
        typeof body.oauth.githubClientSecret === 'string' ? body.oauth.githubClientSecret : undefined,
    })
    return NextResponse.json({ ok: true, oauthSettings })
  }

  // 2. SMTP Configuration
  if (body?.action === 'save_smtp' && body.smtp && typeof body.smtp === 'object') {
    const smtpSettings = await saveAdminSmtpSettings({
      enabled: Boolean(body.smtp.enabled),
      host: typeof body.smtp.host === 'string' ? body.smtp.host : '',
      port: Number(body.smtp.port) || 587,
      secure: Boolean(body.smtp.secure),
      user: typeof body.smtp.user === 'string' ? body.smtp.user : '',
      pass: typeof body.smtp.pass === 'string' ? body.smtp.pass : undefined,
      fromEmail: typeof body.smtp.fromEmail === 'string' ? body.smtp.fromEmail : '',
      fromName: typeof body.smtp.fromName === 'string' ? body.smtp.fromName : 'Urlaubsplaner',
    })
    return NextResponse.json({ ok: true, smtpSettings })
  }

  // 3. Test SMTP Connection
  if (body?.action === 'test_smtp') {
    const to = normalizeOptionalEmail(body.to || user.email)
    if (!to) {
      return NextResponse.json(
        { error: 'Bitte gib eine gültige Empfänger-E-Mail-Adresse für die Test-Mail ein.' },
        { status: 400 }
      )
    }
    try {
      await sendTestSmtpEmail(to)
      return NextResponse.json({ ok: true, message: `Test-E-Mail erfolgreich an ${to} gesendet.` })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'SMTP-Verbindung fehlgeschlagen.' },
        { status: 502 }
      )
    }
  }

  // 4. User Management: Toggle Admin Role
  if (body?.action === 'toggle_user_admin' && typeof body.userId === 'string') {
    if (body.userId === user.id && !body.isAdmin) {
      return NextResponse.json(
        { error: 'Du kannst dir nicht selbst die Administrator-Rechte entziehen.' },
        { status: 400 }
      )
    }
    const target = await prisma.user.findUnique({ where: { id: body.userId } })
    if (!target) {
      return NextResponse.json({ error: 'Nutzer nicht gefunden.' }, { status: 404 })
    }
    if (target.username?.toLowerCase() === 'markenjaden' && !body.isAdmin) {
      return NextResponse.json(
        { error: 'Dem Haupt-Administrator „markenjaden“ können die Rechte nicht entzogen werden.' },
        { status: 400 }
      )
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { isAdmin: Boolean(body.isAdmin) },
    })
    return NextResponse.json({ ok: true })
  }

  // 5. User Management: Reset Password (direct or email link)
  if (body?.action === 'admin_reset_user_password' && typeof body.userId === 'string') {
    const target = await prisma.user.findUnique({ where: { id: body.userId } })
    if (!target) {
      return NextResponse.json({ error: 'Nutzer nicht gefunden.' }, { status: 404 })
    }

    if (body.mode === 'send_reset_link') {
      if (!target.email) {
        return NextResponse.json(
          { error: 'Dieser Nutzer hat keine E-Mail-Adresse hinterlegt. Setze stattdessen direkt ein neues Passwort.' },
          { status: 400 }
        )
      }
      const rawToken = createRecoveryKey()
      const resetTokenHash = hashRecoveryKey(rawToken)
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000)

      await prisma.user.update({
        where: { id: target.id },
        data: { resetTokenHash, resetTokenExpiresAt },
      })

      const origin = new URL(request.url).origin
      const resetUrl = `${origin}/recover?token=${encodeURIComponent(rawToken)}`
      try {
        await sendPasswordResetEmail({
          to: target.email,
          name: target.name || target.username,
          resetUrl,
        })
        return NextResponse.json({
          ok: true,
          message: `Link zum Zurücksetzen wurde an ${target.email} gesendet.`,
        })
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'E-Mail-Versand fehlgeschlagen.' },
          { status: 502 }
        )
      }
    }

    // Direct password assignment by admin
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    if (!validPassword(newPassword)) {
      return NextResponse.json(
        { error: 'Das neue Passwort muss zwischen 6 und 128 Zeichen lang sein.' },
        { status: 400 }
      )
    }

    const recoveryKey = createRecoveryKey()
    await prisma.user.update({
      where: { id: target.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        recoveryHash: hashRecoveryKey(recoveryKey),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        sessionVersion: { increment: 1 },
      },
    })

    return NextResponse.json({
      ok: true,
      message: `Passwort für ${target.username || target.email || target.name || 'Nutzer'} wurde neu gesetzt und alle aktiven Sitzungen abgemeldet.`,
    })
  }

  // 6. User Management: Edit User Details (email / username / name)
  if (body?.action === 'admin_update_user' && typeof body.userId === 'string') {
    const target = await prisma.user.findUnique({ where: { id: body.userId } })
    if (!target) return NextResponse.json({ error: 'Nutzer nicht gefunden.' }, { status: 404 })

    const email = normalizeOptionalEmail(body.email)
    if (email === undefined) {
      return NextResponse.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 })
    }
    const rawUsername = typeof body.username === 'string' ? body.username.trim() : ''
    const username = rawUsername ? normalizeUsername(rawUsername) : null
    if (rawUsername && !username) {
      return NextResponse.json(
        { error: 'Benutzername ungültig (3–32 Zeichen: a–z, 0–9, ., -, _).' },
        { status: 400 }
      )
    }

    if (email) {
      const conflict = await prisma.user.findFirst({
        where: { id: { not: target.id }, email: { equals: email, mode: 'insensitive' } },
      })
      if (conflict) {
        return NextResponse.json(
          { error: 'Diese E-Mail-Adresse ist bereits einem anderen Konto zugeordnet.' },
          { status: 409 }
        )
      }
    }

    try {
      await prisma.user.update({
        where: { id: target.id },
        data: {
          username,
          email,
          name: typeof body.name === 'string' ? body.name.trim().slice(0, 80) || null : target.name,
        },
      })
      return NextResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json({ error: 'Dieser Benutzername ist bereits vergeben.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 })
    }
  }

  // 7. User Management: Logout User Sessions
  if (body?.action === 'admin_logout_user' && typeof body.userId === 'string') {
    await prisma.user.update({
      where: { id: body.userId },
      data: { sessionVersion: { increment: 1 } },
    })
    return NextResponse.json({ ok: true })
  }

  // 8. User Management: Delete User
  if (body?.action === 'delete_user' && typeof body.userId === 'string') {
    if (body.userId === user.id) {
      return NextResponse.json(
        { error: 'Du kannst dein eigenes Administrator-Konto hier nicht löschen.' },
        { status: 400 }
      )
    }
    const target = await prisma.user.findUnique({ where: { id: body.userId } })
    if (!target) {
      return NextResponse.json({ error: 'Nutzer nicht gefunden.' }, { status: 404 })
    }
    if (target.username?.toLowerCase() === 'markenjaden') {
      return NextResponse.json(
        { error: 'Das Haupt-Administrator-Konto „markenjaden“ kann nicht gelöscht werden.' },
        { status: 400 }
      )
    }
    await prisma.user.delete({ where: { id: target.id } })
    return NextResponse.json({ ok: true })
  }

  // 9. Broadcast Email (Rundmail)
  if (body?.action === 'send_broadcast_email') {
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const recipientMode = body.recipientMode === 'admins' ? 'admins' : body.recipientMode === 'selected' ? 'selected' : 'all'

    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Bitte gib sowohl einen Betreff als auch einen Nachrichtentext für die Rundmail ein.' },
        { status: 400 }
      )
    }

    let whereClause: Prisma.UserWhereInput = {
      email: { not: null },
    }
    if (recipientMode === 'admins') {
      whereClause = {
        email: { not: null },
        OR: [{ isAdmin: true }, { username: 'markenjaden' }],
      }
    } else if (recipientMode === 'selected' && Array.isArray(body.userIds)) {
      whereClause = {
        id: { in: body.userIds.filter((id: unknown): id is string => typeof id === 'string') },
        email: { not: null },
      }
    }

    const recipientsUsers = await prisma.user.findMany({
      where: whereClause,
      select: { email: true },
    })

    const recipients = [...new Set(recipientsUsers.map(u => u.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e)))]
    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'Keine Empfänger mit gültiger E-Mail-Adresse für diese Auswahl gefunden.' },
        { status: 400 }
      )
    }

    try {
      const result = await sendAdminBroadcastEmail({
        recipients,
        subject,
        message,
      })
      return NextResponse.json({
        ok: true,
        sent: result.sent,
        failed: result.failed,
        errors: result.errors,
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Rundmail konnte nicht versendet werden.' },
        { status: 502 }
      )
    }
  }

  // 10. Contact Messages
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
