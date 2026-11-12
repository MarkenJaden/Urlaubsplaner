import { describe, expect, it } from 'vitest'
import {
  SEO_REGIONS,
  buildPlannerHref,
  getSeoPlanningYears,
  getSeoRegionBySlug,
  isValidSeoYear,
} from './seo-regions'

describe('seo-regions', () => {
  it('covers all 16 German Bundesländer plus Austria and Switzerland with unique slugs', () => {
    expect(SEO_REGIONS).toHaveLength(18)
    const slugs = new Set(SEO_REGIONS.map(r => r.slug))
    expect(slugs.size).toBe(18)

    const deRegions = SEO_REGIONS.filter(r => r.country === 'DE')
    expect(deRegions).toHaveLength(16)
    expect(deRegions.every(r => r.subdivision?.startsWith('DE-'))).toBe(true)
  })

  it('resolves region slugs case-insensitively', () => {
    expect(getSeoRegionBySlug('nordrhein-westfalen')?.subdivision).toBe('DE-NW')
    expect(getSeoRegionBySlug('BAYERN')?.subdivision).toBe('DE-BY')
    expect(getSeoRegionBySlug('oesterreich')?.country).toBe('AT')
    expect(getSeoRegionBySlug('unknown-region')).toBeUndefined()
  })

  it('returns three consecutive planning years anchored in Europe/Berlin', () => {
    const years = getSeoPlanningYears(new Date('2026-06-15T12:00:00Z'))
    expect(years).toEqual([2026, 2027, 2028])
  })

  it('validates supported SEO years strictly and rolls dynamically with time', () => {
    const fixed2026 = new Date('2026-06-15T12:00:00Z')
    expect(isValidSeoYear(2026, fixed2026)).toBe(true)
    expect(isValidSeoYear(2030, fixed2026)).toBe(true)
    expect(isValidSeoYear(2023, fixed2026)).toBe(false)
    expect(isValidSeoYear(2031, fixed2026)).toBe(false)
    expect(isValidSeoYear(2026.5, fixed2026)).toBe(false)
    expect(isValidSeoYear(Number.NaN, fixed2026)).toBe(false)

    // Future-proofing: When current year advances to 2028, 2032 becomes valid
    const fixed2028 = new Date('2028-01-01T00:00:00Z')
    expect(isValidSeoYear(2028, fixed2028)).toBe(true)
    expect(isValidSeoYear(2032, fixed2028)).toBe(true)
    expect(isValidSeoYear(2033, fixed2028)).toBe(false)
  })

  it('builds clean deep-link hrefs to the planner', () => {
    expect(buildPlannerHref({})).toBe('/')
    expect(buildPlannerHref({ year: 2027, country: 'DE', subdivision: 'DE-NW' })).toBe(
      '/?year=2027&country=DE&subdivision=DE-NW'
    )
    expect(buildPlannerHref({ year: 2026, country: 'AT' })).toBe('/?year=2026&country=AT')
  })
})
