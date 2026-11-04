-- Additive migration: track User.lastActiveAt and AnalyticsVisitor.currentPath for live analytics.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "AnalyticsVisitor" ADD COLUMN IF NOT EXISTS "currentPath" TEXT;

-- Backfill lastActiveAt for existing users from visitor pings or account timestamps
UPDATE "User" u
SET "lastActiveAt" = COALESCE(
  (SELECT MAX(av."lastSeenAt") FROM "AnalyticsVisitor" av WHERE av."userId" = u."id"),
  u."updatedAt",
  u."createdAt"
)
WHERE u."lastActiveAt" IS NULL;

CREATE INDEX IF NOT EXISTS "User_lastActiveAt_idx" ON "User"("lastActiveAt");
CREATE INDEX IF NOT EXISTS "AnalyticsVisitor_userId_idx" ON "AnalyticsVisitor"("userId");
