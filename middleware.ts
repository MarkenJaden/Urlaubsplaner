import { NextResponse } from 'next/server'

// Authorization is enforced in Node-runtime pages and API handlers.
// Calendar subscriptions authenticate with their own bearer token.
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
}
