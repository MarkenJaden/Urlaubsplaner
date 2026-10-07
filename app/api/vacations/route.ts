import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/user'
import { NextResponse } from 'next/server'
import { parseEntry } from '@/lib/preferences'
import { jsonError, readJson, validOrigin } from '@/lib/request'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2200)) return jsonError('Invalid year')

  const user = await getUserFromSession(session)

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
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const entryData = parseEntry(await readJson(request))
  if (!entryData) return jsonError('Ungültiger Eintrag.')
  const { date: parsedDate, type, title, year } = entryData

  const user = await getUserFromSession(session)


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
