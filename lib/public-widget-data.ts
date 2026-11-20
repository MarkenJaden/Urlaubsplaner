import {
  fetchHolidays,
  fetchSubdivisions,
  resolveSchoolGroup,
} from '@/lib/holiday-api'
import { countHolidayStates } from '@/lib/holidays'
import {
  buildPlannerHref,
  getSeoRegionBySlug,
  type SeoRegionEntry,
} from '@/lib/seo-regions'
import type { Holiday } from '@/types'

export interface ResolvedPublicRegion {
  regionSlug: string
  regionName: string
  country: string
  subdivision?: string
  seoRegion?: SeoRegionEntry
}

export function resolvePublicWidgetRegion(rawSlug?: string | null): ResolvedPublicRegion {
  const slug = (rawSlug ?? '').trim().toLowerCase()
  const seoRegion = slug ? getSeoRegionBySlug(slug) : undefined
  if (seoRegion) {
    return {
      regionSlug: seoRegion.slug,
      regionName: seoRegion.name,
      country: seoRegion.country,
      subdivision: seoRegion.subdivision,
      seoRegion,
    }
  }
  return {
    regionSlug: 'de',
    regionName: 'Deutschland (bundesweit)',
    country: 'DE',
    subdivision: undefined,
  }
}

export async function fetchPublicWidgetData(params: {
  year: number
  regionSlug?: string | null
  includeHeatmap?: boolean
}) {
  const resolved = resolvePublicWidgetRegion(params.regionSlug)
  const { year, includeHeatmap = false } = params
  const { country, subdivision } = resolved

  const groupPromise = subdivision
    ? resolveSchoolGroup(country, subdivision).catch(() => undefined)
    : Promise.resolve(undefined)

  const [rawPublic, group] = await Promise.all([
    fetchHolidays(country, subdivision, year, 'public').catch(() => [] as Holiday[]),
    groupPromise,
  ])

  const publicHolidays =
    country === 'DE' && !subdivision
      ? rawPublic.filter(h => h.nationwide)
      : rawPublic

  const schoolHolidays = subdivision
    ? await fetchHolidays(country, subdivision, year, 'school', group).catch(() => [] as Holiday[])
    : []

  let heatmap: Record<string, number> = {}
  let heatmapTotalStates = 16

  if (includeHeatmap) {
    const heatmapCountry = country === 'AT' || country === 'CH' ? country : 'DE'
    const subs = await fetchSubdivisions(heatmapCountry).catch(() => [])
    if (subs.length > 0) {
      const targetSubs = subs.slice(0, 16)
      heatmapTotalStates = targetSubs.length
      const allSchool = await Promise.all(
        targetSubs.map(async s => {
          const g = await resolveSchoolGroup(heatmapCountry, s.code).catch(() => undefined)
          return fetchHolidays(heatmapCountry, s.code, year, 'school', g).catch(() => [] as Holiday[])
        }),
      )
      const counts = countHolidayStates(allSchool)
      heatmap = Object.fromEntries(counts.entries())
    }
  }

  return {
    ...resolved,
    year,
    publicHolidays,
    schoolHolidays,
    heatmap,
    heatmapTotalStates,
    plannerHref: buildPlannerHref({ year, country, subdivision }),
  }
}
