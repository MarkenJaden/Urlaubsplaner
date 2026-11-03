-- Additive migration: plan sharing, anonymous & registered analytics, contact messages, and admin flag.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "PlanShare" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Mein geteilter Plan',
    "permission" TEXT NOT NULL DEFAULT 'view',
    "includeNotes" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlanShare_token_key" ON "PlanShare"("token");
CREATE INDEX IF NOT EXISTS "PlanShare_userId_idx" ON "PlanShare"("userId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanShare_userId_fkey') THEN
        ALTER TABLE "PlanShare" ADD CONSTRAINT "PlanShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AnalyticsVisitor" (
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "isRegistered" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "subdivision" TEXT,
    "deviceType" TEXT,
    "plannedDays" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageViews" INTEGER NOT NULL DEFAULT 1,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AnalyticsVisitor_pkey" PRIMARY KEY ("visitorId")
);

CREATE INDEX IF NOT EXISTS "AnalyticsVisitor_lastSeenAt_idx" ON "AnalyticsVisitor"("lastSeenAt");
CREATE INDEX IF NOT EXISTS "AnalyticsVisitor_isRegistered_idx" ON "AnalyticsVisitor"("isRegistered");

CREATE TABLE IF NOT EXISTS "AnalyticsDaily" (
    "date" TEXT NOT NULL,
    "totalVisitors" INTEGER NOT NULL DEFAULT 0,
    "guestVisitors" INTEGER NOT NULL DEFAULT 0,
    "authedVisitors" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "suggestionsRun" INTEGER NOT NULL DEFAULT 0,
    "exportsCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCreated" INTEGER NOT NULL DEFAULT 0,
    "feedsFetched" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("date")
);

CREATE TABLE IF NOT EXISTS "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "ContactMessage_status_idx" ON "ContactMessage"("status");
