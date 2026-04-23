'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Toolbar } from '@/components/calendar/toolbar'
import { YearView } from '@/components/calendar/year-view'
import { useVacations, useToggleVacation } from '@/hooks/use-vacations'
import { useHolidays } from '@/hooks/use-holidays'
import { useProfile } from '@/hooks/use-profile'
import { parseISO, isSameDay } from 'date-fns'
import type { EntryType, UserPreferences } from '@/types'

interface CalendarClientProps {
  userId: string
  preferences: Record<string, unknown>
}

export function CalendarClient({ userId, preferences: initialPrefs }: CalendarClientProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [selectedType, setSelectedType] = useState<EntryType>('vacation')
  const [showHeatmap, setShowHeatmap] = useState(
    (initialPrefs?.showHeatmap as boolean) ?? false
  )
  const [showPublicHolidays, setShowPublicHolidays] = useState(
    (initialPrefs?.showPublicHolidays as boolean) ?? true
  )
  const [showSchoolHolidays, setShowSchoolHolidays] = useState(
    (initialPrefs?.showSchoolHolidays as boolean) ?? true
  )

  const subdivision = initialPrefs?.subdivision as string | undefined
  const country = (initialPrefs?.country as string | undefined) ?? 'DE'
  const vacationDaysTotal = (initialPrefs?.vacationDays as number | undefined) ?? 30

  const { data: profile } = useProfile()
  const { data: entries = [], isLoading: entriesLoading } = useVacations(year)
  const { addMutation, removeMutation } = useToggleVacation(year)

  const { data: publicHolidays = [] } = useHolidays({
    country,
    subdivision,
    year,
    type: 'public',
    enabled: showPublicHolidays && !!subdivision,
  })

  const { data: schoolHolidays = [] } = useHolidays({
    country,
    subdivision,
    year,
    type: 'school',
    enabled: showSchoolHolidays && !!subdivision,
  })

  const handleToggle = useCallback((date: Date, type: EntryType) => {
    const dateStr = date.toISOString().split('T')[0] + 'T00:00:00.000Z'
    const existing = entries.find(
      e => e.type === type && isSameDay(parseISO(e.date), date)
    )
    if (existing) {
      removeMutation.mutate(existing.id)
    } else {
      addMutation.mutate({ date: dateStr, type })
    }
  }, [entries, addMutation, removeMutation])

  const vacationDaysUsed = entries.filter(e => e.type === 'vacation').length

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-4 space-y-4">
        <Toolbar
          year={year}
          onYearChange={setYear}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          showHeatmap={showHeatmap}
          onToggleHeatmap={setShowHeatmap}
          showPublicHolidays={showPublicHolidays}
          onTogglePublicHolidays={setShowPublicHolidays}
          showSchoolHolidays={showSchoolHolidays}
          onToggleSchoolHolidays={setShowSchoolHolidays}
          vacationDaysUsed={vacationDaysUsed}
          vacationDaysTotal={vacationDaysTotal}
        />

        {!subdivision && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Bitte wähle dein Bundesland in den{' '}
            <a href="/settings" className="underline font-medium">Einstellungen</a>,
            um Feiertage und Schulferien anzuzeigen.
          </div>
        )}

        {entriesLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <YearView
            year={year}
            entries={entries}
            publicHolidays={publicHolidays}
            schoolHolidays={schoolHolidays}
            showHeatmap={showHeatmap}
            showPublicHolidays={showPublicHolidays}
            showSchoolHolidays={showSchoolHolidays}
            onToggle={handleToggle}
            selectedType={selectedType}
          />
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-500" /> Urlaub
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-purple-500" /> Gleittag
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" /> Feiertag
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300" /> Schulferien
          </span>
        </div>
      </main>
    </div>
  )
}
