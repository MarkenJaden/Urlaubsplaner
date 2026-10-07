-- Additive migration: keep existing identities and vacation entries.
ALTER TABLE "User" ADD COLUMN "username" TEXT,
                   ADD COLUMN "passwordHash" TEXT,
                   ADD COLUMN "recoveryHash" TEXT,
                   ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "hits" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
