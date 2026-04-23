import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/user'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.keycloakId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')

  const user = await getOrCreateUser(
    session.user.keycloakId,
    session.user.email,
    session.user.name
  )

  const vacations = await prisma.vacationEntry.findMany({
    where: {
      userId: user.id,
      ...(year ? { year: parseInt(year) } : {})
    },
    orderBy: { date: 'asc' }
  })

  return NextResponse.json(vacations)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.keycloakId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { date, type, title } = body

  if (!date || !type) {
    return NextResponse.json({ error: 'date and type required' }, { status: 400 })
  }

  const user = await getOrCreateUser(
    session.user.keycloakId,
    session.user.email,
    session.user.name
  )

  const parsedDate = new Date(date)
  const year = parsedDate.getFullYear()

  const entry = await prisma.vacationEntry.upsert({
    where: {
      userId_date_type: {
        userId: user.id,
        date: parsedDate,
        type
      }
    },
    update: { title: title ?? null },
    create: {
      userId: user.id,
      date: parsedDate,
      type,
      title: title ?? null,
      year
    }
  })

  return NextResponse.json(entry)
}
