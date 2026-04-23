'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { VacationEntry, EntryType } from '@/types'

export function useVacations(year: number, enabled = true) {
  return useQuery<VacationEntry[]>({
    queryKey: ['vacations', year],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/vacations?year=${year}`)
      if (!res.ok) throw new Error('Failed to fetch vacations')
      return res.json()
    },
  })
}

export function useToggleVacation(year: number, enabled = true) {
  const queryClient = useQueryClient()

  const addMutation = useMutation({
    mutationFn: async ({ date, type, title }: { date: string; type: EntryType; title?: string }) => {
      const res = await fetch('/api/vacations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type, title }),
      })
      if (!res.ok) throw new Error('Failed to add vacation')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations', year] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vacations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove vacation')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations', year] })
    },
  })

  return { addMutation, removeMutation }
}
