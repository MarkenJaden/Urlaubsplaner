import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth, LINK_COOKIE_NAME, signLinkUserId } from '@/auth'
import { prisma } from '@/lib/prisma'
import { jsonError, readJson, validOrigin } from '@/lib/request'

export async function POST(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Nicht angemeldet.', 401)

  const signed = signLinkUserId(session.user.id)
  const store = await cookies()
  store.set(LINK_COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
    secure: process.env.NODE_ENV === 'production',
  })

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return jsonError('Ungültige Anfrage.', 403)
  const session = await auth()
  if (!session?.user?.id) return jsonError('Nicht angemeldet.', 401)

  const body = await readJson(request)
  const provider = body?.provider
  if (provider !== 'google' && provider !== 'github') {
    return jsonError('Ungültiger Anbieter.', 400)
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  const hasPassword = Boolean(user.passwordHash)
  const hasGoogle = Boolean(user.googleId || user.keycloakId.startsWith('google:'))
  const hasGithub = Boolean(user.githubId || user.keycloakId.startsWith('github:'))

  if (provider === 'google' && !hasPassword && !hasGithub) {
    return jsonError('Du kannst Google nicht trennen, solange kein lokales Passwort oder ein anderer Login verknüpft ist.', 400)
  }
  if (provider === 'github' && !hasPassword && !hasGoogle) {
    return jsonError('Du kannst GitHub nicht trennen, solange kein lokales Passwort oder ein anderer Login verknüpft ist.', 400)
  }

  const updateData: Record<string, unknown> =
    provider === 'google' ? { googleId: null } : { githubId: null }

  if (user.keycloakId.startsWith(`${provider}:`)) {
    updateData.keycloakId = `unlinked:${user.id}`
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  })

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
