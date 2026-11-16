-- Additive migration: include shared overlays and optional calendar color in CalendarFeed.
ALTER TABLE "CalendarFeed" ADD COLUMN IF NOT EXISTS "includeSharedOverlays" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CalendarFeed" ADD COLUMN IF NOT EXISTS "sharedOverlayIds" JSONB;
ALTER TABLE "CalendarFeed" ADD COLUMN IF NOT EXISTS "color" TEXT;
