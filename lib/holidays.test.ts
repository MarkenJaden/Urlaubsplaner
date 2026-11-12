import { describe, expect, it } from 'vitest'
import { normalizeHolidays, countHolidayStates, countUniqueHolidayDays, isSpecialLocalHoliday } from './holidays'
import type { Holiday } from '@/types'

const holiday: Holiday = { id: 'x', startDate: '2025-12-22', endDate: '2026-01-06', type: 'School', name: [{ language: 'DE', text: 'Weihnachtsferien' }], nationwide: false }
describe('school holiday intervals', () => {
  it('clips intervals to the requested year and includes the last day', () => {
    const holidays = normalizeHolidays([holiday], 2026)
    expect(holidays[0].startDate).toBe('2026-01-01')
    expect(countHolidayStates([holidays]).get('2026-01-06')).toBe(1)
    expect(countHolidayStates([holidays]).has('2026-01-07')).toBe(false)
  })
  it('deduplicates overlapping holidays per state', () => {
    const holidays = normalizeHolidays([holiday, { ...holiday, id: 'duplicate' }], 2026)
    expect(countHolidayStates([holidays, holidays]).get('2026-01-03')).toBe(2)
  })
  it('counts unique calendar days without double counting overlaps', () => {
    const h1: Holiday = { id: '1', startDate: '2026-07-01', endDate: '2026-07-10', type: 'School', name: [{ language: 'DE', text: 'Sommer' }], nationwide: false }
    const h2: Holiday = { id: '2', startDate: '2026-07-05', endDate: '2026-07-15', type: 'School', name: [{ language: 'DE', text: 'Sommer Inseln' }], nationwide: false }
    expect(countUniqueHolidayDays([h1, h2], 2026)).toBe(15)
  })
  it('detects island and localized special exceptions', () => {
    const regular: Holiday = { id: 'reg', startDate: '2026-07-01', endDate: '2026-08-10', type: 'School', name: [{ language: 'DE', text: 'Sommer' }], nationwide: false }
    const island: Holiday = { ...regular, id: 'isl', comment: [{ language: 'DE', text: 'Inseln Sylt, Föhr, Amrum, Helgoland und die Halligen' }] }
    expect(isSpecialLocalHoliday(regular)).toBe(false)
    expect(isSpecialLocalHoliday(island)).toBe(true)
  })
  it('rejects malformed upstream data instead of claiming no holidays exist', () => {
    expect(() => normalizeHolidays([{ ...holiday, startDate: 'invalid' }], 2026)).toThrow()
    expect(() => normalizeHolidays({ error: 'failure' }, 2026)).toThrow()
  })
})
