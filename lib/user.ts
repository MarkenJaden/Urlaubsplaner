import { randomBytes } from 'node:crypto'
import { prisma } from './prisma'
import { normalizeOptionalEmail } from './password'

export async function getOrCreateUser(
  keycloakId: string,
  email?: string | null,
  name?: string | null
) {
  const normalizedEmail = normalizeOptionalEmail(email) ?? undefined
  return await prisma.user.upsert({
    where: { keycloakId },
    update: { email: normalizedEmail, name: name ?? undefined },
    create: { keycloakId, email: normalizedEmail, name },
  })
}

export async function linkOrCreateOAuthUser(params: {
  provider: 'google' | 'github'
  providerAccountId: string
  email?: string | null
  name?: string | null
  loggedInUserId?: string | null
}) {
  const { provider, providerAccountId, name, loggedInUserId } = params
  const normalizedEmail = normalizeOptionalEmail(params.email) ?? null
  const legacyKey = `${provider}:${providerAccountId}`
  const idField = provider === 'google' ? 'googleId' : 'githubId'

  // Find any existing user already holding this OAuth identity
  const existingByProvider = await prisma.user.findFirst({
    where: {
      OR: [
        { [idField]: providerAccountId },
        { keycloakId: legacyKey },
      ],
    },
  })

  // 1. Manual linking while signed into an existing account
  if (loggedInUserId) {
    const currentUser = await prisma.user.findUnique({ where: { id: loggedInUserId } })
    if (currentUser) {
      if (existingByProvider && existingByProvider.id !== currentUser.id) {
        // Merge any vacation entries from the previously separate OAuth account into currentUser, then free the OAuth ID
        const otherEntries = await prisma.vacationEntry.findMany({ where: { userId: existingByProvider.id } })
        for (const entry of otherEntries) {
          await prisma.vacationEntry.upsert({
            where: { userId_date_type: { userId: currentUser.id, date: entry.date, type: entry.type } },
            update: {},
            create: {
              userId: currentUser.id,
              date: entry.date,
              type: entry.type,
              title: entry.title,
              year: entry.year,
            },
          })
        }
        await prisma.user.delete({ where: { id: existingByProvider.id } })
      }

      return await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          [idField]: providerAccountId,
          email: currentUser.email || normalizedEmail || undefined,
          name: currentUser.name || name || undefined,
        },
      })
    }
  }

  // 2. Existing user already linked with this OAuth provider
  if (existingByProvider) {
    // Check if there is also a local account with the same email that hasn't been merged yet
    if (normalizedEmail) {
      const matchingEmailUser = await prisma.user.findFirst({
        where: {
          id: { not: existingByProvider.id },
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
      })
      // If a local account (with username/password) has the same email and existingByProvider was an OAuth-only duplicate, merge into the local account
      if (matchingEmailUser && matchingEmailUser.passwordHash && !existingByProvider.passwordHash) {
        const otherEntries = await prisma.vacationEntry.findMany({ where: { userId: existingByProvider.id } })
        for (const entry of otherEntries) {
          await prisma.vacationEntry.upsert({
            where: { userId_date_type: { userId: matchingEmailUser.id, date: entry.date, type: entry.type } },
            update: {},
            create: {
              userId: matchingEmailUser.id,
              date: entry.date,
              type: entry.type,
              title: entry.title,
              year: entry.year,
            },
          })
        }
        await prisma.user.delete({ where: { id: existingByProvider.id } })
        return await prisma.user.update({
          where: { id: matchingEmailUser.id },
          data: {
            [idField]: providerAccountId,
            name: matchingEmailUser.name || name || undefined,
          },
        })
      }
    }

    return await prisma.user.update({
      where: { id: existingByProvider.id },
      data: {
        [idField]: providerAccountId,
        email: existingByProvider.email || normalizedEmail || undefined,
        name: existingByProvider.name || name || undefined,
      },
    })
  }

  // 3. Automatic linking by matching email address
  if (normalizedEmail) {
    const existingByEmail = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    })
    if (existingByEmail) {
      return await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          [idField]: providerAccountId,
          email: normalizedEmail,
          name: existingByEmail.name || name || undefined,
        },
      })
    }
  }

  // 4. Create new user for this OAuth identity
  return await prisma.user.create({
    data: {
      keycloakId: legacyKey,
      [idField]: providerAccountId,
      email: normalizedEmail,
      name: name ?? null,
      calendarToken: randomBytes(32).toString('base64url'),
    },
  })
}

export async function getUserByToken(calendarToken: string) {
  return await prisma.user.findUnique({
    where: { calendarToken },
    include: { vacations: true },
  })
}

export async function getCalendarFeedByToken(token: string) {
  return await prisma.calendarFeed.findUnique({
    where: { token },
    include: {
      user: {
        include: { vacations: true },
      },
    },
  })
}

export async function getUserFromSession(session: { user: { id: string } }) {
  return prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
}
