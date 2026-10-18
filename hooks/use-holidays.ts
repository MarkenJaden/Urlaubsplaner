'use client'

import { useQuery, useQueries } from '@tanstack/react-query'
import type { Holiday, Country, HolidayGroup, Subdivision } from '@/types'
import type { ComparisonRegion } from '@/lib/holiday-regions'

const DAY = 24 * 60 * 60 * 1000

async function getHolidays(params: Record<string, string | undefined>): Promise<Holiday[]> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value)
  const res = await fetch(`/api/holidays?${search}`)
  if (!res.ok) throw new Error('Ferien oder Feiertage konnten nicht geladen werden.')
  return res.json()
}

export function useHolidays({
  country = 'DE',
  subdivision,
  group,
  year,
  type = 'public',
  enabled = true,
}: {
  country?: string
  subdivision?: string
  /** Holiday group for school holidays (e.g. NL-NO); ignored for public holidays. */
  group?: string
  year: number
  type?: 'public' | 'school'
  enabled?: boolean
}) {
  const effectiveGroup = type === 'school' ? group : undefined
  return useQuery<Holiday[]>({
    queryKey: ['holidays', country, subdivision ?? null, effectiveGroup ?? null, year, type],
    queryFn: () => getHolidays({ country, year: String(year), type, subdivision, group: effectiveGroup }),
    enabled,
    staleTime: DAY,
    retry: 2,
  })
}

export function useCountryHolidays(
  countries: string[],
  year: number,
  enabled: boolean,
): Holiday[][] {
  const results = useQueries({
    queries: countries.map(countryCode => ({
      queryKey: ['holidays', countryCode, null, null, year, 'public'] as const,
      queryFn: () => getHolidays({ country: countryCode, year: String(year), type: 'public' }),
      enabled: enabled && countries.length > 0,
      staleTime: DAY,
    })),
  })
  return results.map(r => r.data ?? [])
}

export function useCompareHolidays(
  country: string,
  regions: ComparisonRegion[],
  year: number,
  enabled: boolean,
) {
  const results = useQueries({
    queries: regions.map(region => ({
      queryKey: region.kind === 'group'
        ? ['holidays', country, null, region.code, year, 'school'] as const
        : ['holidays', country, region.code, null, year, 'school'] as const,
      queryFn: () => getHolidays({ country, year: String(year), type: 'school', [region.kind]: region.code }),
      enabled: enabled && regions.length > 0,
      staleTime: DAY,
    })),
  })
  return { holidays: results.map(r => r.data ?? []), isError: results.some(r => r.isError), isLoading: results.some(r => r.isLoading), retry: () => Promise.all(results.map(r => r.refetch())) }
}

export function useSubdivisions(country = 'DE') {
  return useQuery<Subdivision[]>({
    queryKey: ['subdivisions', country],
    queryFn: async () => {
      const res = await fetch(`/api/subdivisions?country=${encodeURIComponent(country)}`)
      if (!res.ok) throw new Error('Failed to fetch subdivisions')
      return res.json()
    },
    staleTime: DAY,
    retry: 2,
  })
}

export function useHolidayGroups(country = 'DE') {
  return useQuery<HolidayGroup[]>({
    queryKey: ['groups', country],
    queryFn: async () => {
      const res = await fetch(`/api/groups?country=${encodeURIComponent(country)}`)
      if (!res.ok) throw new Error('Failed to fetch holiday groups')
      return res.json()
    },
    staleTime: DAY,
    retry: 2,
  })
}

export function useCountries() {
  return useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: async () => {
      const res = await fetch('/api/countries')
      if (!res.ok) throw new Error('Failed to fetch countries')
      return res.json()
    },
    staleTime: DAY,
    retry: 2,
  })
}
