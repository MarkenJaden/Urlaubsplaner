import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { subscribeToPlanUpdates } from '@/lib/realtime-hub'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawTokens = searchParams.get('tokens') ?? ''
  const tokens = rawTokens
    .split(',')
    .map(t => t.trim())
    .filter(t => /^[A-Za-z0-9_-]{16,64}$/.test(t))
    .slice(0, 20)

  const session = await auth()
  const selfUserId = session?.user?.id

  // Map owner userIds -> watched share tokens so updates by the owner on /api/vacations
  // or /api/profile immediately trigger notifications for all viewers of their share tokens.
  const watchedTokensSet = new Set(tokens)
  const tokensByOwnerUserId = new Map<string, string[]>()

  if (tokens.length > 0) {
    try {
      const dbShares = await prisma.planShare.findMany({
        where: { token: { in: tokens } },
        select: { token: true, userId: true },
      })
      for (const s of dbShares) {
        const list = tokensByOwnerUserId.get(s.userId) ?? []
        list.push(s.token)
        tokensByOwnerUserId.set(s.userId, list)
      }
    } catch {
      // Ignore DB lookup errors for stream setup
    }
  }

  const encoder = new TextEncoder()
  let cleanup: (() => void) | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch {
          // Stream closed
        }
      }

      send({ type: 'connected', ts: Date.now() })

      const unsubscribe = subscribeToPlanUpdates(event => {
        const matchedTokens = new Set<string>()
        if (event.tokens) {
          for (const t of event.tokens) {
            if (watchedTokensSet.has(t)) matchedTokens.add(t)
          }
        }
        if (event.userId && tokensByOwnerUserId.has(event.userId)) {
          for (const t of tokensByOwnerUserId.get(event.userId)!) {
            matchedTokens.add(t)
          }
        }
        const selfUpdated = Boolean(selfUserId && event.userId === selfUserId)

        if (matchedTokens.size > 0 || selfUpdated) {
          send({
            type: 'plan-updated',
            tokens: [...matchedTokens],
            selfUpdated,
            ts: event.timestamp,
          })
        }
      })

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`))
        } catch {
          // Ignore
        }
      }, 15_000)

      cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
      }

      request.signal.addEventListener('abort', () => {
        if (cleanup) cleanup()
        try {
          controller.close()
        } catch {
          // Ignore
        }
      })
    },
    cancel() {
      if (cleanup) cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
