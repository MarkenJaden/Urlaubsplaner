'use client'

import { useState, useCallback, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Toolbar } from '@/components/calendar/toolbar'
import { YearView } from '@/components/calendar/year-view'
import { useVacations, useToggleVacation } from '@/hooks/use-vacations'
import { useHolidays } from '@/hooks/use-holidays'
import { parseISO, isSameDay, format } from 'date-fns'
import type { EntryType, VacationEntry } from '@/types'

interface CalendarClientProps {
  userId?: string
  preferences: Record<string, unknown>
  isLoggedIn: boolean
}

const LOCAL_STORAGE_KEY = 'urlaubsplaner_local_entries'

function loadLocalEntries(): VacationEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalEntries(entries: VacationEntry[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries))
}

export function CalendarClient({ userId, preferences, isLoggedIn }: CalendarClientProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [selectedType, setSelectedType] = useState<EntryType>('vacation')
  const [showHeatmap, setShowHeatmap] = useState(
    (preferences?.showHeatmap as boolean) ?? false
  )
  const [showPublicHolidays, setShowPublicHolidays] = useState(
    (preferences?.showPublicHolidays as boolean) ?? true
  )
  const [showSchoolHolidays, setShowSchoolHolidays] = useState(
    (preferences?.showSchoolHolidays as boolean) ?? true
  )

  // Lokale Einträge für nicht-eingeloggte Nutzer
  const [localEntries, setLocalEntries] = useState<VacationEntry[]>([])
  useEffect(() => {
    if (!isLoggedIn) setLocalEntries(loadLocalEntries())
  }, [isLoggedIn])

  const subdivision = preferences?.subdivision as string | undefined
  const country = (preferences?.country as string | undefined) ?? 'DE'
  const vacationDaysTotal = (preferences?.vacationDays as number | undefined) ?? 30

  // Server-seitige Einträge (nur wenn eingeloggt)
  const { data: serverEntries = [], isLoading: entriesLoading } = useVacations(year, isLoggedIn)
  const { addMutation, removeMutation } = useToggleVacation(year, isLoggedIn)

  const entries = isLoggedIn ? serverEntries : localEntries.filter(e => {
    const entryYear = new Date(e.date).getFullYear()
    return entryYear === year
  })

  const { data: publicHolidays = [] } = useHolidays({
    country: country ?? 'DE',
    subdivision,
    year,
    type: 'public',
    enabled: showPublicHolidays,
  })

  const { data: schoolHolidays = [] } = useHolidays({
    country: country ?? 'DE',
    subdivision,
    year,
    type: 'school',
    enabled: showSchoolHolidays,
  })

  const handleToggle = useCallback((date: Date, type: EntryType) => {
    if (isLoggedIn) {
      const dateStr = date.toISOString().split('T')[0] + 'T00:00:00.000Z'
      const existing = serverEntries.find(
        e => e.type === type && isSameDay(parseISO(e.date), date)
      )
      if (existing) {
        removeMutation.mutate(existing.id)
      } else {
        addMutation.mutate({ date: dateStr, type })
      }
    } else {
      // Lokal speichern
      const dateStr = format(date, "yyyy-MM-dd") + 'T00:00:00.000Z'
      const existing = localEntries.find(
        e => e.type === type && isSameDay(parseISO(e.date), date)
      )
      let updated: VacationEntry[]
      if (existing) {
        updated = localEntries.filter(e => e.id !== existing.id)
      } else {
        const newEntry: VacationEntry = {
          id: `local_${Date.now()}`,
          date: dateStr,
          type,
          userId: 'local',
          year: date.getFullYear(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        updated = [...localEntries, newEntry]
      }
      setLocalEntries(updated)
      saveLocalEntries(updated)
    }
  }, [isLoggedIn, serverEntries, localEntries, addMutation, removeMutation])

  const vacationDaysUsed = entries.filter(e => e.type === 'vacation').length

  return (
    <div className="min-h-screen bg-background">
      <Header isLoggedIn={isLoggedIn} />
      <main className="container py-4 space-y-4">
        {!isLoggedIn && (
          <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
            💡 Du planst gerade lokal.{' '}
            <a href="/login" className="underline font-medium">Anmelden</a>{' '}
            um deinen Urlaub zu speichern und zu synchronisieren.
          </div>
        )}

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

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Urlaub</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500" /> Gleittag</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" /> Feiertag</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300" /> Schulferien</span>
        </div>
      </main>
    </div>
  )
}
