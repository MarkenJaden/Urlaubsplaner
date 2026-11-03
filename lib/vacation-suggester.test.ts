import { describe, it, expect } from 'vitest'
import { suggestVacation, recalculateSuggestionBlock, DEFAULT_PREFERENCES } from './vacation-suggester'
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

  it('respects 4-day workweek (Mon-Thu) where Friday is already free', () => {
    const blocks = suggestVacation(
      2026,
      samplePublicHolidays,
      sampleSchoolHolidays,
      new Set(),
      12,
      new Set(),
      {
        ...DEFAULT_PREFERENCES,
        planStartMode: 'year_start',
        workDays: [1, 2, 3, 4], // Monday to Thursday
      },
      false,
    )
    const allDates = blocks.flatMap(b => b.vacationDays)
    // No suggested vacation day should be a Friday (day of week === 5)
    for (const dateStr of allDates) {
      const [y, m, d] = dateStr.split('-').map(Number)
      const dow = new Date(y, m - 1, d).getDay()
      expect(dow).not.toBe(5)
    }
  })

  it('respects planStartMode: after_last_vacation and excludedDateRanges', () => {
    const existingVacation = new Set(['2026-05-04', '2026-05-05', '2026-05-06'])
    const blocks = suggestVacation(
      2026,
      samplePublicHolidays,
      sampleSchoolHolidays,
      existingVacation,
      15,
      new Set(),
      {
        ...DEFAULT_PREFERENCES,
        planStartMode: 'after_last_vacation',
        excludedDateRanges: [
          { startDate: '2026-06-01', endDate: '2026-06-30', label: 'Urlaubssperre Juni' },
        ],
      },
      false,
    )
    const allDates = blocks.flatMap(b => b.vacationDays)
    expect(allDates.every(d => d > '2026-05-06')).toBe(true)
    expect(allDates.some(d => d.startsWith('2026-06-'))).toBe(false)
  })

  it('recalculates suggestion block stats when resizing or moving on calendar', () => {
    const baseBlock = {
      vacationDays: ['2026-05-15'],
      freeDaysGained: 4,
      cost: 1,
      efficiency: 4,
      label: 'Brückentag',
      startDate: '2026-05-15',
      endDate: '2026-05-15',
    }
    // Extend from Monday 2026-05-11 to Friday 2026-05-15 (where Thursday 2026-05-14 is Christi Himmelfahrt)
    const updated = recalculateSuggestionBlock(
      2026,
      '2026-05-11',
      '2026-05-15',
      samplePublicHolidays,
      sampleSchoolHolidays,
      new Set(),
      {
        halfDaysChristmas: false,
        workDays: [1, 2, 3, 4, 5],
      },
      baseBlock,
    )
    expect(updated).not.toBeNull()
    expect(updated?.cost).toBe(4) // Mon, Tue, Wed, Fri (Thu is holiday)
    expect(updated?.freeDaysGained).toBe(9) // Sat May 9 to Sun May 17 = 9 consecutive days off
    expect(updated?.efficiency).toBe(2.25)
  })
})
