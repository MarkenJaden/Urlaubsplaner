import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { InteractivePublicWidget, type PublicWidgetMode } from '@/components/calendar/interactive-public-widget'
import { fetchPublicWidgetData } from '@/lib/public-widget-data'
import { getSeoPlanningYears, isValidSeoYear } from '@/lib/seo-regions'
import { recordWidgetView } from '@/lib/widget-analytics'
import { DEFAULT_WORK_DAYS } from '@/lib/vacation-accounting'
import type { OptimizationGoal, SchoolHolidayStrategy } from '@/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Interaktives Urlaubsplaner-Widget',
  robots: { index: false, follow: true },
}

interface WidgetEmbedProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const VALID_GOALS = new Set<OptimizationGoal>([
  'balanced',
  'max_efficiency',
  'long_breaks',
  'distributed',
  'mini_breaks',
])

function firstParam(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val
}

export default async function EmbedInteractiveWidgetPage({ searchParams }: WidgetEmbedProps) {
  const params = searchParams ? await searchParams : {}
  const years = getSeoPlanningYears()
  const rawYear = Number(firstParam(params.year))
  const year = isValidSeoYear(rawYear) ? rawYear : (years[1] ?? years[0])
  const regionSlug = firstParam(params.region) ?? 'nordrhein-westfalen'

  const rawMode = firstParam(params.mode)
  const mode: PublicWidgetMode =
    rawMode === 'schulferien' || rawMode === 'heatmap' ? rawMode : 'brueckentage'

  const rawGoal = firstParam(params.goal) as OptimizationGoal | undefined
  const goal: OptimizationGoal = rawGoal && VALID_GOALS.has(rawGoal) ? rawGoal : 'balanced'

  const rawBudget = Number(firstParam(params.budget))
  const budget = Number.isFinite(rawBudget) && rawBudget >= 1 && rawBudget <= 60 ? rawBudget : 28

  const workDays = firstParam(params.work) === '4' ? [1, 2, 3, 4] : DEFAULT_WORK_DAYS
  const rawSchool = firstParam(params.school)
  const schoolStrategy: SchoolHolidayStrategy =
    rawSchool === 'prefer' || rawSchool === 'avoid' ? rawSchool : 'neutral'

  const view = firstParam(params.view) === 'list' ? 'list' : 'calendar'
  const allowControls = firstParam(params.controls) !== '0'

  const reqHeaders = await headers()
  const data = await fetchPublicWidgetData({
    year,
    regionSlug,
    includeHeatmap: mode === 'heatmap',
  })

  void recordWidgetView({
    widgetType: mode === 'heatmap' ? 'heatmap' : mode === 'schulferien' ? 'schulferien' : 'widget',
    region: data.regionSlug,
    referer: reqHeaders.get('referer'),
    host: reqHeaders.get('x-forwarded-host') ?? reqHeaders.get('host'),
  })

  return (
    <div className="min-h-screen bg-card p-3 text-card-foreground text-xs">
      <InteractivePublicWidget
        initialYear={data.year}
        initialRegionSlug={data.regionSlug}
        initialRegionName={data.regionName}
        initialCountry={data.country}
        initialSubdivision={data.subdivision}
        initialMode={mode}
        initialGoal={goal}
        initialBudget={budget}
        initialWorkDays={workDays}
        initialSchoolStrategy={schoolStrategy}
        initialView={view}
        initialPublicHolidays={data.publicHolidays}
        initialSchoolHolidays={data.schoolHolidays}
        initialHeatmap={data.heatmap}
        initialHeatmapTotalStates={data.heatmapTotalStates}
        allowControls={allowControls}
        isEmbed
      />
    </div>
  )
}
