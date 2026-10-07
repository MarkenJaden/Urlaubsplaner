import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { jsonError, validOrigin } from '@/lib/request'

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)
  await prisma.user.update({ where: { id: session.user.id }, data: { sessionVersion: { increment: 1 } } })
  return Response.json({ success: true })
}
