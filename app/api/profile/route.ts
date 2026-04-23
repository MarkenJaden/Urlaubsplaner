import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/user'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.keycloakId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getOrCreateUser(
    session.user.keycloakId,
    session.user.email,
    session.user.name
  )

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    calendarToken: user.calendarToken,
    preferences: user.preferences,
  })
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.keycloakId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const user = await prisma.user.update({
    where: { keycloakId: session.user.keycloakId },
    data: { preferences: body.preferences }
  })

  return NextResponse.json({ preferences: user.preferences })
}
