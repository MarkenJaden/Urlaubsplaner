'use client'

import { useMemo } from 'react'
import { useHolidayGroups, useSubdivisions } from '@/hooks/use-holidays'
import { DEFAULT_COUNTRY, resolveHolidayGroup } from '@/lib/holiday-regions'
import type { UserPreferences } from '@/types'

/** Resolves the home country, subdivision and holiday group from preferences. */
export function useHomeRegion(preferences: Pick<UserPreferences, 'country' | 'subdivision' | 'holidayGroup'> | null | undefined) {
  const country = preferences?.country ?? DEFAULT_COUNTRY
  const subdivision = preferences?.subdivision
  const subdivisionsQuery = useSubdivisions(country)
  const groupsQuery = useHolidayGroups(country)
  const subdivisions = useMemo(() => subdivisionsQuery.data ?? [], [subdivisionsQuery.data])
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const region = useMemo(() => resolveHolidayGroup(groups, subdivisions, subdivision, preferences?.holidayGroup), [groups, subdivisions, subdivision, preferences?.holidayGroup])
  // Countries without subdivisions need no selection; a group alone is enough for NL.
  const locationReady = Boolean(subdivision || region.group || (subdivisionsQuery.isSuccess && subdivisions.length === 0))
  return {
    country, subdivision, subdivisions, groups, region, locationReady,
    groupsLoading: groupsQuery.isLoading,
    isError: subdivisionsQuery.isError || groupsQuery.isError,
    retry: () => Promise.all([subdivisionsQuery.refetch(), groupsQuery.refetch()]),
  }
}
