import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { parseEntry, parsePreferences, mergePreferences } from '@/lib/preferences'
import { jsonError, readJson, validOrigin } from '@/lib/request'
import type { UserPreferences } from '@/types'

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)
  const body = await readJson(request, 1_000_000)
  if (!Array.isArray(body?.vacations) || body.vacations.length > 5000) return jsonError('Ungültige Importdaten (maximal 5000 Einträge).')
  const entries = body.vacations.map(parseEntry)
  const prefs = body.preferences === undefined ? {} : parsePreferences(body.preferences)
  if (entries.some(entry => !entry) || !prefs) return jsonError('Import enthält ungültige Einträge oder Einstellungen.')
  await prisma.$transaction(async tx => {
    const [user] = await tx.$queryRaw<Array<{ preferences: UserPreferences }>>`SELECT "preferences" FROM "User" WHERE "id" = ${session.user.id} FOR UPDATE`
    if (!user) throw new Error('User no longer exists')
    for (const entry of entries) {
      if (!entry) continue
      await tx.vacationEntry.upsert({ where: { userId_date_type: { userId: session.user.id, date: entry.date, type: entry.type } }, update: {}, create: { ...entry, userId: session.user.id } })
    }
    await tx.user.update({ where: { id: session.user.id }, data: { preferences: mergePreferences(prefs, user.preferences) as object } })
  }, { timeout: 30_000 })
  return Response.json({ success: true })
}
