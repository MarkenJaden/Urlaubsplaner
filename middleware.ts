export { auth as middleware } from './auth'

export const config = {
  matcher: [
    '/((?!api/calendar|_next/static|_next/image|favicon.ico|login).*)',
  ],
}
