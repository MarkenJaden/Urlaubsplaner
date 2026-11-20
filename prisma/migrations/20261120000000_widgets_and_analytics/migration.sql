-- Additive migration for personal widgets & GDPR-compliant anonymous widget analytics

ALTER TABLE "AnalyticsDaily"
  ADD COLUMN IF NOT EXISTS "widgetViews" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CalendarWidget" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Mein Widget',
  "year" INTEGER,
  "viewMode" TEXT NOT NULL DEFAULT 'calendar',
  "includeVacations" BOOLEAN NOT NULL DEFAULT true,
  "includeGleittage" BOOLEAN NOT NULL DEFAULT true,
  "includeSpecial" BOOLEAN NOT NULL DEFAULT true,
  "includeNotes" BOOLEAN NOT NULL DEFAULT false,
  "includeNoteTitles" BOOLEAN NOT NULL DEFAULT false,
  "includePublicHolidays" BOOLEAN NOT NULL DEFAULT true,
  "includeSchoolHolidays" BOOLEAN NOT NULL DEFAULT true,
  "includeBridgeDays" BOOLEAN NOT NULL DEFAULT false,
  "includeSharedOverlays" BOOLEAN NOT NULL DEFAULT false,
  "sharedOverlayIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "showLegend" BOOLEAN NOT NULL DEFAULT true,
  "showStats" BOOLEAN NOT NULL DEFAULT true,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "lastViewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalendarWidget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarWidget_token_key" ON "CalendarWidget"("token");
CREATE INDEX IF NOT EXISTS "CalendarWidget_userId_idx" ON "CalendarWidget"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CalendarWidget_userId_fkey'
  ) THEN
    ALTER TABLE "CalendarWidget"
      ADD CONSTRAINT "CalendarWidget_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WidgetViewDaily" (
  "date" TEXT NOT NULL,
  "widgetType" TEXT NOT NULL,
  "region" TEXT NOT NULL DEFAULT '',
  "embedHost" TEXT NOT NULL DEFAULT '',
  "views" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "WidgetViewDaily_pkey" PRIMARY KEY ("date", "widgetType", "region", "embedHost")
);

CREATE INDEX IF NOT EXISTS "WidgetViewDaily_date_idx" ON "WidgetViewDaily"("date");
CREATE INDEX IF NOT EXISTS "WidgetViewDaily_widgetType_idx" ON "WidgetViewDaily"("widgetType");
