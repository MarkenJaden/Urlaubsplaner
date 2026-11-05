// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DayCell } from './day-cell'
import type { Holiday, VacationEntry } from '@/types'

describe('DayCell visual indicators and Bundesland frame', () => {
  afterEach(cleanup)
  const dummyDate = new Date(2026, 4, 1) // 1. Mai 2026 (Freitag)
  const nationwideHoliday: Holiday = {
    id: 'de-tag-der-arbeit',
    startDate: '2026-05-01',
    endDate: '2026-05-01',
    type: 'Public',
    name: [{ language: 'DE', text: 'Tag der Arbeit' }],
    nationwide: true,
  }
  const regionalHoliday: Holiday = {
    id: 'de-fronleichnam',
    startDate: '2026-06-04',
    endDate: '2026-06-04',
    type: 'Public',
    name: [{ language: 'DE', text: 'Fronleichnam' }],
    nationwide: false,
  }
  const schoolHoliday: Holiday = {
    id: 'de-sommerferien',
    startDate: '2026-07-15',
    endDate: '2026-08-25',
    type: 'School',
    name: [{ language: 'DE', text: 'Sommerferien' }],
    nationwide: false,
  }

  it('renders a public holiday in the own Bundesland with the fine white/light frame', () => {
    render(
      <DayCell
        date={dummyDate}
        entries={[]}
        publicHolidays={[nationwideHoliday]}
        schoolHolidays={[]}
        isWeekend={false}
        isToday={false}
        isOtherMonth={false}
        isPast={false}
        isOverBudget={false}
        showHeatmap={false}
        isBridgeDay={false}
        showBridgeDays={false}
        showOtherMonthDays={true}
        onToggle={vi.fn()}
        selectedType="vacation"
      />
    )

    const cell = screen.getByRole('button', { name: /Tag der Arbeit/ })
    // Must contain the fine white/contrast frame classes
    expect(cell.className).toContain('ring-1')
    expect(cell.className).toContain('ring-inset')
    expect(cell.className).toContain('dark:ring-white/80')
    expect(cell.className).toContain('bg-emerald-100')
  })

  it('renders regional public holidays with a consistent bottom accent in the own Bundesland', () => {
    const fronleichnamDate = new Date(2026, 5, 4) // 4. Juni 2026
    render(
      <DayCell
        date={fronleichnamDate}
        entries={[]}
        publicHolidays={[regionalHoliday]}
        schoolHolidays={[]}
        isWeekend={false}
        isToday={false}
        isOtherMonth={false}
        isPast={false}
        isOverBudget={false}
        showHeatmap={false}
        isBridgeDay={false}
        showBridgeDays={false}
        showOtherMonthDays={true}
        onToggle={vi.fn()}
        selectedType="vacation"
      />
    )

    const cell = screen.getByRole('button', { name: /Fronleichnam/ })
    expect(cell.className).toContain('dark:ring-white/80')
    expect(cell.className).toContain('border-b-2')
    expect(cell.className).toContain('border-b-emerald-600')
  })

  it('renders a prominent StickyNote vector icon for note entries', () => {
    const noteEntry: VacationEntry = {
      id: 'n1',
      userId: 'u1',
      date: '2026-05-01',
      type: 'note',
      title: 'Wichtiger Termin',
      year: 2026,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }
    const { container } = render(
      <DayCell
        date={dummyDate}
        entries={[noteEntry]}
        publicHolidays={[]}
        schoolHolidays={[]}
        isWeekend={false}
        isToday={false}
        isOtherMonth={false}
        isPast={false}
        isOverBudget={false}
        showHeatmap={false}
        isBridgeDay={false}
        showBridgeDays={false}
        showOtherMonthDays={true}
        onToggle={vi.fn()}
        selectedType="vacation"
      />
    )
    const noteMarker = container.querySelector('[title="Notiz: Wichtiger Termin"]')
    expect(noteMarker).toBeTruthy()
    expect(noteMarker?.querySelector('svg.lucide-sticky-note')).toBeTruthy()
  })

  it('preserves the fine white frame and renders a Feiertag indicator dot when vacation is booked on a holiday', () => {
    const vacationEntry: VacationEntry = {
      id: 'v1',
      userId: 'u1',
      date: '2026-05-01',
      type: 'vacation',
      year: 2026,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }

    render(
      <DayCell
        date={dummyDate}
        entries={[vacationEntry]}
        publicHolidays={[nationwideHoliday]}
        schoolHolidays={[]}
        isWeekend={false}
        isToday={false}
        isOtherMonth={false}
        isPast={false}
        isOverBudget={false}
        showHeatmap={false}
        isBridgeDay={false}
        showBridgeDays={false}
        showOtherMonthDays={true}
        onToggle={vi.fn()}
        selectedType="vacation"
      />
    )

    const cell = screen.getByRole('button', { name: /Urlaub an einem gesetzlichen Feiertag/ })
    // Vacation styling:
    expect(cell.className).toContain('bg-blue-600')
    // Fine white frame on top of vacation:
    expect(cell.className).toContain('ring-2 ring-inset ring-white dark:ring-white')
    // Indicator dot rendered:
    expect(cell.querySelector('span[title*="Gesetzlicher Feiertag"]')).not.toBeNull()
  })

  it('renders an amber underline when vacation falls into school holidays', () => {
    const summerDate = new Date(2026, 6, 20) // 20. Juli 2026
    const vacationEntry: VacationEntry = {
      id: 'v2',
      userId: 'u1',
      date: '2026-07-20',
      type: 'vacation',
      year: 2026,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }

    render(
      <DayCell
        date={summerDate}
        entries={[vacationEntry]}
        publicHolidays={[]}
        schoolHolidays={[schoolHoliday]}
        isWeekend={false}
        isToday={false}
        isOtherMonth={false}
        isPast={false}
        isOverBudget={false}
        showHeatmap={false}
        isBridgeDay={false}
        showBridgeDays={false}
        showOtherMonthDays={true}
        onToggle={vi.fn()}
        selectedType="vacation"
      />
    )

    const cell = screen.getByRole('button', { name: /Sommerferien/ })
    expect(cell.className).toContain('bg-blue-600')
    expect(cell.className).toContain('border-b-[3px] border-b-amber-300 dark:border-b-amber-400')
  })

  it('preserves the green public holiday background and displays a note icon when a note is placed on a holiday', () => {
    const noteEntry: VacationEntry = {
      id: 'n1',
      userId: 'u1',
      date: '2026-05-01',
      type: 'note',
      title: 'Familienausflug',
      year: 2026,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }

    render(
      <DayCell
        date={dummyDate}
        entries={[noteEntry]}
        publicHolidays={[nationwideHoliday]}
        schoolHolidays={[]}
        isWeekend={false}
        isToday={false}
        isOtherMonth={false}
        isPast={false}
        isOverBudget={false}
        showHeatmap={false}
        isBridgeDay={false}
        showBridgeDays={false}
        showOtherMonthDays={true}
        onToggle={vi.fn()}
        selectedType="note"
      />
    )

    const cell = screen.getByRole('button', { name: /Tag der Arbeit/ })
    // Public holiday background is NOT replaced by plain gray
    expect(cell.className).toContain('bg-emerald-100')
    expect(cell.className).toContain('dark:ring-white/80')
    // Note icon rendered:
    expect(cell.querySelector('span[title*="Familienausflug"] svg.lucide-sticky-note')).toBeTruthy()
  })
})
