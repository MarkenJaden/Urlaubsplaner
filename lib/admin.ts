import { prisma } from './prisma'

const DEFAULT_ADMIN_USERNAMES = new Set(['markenjaden', 'jan', 'jjsch', 'jjsch1410', 'admin'])
const DEFAULT_ADMIN_EMAILS = new Set(['jjsch1410@gmail.com'])

export function isUserAdmin(user: {
  isAdmin?: boolean | null
  username?: string | null
  email?: string | null
} | null | undefined): boolean {
  if (!user) return false
  if (user.isAdmin) return true

  const envAdmin = process.env.ADMIN_USERNAME?.trim().toLowerCase()
  const username = user.username?.trim().toLowerCase()
  const email = user.email?.trim().toLowerCase()

  if (username && (DEFAULT_ADMIN_USERNAMES.has(username) || (envAdmin && username === envAdmin))) {
    return true
  }
  if (email && DEFAULT_ADMIN_EMAILS.has(email)) {
    return true
  }
  return false
}

export async function canClaimInitialAdmin(): Promise<boolean> {
  const existingAdmins = await prisma.user.count({
    where: { isAdmin: true },
  })
  return existingAdmins === 0
}
