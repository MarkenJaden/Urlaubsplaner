-- Additive migration: OAuth account linking, password reset tokens, and multiple calendar subscription feeds.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenExpiresAt" TIMESTAMP(3);

-- Backfill googleId and githubId from existing keycloakId values if present
UPDATE "User"
SET "googleId" = SUBSTRING("keycloakId" FROM 8)
WHERE "keycloakId" LIKE 'google:%' AND "googleId" IS NULL;

UPDATE "User"
SET "githubId" = SUBSTRING("keycloakId" FROM 8)
WHERE "keycloakId" LIKE 'github:%' AND "githubId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_githubId_key" ON "User"("githubId");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

CREATE TABLE IF NOT EXISTS "CalendarFeed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Mein Kalender-Abo',
    "token" TEXT NOT NULL,
    "includeVacations" BOOLEAN NOT NULL DEFAULT true,
    "includeGleittage" BOOLEAN NOT NULL DEFAULT true,
    "includeNotes" BOOLEAN NOT NULL DEFAULT false,
    "includeNoteTitles" BOOLEAN NOT NULL DEFAULT true,
    "includePublicHolidays" BOOLEAN NOT NULL DEFAULT false,
    "includeSchoolHolidays" BOOLEAN NOT NULL DEFAULT false,
    "includeBridgeDays" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarFeed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarFeed_token_key" ON "CalendarFeed"("token");
CREATE INDEX IF NOT EXISTS "CalendarFeed_userId_idx" ON "CalendarFeed"("userId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarFeed_userId_fkey') THEN
        ALTER TABLE "CalendarFeed" ADD CONSTRAINT "CalendarFeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
