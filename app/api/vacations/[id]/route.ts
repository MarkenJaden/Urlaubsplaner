import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/user'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.keycloakId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const user = await getOrCreateUser(
    session.user.keycloakId,
    session.user.email,
    session.user.name
  )

  const entry = await prisma.vacationEntry.findUnique({ where: { id } })
  if (!entry || entry.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.vacationEntry.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
