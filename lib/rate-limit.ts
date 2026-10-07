import { createHash } from 'node:crypto'
import { prisma } from './prisma'

export async function allowAttempt(bucket: string, limit: number, seconds = 900): Promise<boolean> {
  if (bucket.endsWith('-global')) await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  const key = createHash('sha256').update(bucket).digest('hex')
  const result = await prisma.$queryRaw<Array<{ hits: number }>>`
    INSERT INTO "RateLimit" ("key", "hits", "expiresAt")
    VALUES (${key}, 1, CURRENT_TIMESTAMP + ${seconds} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "RateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN 1 ELSE "RateLimit"."hits" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + ${seconds} * INTERVAL '1 second' ELSE "RateLimit"."expiresAt" END
    RETURNING "hits"`
  return result[0].hits <= limit
}

export function requestBucket(request: Request): string {
  // Proxies must replace incoming forwarded headers. Global limits also apply.
  return (request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown').trim().slice(0, 100)
}
