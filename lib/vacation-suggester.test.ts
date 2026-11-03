import { describe, it, expect } from 'vitest'
import { suggestVacation, DEFAULT_PREFERENCES } from './vacation-suggester'
import type { Holiday } from '@/types'

const samplePublicHolidays: Holiday[] = [
  { id: '1', startDate: '2026-01-01', endDate: '2026-01-01', type: 'Public', name: [{ language: 'DE', text: 'Neujahr' }], nationwide: true },
  { id: '2', startDate: '2026-04-03', endDate: '2026-04-03', type: 'Public', name: [{ language: 'DE', text: 'Karfreitag' }], nationwide: true },
  { id: '3', startDate: '2026-04-06', endDate: '2026-04-06', type: 'Public', name: [{ language: 'DE', text: 'Ostermontag' }], nationwide: true },
  { id: '4', startDate: '2026-05-01', endDate: '2026-05-01', type: 'Public', name: [{ language: 'DE', text: 'Tag der Arbeit' }], nationwide: true },
  { id: '5', startDate: '2026-05-14', endDate: '2026-05-14', type: 'Public', name: [{ language: 'DE', text: 'Christi Himmelfahrt' }], nationwide: true },
  { id: '6', startDate: '2026-05-25', endDate: '2026-05-25', type: 'Public', name: [{ language: 'DE', text: 'Pfingstmontag' }], nationwide: true },
  { id: '7', startDate: '2026-12-25', endDate: '2026-12-26', type: 'Public', name: [{ language: 'DE', text: 'Weihnachten' }], nationwide: true },
]

const sampleSchoolHolidays: Holiday[] = [
  { id: 'sh1', startDate: '2026-07-20', endDate: '2026-09-01', type: 'School', name: [{ language: 'DE', text: 'Sommerferien' }], nationwide: false },
]

describe('suggestVacation smart optimizer', () => {
  it('picks high-efficiency bridge days when budget is small', () => {
    const blocks = suggestVacation(
      2026,
      samplePublicHolidays,
      sampleSchoolHolidays,
      new Set(),
      2,
      new Set(),
      { ...DEFAULT_PREFERENCES, goal: 'max_efficiency', planFromToday: false },
      false,
    )
    expect(blocks.length).toBeGreaterThan(0)
    const totalCost = blocks.reduce((s, b) => s + b.cost, 0)
    expect(totalCost).toBeLessThanOrEqual(2)
    // Should include Christi Himmelfahrt Friday bridge (2026-05-15) or Jan 2 bridge (2026-01-02)
    const allDates = blocks.flatMap(b => b.vacationDays)
    expect(allDates.some(d => d === '2026-05-15' || d === '2026-01-02')).toBe(true)
  })

  it('respects reserveDaysToKeep and never exceeds effective budget', () => {
    const blocks = suggestVacation(
      2026,
      samplePublicHolidays,
      sampleSchoolHolidays,
      new Set(),
      15,
      new Set(),
      { ...DEFAULT_PREFERENCES, reserveDaysToKeep: 5, planFromToday: false },
      false,
    )
    const totalCost = blocks.reduce((s, b) => s + b.cost, 0)
    expect(totalCost).toBeLessThanOrEqual(10)
  })

  it('satisfies exact_range mandatory period preference', () => {
    const blocks = suggestVacation(
      2026,
      samplePublicHolidays,
      sampleSchoolHolidays,
      new Set(),
      20,
      new Set(),
      {
        ...DEFAULT_PREFERENCES,
        planFromToday: false,
        periodPreferences: [
          {
            type: 'exact_range',
            months: [8],
            startDate: '2026-08-03',
            endDate: '2026-08-07',
            minDuration: 5,
            label: 'Fest gebuchter Sommerurlaub',
          },
        ],
      },
      false,
    )
    const customBlock = blocks.find(b => b.label === 'Fest gebuchter Sommerurlaub')
    expect(customBlock).toBeDefined()
    expect(customBlock?.vacationDays).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ])
    expect(customBlock?.freeDaysGained).toBe(9) // Includes weekend before and after
  })

  it('satisfies must_have month rule with exactDays', () => {
    const blocks = suggestVacation(
      2026,
      samplePublicHolidays,
      sampleSchoolHolidays,
      new Set(),
      25,
      new Set(),
      {
        ...DEFAULT_PREFERENCES,
        planFromToday: false,
        periodPreferences: [
          {
            type: 'must_have',
            months: [7],
            minDuration: 10,
            exactDays: 10,
            label: 'Juli-Haupturlaub',
          },
        ],
      },
      false,
    )
    const julyBlock = blocks.find(b => b.vacationDays.length === 10 && b.vacationDays.every(d => d.startsWith('2026-07-')))
    expect(julyBlock).toBeDefined()
    expect(julyBlock?.freeDaysGained).toBe(16) // 2 full weeks + 3 weekends = 16 days
  })

  it('excludes avoided months completely', () => {
    const blocks = suggestVacation(
      2026,
      samplePublicHolidays,
      sampleSchoolHolidays,
      new Set(),
      20,
      new Set(),
      {
        ...DEFAULT_PREFERENCES,
        planFromToday: false,
        avoidMonths: [1, 11, 12],
      },
      false,
    )
    const allDates = blocks.flatMap(b => b.vacationDays)
    expect(allDates.some(d => d.startsWith('2026-01-') || d.startsWith('2026-11-') || d.startsWith('2026-12-'))).toBe(false)
  })
})
