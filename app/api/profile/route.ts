import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/user'
import { NextResponse } from 'next/server'
import { mergePreferences, parsePreferences } from '@/lib/preferences'
import { jsonError, readJson, validOrigin } from '@/lib/request'
import type { UserPreferences } from '@/types'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)
  const user = await getUserFromSession(session)
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, username: user.username, hasLocalAccount: Boolean(user.passwordHash), calendarToken: user.calendarToken, preferences: user.preferences }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Unauthorized', 401)
  const body = await readJson(request)
  const patch = parsePreferences(body?.preferences)
  if (!patch) return jsonError('Ungültige Einstellungen.')
  const preferences = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ preferences: UserPreferences }>>`SELECT "preferences" FROM "User" WHERE "id" = ${session.user.id} FOR UPDATE`
    if (!rows[0]) throw new Error('User no longer exists')
    const merged = mergePreferences(rows[0].preferences, patch)
    await tx.user.update({ where: { id: session.user.id }, data: { preferences: merged as object } })
    return merged
  })
  return NextResponse.json({ preferences }, { headers: { 'Cache-Control': 'no-store' } })
}
