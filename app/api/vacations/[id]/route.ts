import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/user'
import { NextResponse } from 'next/server'
import { validOrigin, jsonError } from '@/lib/request'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const user = await getUserFromSession(session)

  const entry = await prisma.vacationEntry.findUnique({ where: { id } })
  if (!entry || entry.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.vacationEntry.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
