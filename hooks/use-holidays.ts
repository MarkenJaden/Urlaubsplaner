'use client'

import { useQuery } from '@tanstack/react-query'
import type { Holiday, Country } from '@/types'

export function useHolidays({
  country = 'DE',
  subdivision,
  year,
  type = 'public',
  enabled = true,
}: {
  country?: string
  subdivision?: string
  year: number
  type?: 'public' | 'school'
  enabled?: boolean
}) {
  return useQuery<Holiday[]>({
    queryKey: ['holidays', country, subdivision, year, type],
    queryFn: async () => {
      const params = new URLSearchParams({ country, year: String(year), type })
      if (subdivision) params.set('subdivision', subdivision)
      const res = await fetch(`/api/holidays?${params}`)
      if (!res.ok) throw new Error('Failed to fetch holidays')
      return res.json()
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 2,
  })
}

export function useCountryHolidays(
  countries: string[],
  year: number,
  enabled: boolean,
): Holiday[][] {
  const results = countries.map(countryCode => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = useQuery<Holiday[]>({
      queryKey: ['holidays', countryCode, null, year, 'public'],
      queryFn: async () => {
        const params = new URLSearchParams({
          country: countryCode,
          year: String(year),
          type: 'public',
        })
        const res = await fetch(`/api/holidays?${params}`)
        if (!res.ok) return []
        return res.json()
      },
      enabled: enabled && countries.length > 0,
      staleTime: 24 * 60 * 60 * 1000,
    })
    return data ?? []
  })
  return results
}

export function useCompareHolidays(
  country: string,
  subdivisions: string[],
  year: number,
  enabled: boolean,
): Holiday[][] {
  const results = subdivisions.map(sub => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = useQuery<Holiday[]>({
      queryKey: ['holidays', country, sub, year, 'school'],
      queryFn: async () => {
        const params = new URLSearchParams({ country, year: String(year), type: 'school' })
        params.set('subdivision', sub)
        const res = await fetch(`/api/holidays?${params}`)
        if (!res.ok) return []
        return res.json()
      },
      enabled: enabled && subdivisions.length > 0,
      staleTime: 24 * 60 * 60 * 1000,
    })
    return data ?? []
  })
  return results
}

export function useSubdivisions(country = 'DE') {
  return useQuery({
    queryKey: ['subdivisions', country],
    queryFn: async () => {
      const res = await fetch(`/api/subdivisions?country=${country}`)
      if (!res.ok) throw new Error('Failed to fetch subdivisions')
      return res.json()
    },
    staleTime: 24 * 60 * 60 * 1000,
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
    staleTime: 24 * 60 * 60 * 1000,
    retry: 2,
  })
}
