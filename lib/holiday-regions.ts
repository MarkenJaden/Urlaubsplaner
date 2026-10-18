import type { HolidayGroup, LocalizedText, Subdivision } from '@/types'

// Country → subdivision → holiday group, as modelled by OpenHolidays.
// Groups split school holidays inside a country, e.g. NL-NO/NL-MI/NL-ZU or
// school types such as DE-MV-ABS. Querying by subdivision alone mixes them.

const REGION_CODE = /^[A-Z]{2}(?:-[A-Z0-9]{1,10}){1,3}$/

export const DEFAULT_COUNTRY = 'DE'

export function isCountryCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{2}$/.test(value)
}

/** Format check for subdivision and group codes, optionally bound to a country. */
export function isRegionCode(value: unknown, country?: string): value is string {
  return typeof value === 'string' && REGION_CODE.test(value) && (!country || value.startsWith(`${country}-`))
}

export function localizedName(name: LocalizedText[] | undefined, fallback = ''): string {
  return name?.find(n => n.language === 'DE')?.text ?? name?.[0]?.text ?? fallback
}

function topLevel(code: string): string {
  return code.split('-').slice(0, 2).join('-')
}

export function findSubdivision(subdivisions: Subdivision[], code: string | undefined): Subdivision | undefined {
  if (!code) return undefined
  for (const subdivision of subdivisions) {
    if (subdivision.code === code) return subdivision
    const child = findSubdivision(subdivision.children ?? [], code)
    if (child) return child
  }
  return undefined
}

/**
 * A group is regional when it is not tied to exactly one top-level subdivision:
 * NL-NO spans several provinces and BE-FR lists none, while DE-MV-ABS is a
 * school type inside Mecklenburg-Vorpommern.
 */
export function isRegionalGroup(group: HolidayGroup): boolean {
  return new Set((group.subdivisions ?? []).map(s => topLevel(s.code))).size !== 1
}

function groupCovers(group: HolidayGroup, code: string): boolean {
  return (group.subdivisions ?? []).some(s => s.code.startsWith(`${code}-`) || code.startsWith(`${s.code}-`))
}

/** Groups that can apply to the chosen subdivision (or the whole country). */
export function groupsForSubdivision(groups: HolidayGroup[], subdivisions: Subdivision[], subdivision?: string): HolidayGroup[] {
  if (!subdivision) return groups.filter(isRegionalGroup)
  const listed = findSubdivision(subdivisions, subdivision)?.groups
  if (listed?.length) {
    const codes = new Set(listed.map(g => g.code))
    return groups.filter(g => codes.has(g.code))
  }
  // Exact membership wins: NL-NO lists the province NL-UT, but the
  // municipality NL-UT-UT is listed only under NL-MI.
  const exact = groups.filter(g => g.subdivisions?.some(s => s.code === subdivision))
  if (exact.length) return [...exact, ...groups.filter(g => !g.subdivisions?.length)]
  return groups.filter(g => !g.subdivisions?.length || groupCovers(g, subdivision))
}

export interface ResolvedRegion {
  /** Groups the user can choose from for this subdivision. */
  candidates: HolidayGroup[]
  /** Group used for school holidays: the stored choice or the only candidate. */
  group?: string
  /** True when several groups apply and none is chosen; results would mix them. */
  ambiguous: boolean
}

export function resolveHolidayGroup(groups: HolidayGroup[], subdivisions: Subdivision[], subdivision?: string, preferred?: string): ResolvedRegion {
  const candidates = groupsForSubdivision(groups, subdivisions, subdivision)
  const group = candidates.find(g => g.code === preferred)?.code ?? (candidates.length === 1 ? candidates[0].code : undefined)
  return { candidates, group, ambiguous: !group && candidates.length > 1 }
}

export type ComparisonRegion = { code: string; kind: 'subdivision' | 'group' }

/** Comparison targets: top-level subdivisions plus regional groups. */
export function comparisonRegions(subdivisions: Subdivision[], groups: HolidayGroup[]): ComparisonRegion[] {
  return [
    ...subdivisions.map(s => ({ code: s.code, kind: 'subdivision' as const })),
    ...groups.filter(isRegionalGroup).map(g => ({ code: g.code, kind: 'group' as const })),
  ]
}

/** "Select all" picks the regional groups when a country defines them (NL), else every subdivision (DE). */
export function defaultComparisonSelection(subdivisions: Subdivision[], groups: HolidayGroup[]): string[] {
  const regional = groups.filter(isRegionalGroup)
  return (regional.length ? regional : subdivisions).map(region => region.code)
}
