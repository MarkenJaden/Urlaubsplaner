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

  describe('2027 real-world calendar optimization & Sunday/Saturday holiday guard', () => {
    const holidays2027NRW: Holiday[] = [
      { id: '27-1', startDate: '2027-01-01', endDate: '2027-01-01', type: 'Public', name: [{ language: 'DE', text: 'Neujahr' }], nationwide: true },
      { id: '27-2', startDate: '2027-03-26', endDate: '2027-03-26', type: 'Public', name: [{ language: 'DE', text: 'Karfreitag' }], nationwide: true },
      { id: '27-3', startDate: '2027-03-29', endDate: '2027-03-29', type: 'Public', name: [{ language: 'DE', text: 'Ostermontag' }], nationwide: true },
      { id: '27-4', startDate: '2027-05-01', endDate: '2027-05-01', type: 'Public', name: [{ language: 'DE', text: 'Tag der Arbeit' }], nationwide: true }, // Saturday!
      { id: '27-5', startDate: '2027-05-06', endDate: '2027-05-06', type: 'Public', name: [{ language: 'DE', text: 'Christi Himmelfahrt' }], nationwide: true }, // Thursday
      { id: '27-6', startDate: '2027-05-17', endDate: '2027-05-17', type: 'Public', name: [{ language: 'DE', text: 'Pfingstmontag' }], nationwide: true }, // Monday
      { id: '27-7', startDate: '2027-05-27', endDate: '2027-05-27', type: 'Public', name: [{ language: 'DE', text: 'Fronleichnam' }], nationwide: false }, // Thursday
      { id: '27-8', startDate: '2027-10-03', endDate: '2027-10-03', type: 'Public', name: [{ language: 'DE', text: 'Tag der Deutschen Einheit' }], nationwide: true }, // Sunday!
      { id: '27-9', startDate: '2027-11-01', endDate: '2027-11-01', type: 'Public', name: [{ language: 'DE', text: 'Allerheiligen' }], nationwide: false }, // Monday
      { id: '27-10', startDate: '2027-12-25', endDate: '2027-12-26', type: 'Public', name: [{ language: 'DE', text: 'Weihnachten' }], nationwide: true }, // Sat & Sun!
    ]

    const schoolHolidays2027NRW: Holiday[] = [
      { id: 'sh27-1', startDate: '2027-07-19', endDate: '2027-08-31', type: 'School', name: [{ language: 'DE', text: 'Sommerferien' }], nationwide: false },
    ]

    it('never creates a fake bridge day for Sunday Oct 3, 2027 (Tag der Deutschen Einheit) or Saturday May 1, 2027', () => {
      for (const goal of ['max_efficiency', 'balanced', 'long_breaks', 'distributed'] as const) {
        const blocks = suggestVacation(
          2027,
          holidays2027NRW,
          schoolHolidays2027NRW,
          new Set(),
          30,
          new Set(),
          { ...DEFAULT_PREFERENCES, goal, planStartMode: 'year_start' },
          false,
        )
        for (const b of blocks) {
          expect(b.holidaysIncluded).not.toContain('Tag der Deutschen Einheit')
          expect(b.holidaysIncluded).not.toContain('Tag der Arbeit')
          expect(b.holidaysIncluded).not.toContain('Weihnachten')
          expect(b.label).not.toContain('Tag der Deutschen Einheit')
          expect(b.vacationDays).not.toContain('2027-10-03')
          // Should never suggest a 1-day island on Monday 2027-10-04
          if (b.vacationDays.length === 1) {
            expect(b.vacationDays[0]).not.toBe('2027-10-04')
          }
        }
      }
    })

    it('picks the two true 4.0x bridge days in 2027 (May 7 & May 28) when budget is 2', () => {
      const blocks = suggestVacation(
        2027,
        holidays2027NRW,
        schoolHolidays2027NRW,
        new Set(),
        2,
        new Set(),
        { ...DEFAULT_PREFERENCES, goal: 'max_efficiency', planStartMode: 'year_start', distributeEvenly: false },
        false,
      )
      const allDates = blocks.flatMap(b => b.vacationDays).sort()
      expect(allDates).toEqual(['2027-05-07', '2027-05-28'])
      const totalFree = blocks.reduce((s, b) => s + b.freeDaysGained, 0)
      expect(totalFree).toBe(8) // 4 + 4 free days for 2 vacation days = 4.0x
    })

    it('builds a comprehensive 30-day 2027 plan without overlapping spans or stranded half-days', () => {
      const blocks = suggestVacation(
        2027,
        holidays2027NRW,
        schoolHolidays2027NRW,
        new Set(),
        30,
        new Set(),
        { ...DEFAULT_PREFERENCES, goal: 'balanced', planStartMode: 'year_start', halfDaysChristmas: true },
        false,
      )
      const totalCost = blocks.reduce((s, b) => s + b.cost, 0)
      const totalFree = blocks.reduce((s, b) => s + b.freeDaysGained, 0)
      expect(totalCost).toBe(30)
      expect(totalFree).toBeGreaterThanOrEqual(63)

      // Ensure no two blocks have overlapping startDate..endDate free spans
      for (let i = 1; i < blocks.length; i++) {
        expect(blocks[i].startDate > blocks[i - 1].endDate).toBe(true)
      }
    })

    it('optimizes 2027 for a 4-day workweek (Mon-Thu) where Christi Himmelfahrt + Friday off gives 10 days for 3 vacation days', () => {
      const blocks = suggestVacation(
        2027,
        holidays2027NRW,
        schoolHolidays2027NRW,
        new Set(),
        6,
        new Set(),
        {
          ...DEFAULT_PREFERENCES,
          goal: 'max_efficiency',
          planStartMode: 'year_start',
          workDays: [1, 2, 3, 4], // Mon-Thu
          distributeEvenly: false,
        },
        false,
      )
      const totalCost = blocks.reduce((s, b) => s + b.cost, 0)
      const totalFree = blocks.reduce((s, b) => s + b.freeDaysGained, 0)
      expect(totalCost).toBeLessThanOrEqual(6)
      // In a Mon-Thu week, May 3-5 (3 days) + May 6 (Thu holiday) + May 7-9 (Fri-Sun off) + Apr 30-May 2 (Fri-Sun off) = 10 days off for 3 days!
      // And May 24-26 (3 days) around Fronleichnam = 10 days off for 3 days!
      expect(totalFree).toBeGreaterThanOrEqual(19)
    })
  })
})
