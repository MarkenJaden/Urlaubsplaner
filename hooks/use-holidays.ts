'use client'

import { useQuery } from '@tanstack/react-query'
import type { Holiday } from '@/types'

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
    staleTime: 24 * 60 * 60 * 1000, // 24h
  })
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
  })
}
