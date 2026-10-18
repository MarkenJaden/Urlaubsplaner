import { describe, expect, it } from 'vitest'
import { holidayDateSet, remainingWorkDays, summarizeVacation, vacationBudget, vacationDayCost } from './vacation-accounting'
import type { Holiday } from '@/types'

const holiday = (startDate: string, endDate = startDate): Holiday => ({ id: startDate, startDate, endDate, type: 'Public', name: [{ language: 'DE', text: 'Feiertag' }], nationwide: true })
const vacation = (date: string) => ({ date: `${date}T00:00:00.000Z`, type: 'vacation' })
// 2026: 1 May is a Friday, 24/31 December are Thursdays, 25/26 December are public holidays.
const holidayDates = holidayDateSet([holiday('2026-05-01'), holiday('2026-12-25', '2026-12-26')])
const options = { holidayDates, halfDaysChristmas: true, countWeekendsAsVacation: false }

describe('vacation day cost', () => {
  it('does not charge weekends and public holidays', () => {
    expect(vacationDayCost('2026-05-01', options)).toBe(0)
    expect(vacationDayCost('2026-05-02', options)).toBe(0)
    expect(vacationDayCost('2026-05-04', options)).toBe(1)
  })
  it('charges weekends when they are working days, but never public holidays', () => {
    const weekends = { ...options, countWeekendsAsVacation: true }
    expect(vacationDayCost('2026-05-02', weekends)).toBe(1)
    expect(vacationDayCost('2026-05-01', weekends)).toBe(0)
  })
  it('charges 24 and 31 December as half days only when enabled', () => {
    expect(vacationDayCost('2026-12-24', options)).toBe(0.5)
    expect(vacationDayCost('2026-12-31', options)).toBe(0.5)
    expect(vacationDayCost('2026-12-24', { ...options, halfDaysChristmas: false })).toBe(1)
  })
})

describe('planned and remaining vacation days', () => {
  it('counts used days with the same cost as the over-budget marking', () => {
    // Thu 30 Apr (1) + Fri 1 May holiday (0) + Sat/Sun (0) + Mon 4 May (1) + 24 Dec (0.5)
    const entries = ['2026-04-30', '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-12-24'].map(vacation)
    const summary = summarizeVacation(entries, 2, options)
    expect(summary.used).toBe(2.5)
    expect([...summary.overBudget]).toEqual(['2026-12-24'])
    expect(2 - summary.used).toBe(-0.5)
  })
  it('ignores Gleittage, notes and duplicate entries for the vacation budget', () => {
    const entries = [vacation('2026-05-04'), vacation('2026-05-04'), { date: '2026-05-05', type: 'gleittag' }, { date: '2026-05-06', type: 'note' }]
    expect(summarizeVacation(entries, 30, options).used).toBe(1)
  })
  it('is independent of the browser time zone', () => {
    expect(summarizeVacation([vacation('2026-01-01')], 30, { ...options, holidayDates: holidayDateSet([holiday('2026-01-01')]) }).used).toBe(0)
  })
  it('counts remaining working days without vacation or Gleittag, notes do not reduce them', () => {
    const entries = [vacation('2026-12-28'), { date: '2026-12-29', type: 'gleittag' }, { date: '2026-12-30', type: 'note' }]
    // From Mon 21 Dec: 21–24, 28–31 are weekdays; 25/26 holidays. Minus vacation and Gleittag.
    expect(remainingWorkDays(2026, entries, options, '2026-12-21')).toBe(6)
    expect(remainingWorkDays(2026, [], { ...options, countWeekendsAsVacation: true }, '2026-12-21')).toBe(9)
    expect(remainingWorkDays(2025, [], options, '2026-12-21')).toBe(0)
  })
  it('uses the per-year budget, then the legacy budget, then 30', () => {
    expect(vacationBudget({ vacationDaysPerYear: { 2026: 25 }, vacationDays: 28 }, 2026)).toBe(25)
    expect(vacationBudget({ vacationDaysPerYear: { 2026: 25 }, vacationDays: 28 }, 2027)).toBe(28)
    expect(vacationBudget({}, 2027)).toBe(30)
  })
})
