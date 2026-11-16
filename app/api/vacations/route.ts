import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/user'
import { NextResponse } from 'next/server'
import { parseEntry } from '@/lib/preferences'
import { jsonError, readJson, validOrigin } from '@/lib/request'
import { publishPlanUpdate } from '@/lib/realtime-hub'

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

  return NextResponse.json(vacations, { headers: { 'Cache-Control': 'no-store' } })
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

  publishPlanUpdate({ userId: user.id })
  return NextResponse.json(entry)
}

/** Batch-update the custom title/name for existing entries of one type. */
export async function PATCH(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await readJson(request)
  const datesRaw = body?.dates
  const type = body?.type
  const titleRaw = body?.title

  if (!Array.isArray(datesRaw) || datesRaw.length === 0 || datesRaw.length > 500) {
    return jsonError('Ungültige Datumsliste.')
  }
  if (typeof type !== 'string' || !['vacation', 'gleittag', 'special', 'note'].includes(type)) {
    return jsonError('Ungültiger Eintragstyp.')
  }
  if (titleRaw !== null && titleRaw !== undefined && (typeof titleRaw !== 'string' || titleRaw.length > 500)) {
    return jsonError('Ungültige Bezeichnung (maximal 500 Zeichen).')
  }

  const parsedDates: Date[] = []
  for (const item of datesRaw) {
    const parsed = parseEntry({ date: item, type })
    if (!parsed) return jsonError('Ungültiges Datum in der Anfrage.')
    parsedDates.push(parsed.date)
  }

  const normalizedTitle = typeof titleRaw === 'string' ? (titleRaw.trim() || null) : null
  const user = await getUserFromSession(session)

  const { count } = await prisma.vacationEntry.updateMany({
    where: {
      userId: user.id,
      type,
      date: { in: parsedDates },
    },
    data: { title: normalizedTitle },
  })

  publishPlanUpdate({ userId: user.id })
  return NextResponse.json({ updated: count }, { headers: { 'Cache-Control': 'no-store' } })
}

/** "Planung zurücksetzen": removes all of the signed-in user's entries. */
export async function DELETE(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)
  const { count } = await prisma.vacationEntry.deleteMany({ where: { userId: session.user.id } })
  publishPlanUpdate({ userId: session.user.id })
  return NextResponse.json({ deleted: count }, { headers: { 'Cache-Control': 'no-store' } })
}
