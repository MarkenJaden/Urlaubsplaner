'use client'

import { useMemo, useState } from 'react'
import { PublicYearCalendar } from '@/components/calendar/public-year-calendar'
import { MapPin, GraduationCap } from 'lucide-react'
import type { Holiday } from '@/types'
import { buildPlannerHref } from '@/lib/seo-regions'

export interface StateHolidayData {
  slug: string
  name: string
  subdivision?: string
  schoolHolidays: Holiday[]
  publicHolidays?: Holiday[]
}

interface SchulferienYearCalendarProps {
  year: number
  states: StateHolidayData[]
  initialSlug?: string
  nationwidePublicHolidays?: Holiday[]
}

export function SchulferienYearCalendar({
  year,
  states,
  initialSlug = 'bayern',
  nationwidePublicHolidays = [],
}: SchulferienYearCalendarProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>(() => {
    return states.some(s => s.slug === initialSlug) ? initialSlug : (states[0]?.slug ?? 'bayern')
  })

  const currentState = useMemo(() => {
    return states.find(s => s.slug === selectedSlug) ?? states[0]
  }, [states, selectedSlug])

  if (!currentState) return null

  const effectivePublicHolidays = currentState.publicHolidays && currentState.publicHolidays.length > 0
    ? currentState.publicHolidays
    : nationwidePublicHolidays

  const plannerHref = buildPlannerHref({
    year,
    country: 'DE',
    subdivision: currentState.subdivision,
  })

  return (
    <div className="space-y-4">
      {/* Bundesland Switcher for 12-Month Calendar */}
      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Schulferien-Kalender {year} nach Bundesland
            </h3>
            <p className="text-xs text-muted-foreground">
              Wähle ein Bundesland, um alle Ferientermine {year} im 12-Monate-Kalender anzuzeigen und als A4-Wandkalender auszudrucken.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="state-select" className="text-xs font-medium text-muted-foreground whitespace-nowrap flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Bundesland:</span>
          </label>
          <select
            id="state-select"
            value={currentState.slug}
            onChange={e => setSelectedSlug(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
          >
            {states.map(s => (
              <option key={s.slug} value={s.slug}>
                {s.name} ({s.schoolHolidays.length} Ferien)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 12-Month Graphical Calendar */}
      <PublicYearCalendar
        year={year}
        regionName={currentState.name}
        regionSlug={currentState.slug}
        mode="schulferien"
        publicHolidays={effectivePublicHolidays}
        schoolHolidays={currentState.schoolHolidays}
        plannerHref={plannerHref}
      />
    </div>
  )
}
