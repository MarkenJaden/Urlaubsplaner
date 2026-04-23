'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { VacationEntry, EntryType } from '@/types'

export function useVacations(year: number) {
  return useQuery<VacationEntry[]>({
    queryKey: ['vacations', year],
    queryFn: async () => {
      const res = await fetch(`/api/vacations?year=${year}`)
      if (!res.ok) throw new Error('Failed to fetch vacations')
      return res.json()
    },
  })
}

export function useToggleVacation(year: number) {
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
    onMutate: async ({ date, type, title }) => {
      await queryClient.cancelQueries({ queryKey: ['vacations', year] })
      const previous = queryClient.getQueryData<VacationEntry[]>(['vacations', year])
      queryClient.setQueryData<VacationEntry[]>(['vacations', year], (old) => [
        ...(old ?? []),
        { id: `temp-${Date.now()}`, userId: '', date, type, title: title ?? null, year, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['vacations', year], ctx?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations', year] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vacations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete vacation')
      return res.json()
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['vacations', year] })
      const previous = queryClient.getQueryData<VacationEntry[]>(['vacations', year])
      queryClient.setQueryData<VacationEntry[]>(['vacations', year], (old) =>
        (old ?? []).filter((v) => v.id !== id)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['vacations', year], ctx?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations', year] })
    },
  })

  return { addMutation, removeMutation }
}
