'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserProfile, UserPreferences } from '@/types'
import { mergePreferences } from '@/lib/preferences'

export function useProfile(enabled = true) {
  return useQuery<UserProfile>({
    queryKey: ['profile'],
    enabled,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
    queryFn: async () => {
      const res = await fetch('/api/profile')
      if (!res.ok) throw new Error('Failed to fetch profile')
      return res.json()
    },
  })
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    scope: { id: 'preferences' },
    mutationKey: ['preferences'],
    mutationFn: async (preferences: UserPreferences) => {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })
      if (!res.ok) throw new Error('Einstellungen konnten nicht gespeichert werden.')
      return res.json()
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ['profile'] })
      const previous = queryClient.getQueryData<UserProfile>(['profile'])
      if (previous) queryClient.setQueryData(['profile'], { ...previous, preferences: mergePreferences(previous.preferences, patch) })
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(['profile'], context.previous)
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['preferences'] }) === 1) queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
