'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { parseISO } from 'date-fns'
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
  const queryKey = ['vacations', year]

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
    onMutate: async ({ date, type, title }) => {
      if (!enabled) return
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<VacationEntry[]>(queryKey)
      const dateKey = date.split('T')[0]
      const optimisticEntry: VacationEntry = {
        id: `optimistic_${dateKey}_${type}`,
        userId: 'optimistic',
        date,
        type,
        title,
        year: parseISO(date).getFullYear(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      queryClient.setQueryData<VacationEntry[]>(queryKey, old => {
        const withoutDuplicate = (old ?? []).filter(e => !(e.date.split('T')[0] === dateKey && e.type === type))
        return [...withoutDuplicate, optimisticEntry].sort((a, b) => a.date.localeCompare(b.date))
      })

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vacations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove vacation')
    },
    onMutate: async (id) => {
      if (!enabled) return
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<VacationEntry[]>(queryKey)
      queryClient.setQueryData<VacationEntry[]>(queryKey, old => (old ?? []).filter(e => e.id !== id))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return { addMutation, removeMutation }
}
