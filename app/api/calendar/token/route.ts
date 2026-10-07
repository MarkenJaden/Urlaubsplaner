import { randomBytes } from 'node:crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { jsonError, validOrigin } from '@/lib/request'

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)
  const calendarToken = randomBytes(32).toString('base64url')
  await prisma.user.update({ where: { id: session.user.id }, data: { calendarToken } })
  return Response.json({ calendarToken }, { headers: { 'Cache-Control': 'no-store' } })
}
