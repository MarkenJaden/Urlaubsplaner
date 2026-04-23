import { auth } from '@/auth'
import { NextResponse } from 'next/server'

// Nur diese Routen erfordern Login
const PROTECTED_ROUTES = [
  '/settings',
  '/api/vacations',
  '/api/profile',
  '/api/calendar',
]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route))

  if (isProtected && !req.auth?.user?.keycloakId) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
