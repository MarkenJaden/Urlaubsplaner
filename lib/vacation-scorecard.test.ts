import { describe, expect, it } from 'vitest'
import { computePlanScorecard } from './vacation-scorecard'
import type { Holiday, VacationEntry } from '@/types'

function makeEntry(date: string, type: 'vacation' | 'gleittag' | 'note' = 'vacation', title?: string): VacationEntry {
  return {
    id: `${type}-${date}`,
    userId: 'u1',
    date,
    type,
    title,
    year: Number(date.slice(0, 4)),
    createdAt: '',
    updatedAt: '',
  }
}

describe('computePlanScorecard', () => {
  const holidays2027: Holiday[] = [
    {
      id: 'chr-himmelfahrt',
      startDate: '2027-05-06', // Thursday
      endDate: '2027-05-06',
      type: 'Public',
      nationwide: true,
      name: [{ language: 'DE', text: 'Christi Himmelfahrt' }],
    },
  ]

  it('computes 4 free days from 1 Friday bridge day (4.0x efficiency)', () => {
    const res = computePlanScorecard({
      year: 2027,
      entries: [makeEntry('2027-05-07', 'vacation')], // Friday May 7, 2027
      totalDays: 30,
      publicHolidays: holidays2027,
      halfDaysChristmas: true,
      countWeekendsAsVacation: false,
      workDays: [1, 2, 3, 4, 5],
    })

    expect(res.vacationDaysUsed).toBe(1)
    expect(res.totalFreeDaysInBlocks).toBe(4) // Thu May 6 – Sun May 9
    expect(res.efficiency).toBe(4)
    expect(res.bonusFreeDays).toBe(3)
    expect(res.periods).toHaveLength(1)
    expect(res.periods[0]).toMatchObject({
      freeStartDate: '2027-05-06',
      freeEndDate: '2027-05-09',
      bookedStartDate: '2027-05-07',
      bookedEndDate: '2027-05-07',
      freeCalendarDays: 4,
      vacationCost: 1,
    })
  })

  it('merges two consecutive vacation weeks across the middle weekend without double counting', () => {
    const twoWeeks = [
      '2027-07-05', '2027-07-06', '2027-07-07', '2027-07-08', '2027-07-09',
      '2027-07-12', '2027-07-13', '2027-07-14', '2027-07-15', '2027-07-16',
    ].map(d => makeEntry(d))

    const res = computePlanScorecard({
      year: 2027,
      entries: twoWeeks,
      totalDays: 30,
      publicHolidays: [],
      halfDaysChristmas: true,
      countWeekendsAsVacation: false,
      workDays: [1, 2, 3, 4, 5],
    })

    expect(res.vacationDaysUsed).toBe(10)
    expect(res.periods).toHaveLength(1)
    // Sat Jul 3 – Sun Jul 18 = 16 contiguous free days
    expect(res.totalFreeDaysInBlocks).toBe(16)
    expect(res.longestBreakDays).toBe(16)
  })

  it('respects 4-day workweek and half-days on Dec 24 & Dec 31', () => {
    // In 2027: Dec 24 is Friday, Dec 31 is Friday
    const res = computePlanScorecard({
      year: 2027,
      entries: [makeEntry('2027-12-24'), makeEntry('2027-12-31')],
      totalDays: 28,
      publicHolidays: [],
      halfDaysChristmas: true,
      countWeekendsAsVacation: false,
      workDays: [1, 2, 3, 4, 5],
    })

    expect(res.vacationDaysUsed).toBe(1) // 0.5 + 0.5
    expect(res.periods).toHaveLength(2)
  })
})
