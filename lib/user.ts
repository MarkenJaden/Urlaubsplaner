import { prisma } from './prisma'

export async function getOrCreateUser(
  keycloakId: string,
  email?: string | null,
  name?: string | null
) {
  return await prisma.user.upsert({
    where: { keycloakId },
    update: { email: email ?? undefined, name: name ?? undefined },
    create: { keycloakId, email, name },
  })
}

export async function getUserByToken(calendarToken: string) {
  return await prisma.user.findUnique({
    where: { calendarToken },
    include: { vacations: true }
  })
}
