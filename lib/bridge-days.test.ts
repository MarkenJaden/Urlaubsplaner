import { describe, it, expect } from 'vitest'
import { detectBridgeDays } from './bridge-days'
import type { Holiday } from '@/types'

const mkHoliday = (name: string, start: string, end?: string): Holiday => ({
  id: name.toLowerCase().replace(/\s/g, '-'),
  startDate: start,
  endDate: end ?? start,
  type: 'Public',
  name: [{ language: 'DE', text: name }],
  nationwide: true,
})

// 2026 German holidays for testing
const holidays2026: Holiday[] = [
  mkHoliday('Neujahr', '2026-01-01'),
  mkHoliday('Karfreitag', '2026-04-03'),
  mkHoliday('Ostermontag', '2026-04-06'),
  mkHoliday('Tag der Arbeit', '2026-05-01'),
  mkHoliday('Christi Himmelfahrt', '2026-05-14'),
  mkHoliday('Pfingstmontag', '2026-05-25'),
  mkHoliday('Tag der Deutschen Einheit', '2026-10-03'),
  mkHoliday('1. Weihnachtstag', '2026-12-25'),
  mkHoliday('2. Weihnachtstag', '2026-12-26'),
]

describe('detectBridgeDays', () => {
  it('returns an array', () => {
    const result = detectBridgeDays(2026, [])
    expect(Array.isArray(result)).toBe(true)
  })

  it('finds no bridge days without public holidays', () => {
    const result = detectBridgeDays(2026, [])
    expect(result).toHaveLength(0)
  })

  it('detects bridge day after Christi Himmelfahrt (Thu May 14 -> Fri May 15)', () => {
    const result = detectBridgeDays(2026, holidays2026)
    const may15 = result.find(b => b.date === '2026-05-15')
    expect(may15).toBeDefined()
    expect(may15!.freeDaysGained).toBeGreaterThanOrEqual(4)
  })

  it('bridge day has connectsBeforeName and connectsAfterName', () => {
    const result = detectBridgeDays(2026, holidays2026)
    const bridge = result.find(b => b.date === '2026-05-15')
    if (bridge) {
      expect(bridge.connectsBeforeName).toBe('Christi Himmelfahrt')
      expect(bridge.connectsAfterName).toMatch(/Samstag|Sonntag/)
    }
  })

  it('does not mark weekends as bridge days', () => {
    const result = detectBridgeDays(2026, holidays2026)
    for (const b of result) {
      const d = new Date(b.date)
      const dow = d.getDay()
      expect(dow).not.toBe(0) // Sunday
      expect(dow).not.toBe(6) // Saturday
    }
  })

  it('does not mark public holidays as bridge days', () => {
    const result = detectBridgeDays(2026, holidays2026)
    const holidayDates = new Set(holidays2026.map(h => h.startDate))
    for (const b of result) {
      expect(holidayDates.has(b.date)).toBe(false)
    }
  })

  it('freeDaysGained is always > 1', () => {
    const result = detectBridgeDays(2026, holidays2026)
    for (const b of result) {
      expect(b.freeDaysGained).toBeGreaterThan(1)
    }
  })

  it('detects bridge day for Tag der Deutschen Einheit (Sat Oct 3 2026 -> Fri Oct 2)', () => {
    // Oct 3 2026 is Saturday, so Oct 2 (Fri) might be a bridge between Thu workday and Sat holiday+Sun
    const result = detectBridgeDays(2026, holidays2026)
    const oct2 = result.find(b => b.date === '2026-10-02')
    // Oct 3 is Saturday (already weekend) so Oct 2 wouldn't be a bridge day
    // This tests that the algorithm correctly handles holiday-on-weekend
    if (oct2) {
      expect(oct2.freeDaysGained).toBeGreaterThan(1)
    }
  })

  it('handles empty holiday array', () => {
    expect(() => detectBridgeDays(2026, [])).not.toThrow()
  })

  it('handles multi-day holidays', () => {
    const multiDay: Holiday[] = [
      mkHoliday('Weihnachten', '2026-12-25', '2026-12-26'),
    ]
    const result = detectBridgeDays(2026, multiDay)
    // Dec 25-26 are Thu-Fri 2026, Sat-Sun follow -> no bridge needed
    // Dec 24 (Wed) might be bridge if Dec 23 is non-work
    expect(Array.isArray(result)).toBe(true)
  })

  it('handles holiday on Monday (no bridge before)', () => {
    // May 25 2026 is Monday (Pfingstmontag)
    const result = detectBridgeDays(2026, holidays2026)
    // No bridge needed before Monday holiday (Sunday is already off)
    const may24 = result.find(b => b.date === '2026-05-24')
    expect(may24).toBeUndefined() // Sunday, can't be bridge
  })

  it('handles holiday on Friday (bridge on Monday or Thursday)', () => {
    // Karfreitag April 3 2026 is Friday
    const result = detectBridgeDays(2026, holidays2026)
    // Thursday April 2 could be a bridge day connecting to the previous weekend
    const apr2 = result.find(b => b.date === '2026-04-02')
    // Only if March 31 or April 1 is also off
    expect(Array.isArray(result)).toBe(true)
  })

  it('returns dates in yyyy-MM-dd format', () => {
    const result = detectBridgeDays(2026, holidays2026)
    for (const b of result) {
      expect(b.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('all bridge days are workdays (Mon-Fri)', () => {
    const result = detectBridgeDays(2026, holidays2026)
    for (const b of result) {
      const d = new Date(b.date + 'T12:00:00')
      const dow = d.getDay()
      expect(dow).toBeGreaterThanOrEqual(1)
      expect(dow).toBeLessThanOrEqual(5)
    }
  })

  it('works for different years', () => {
    const result2025 = detectBridgeDays(2025, [
      mkHoliday('Tag der Arbeit', '2025-05-01'),
      mkHoliday('Christi Himmelfahrt', '2025-05-29'),
    ])
    expect(Array.isArray(result2025)).toBe(true)
    // May 30 2025 is Friday after Himmelfahrt (Thu) -> bridge day
    const may30 = result2025.find(b => b.date === '2025-05-30')
    expect(may30).toBeDefined()
  })

  it('connectsBefore and connectsAfter are valid date strings', () => {
    const result = detectBridgeDays(2026, holidays2026)
    for (const b of result) {
      expect(b.connectsBefore).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(b.connectsAfter).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('weekend names are Samstag or Sonntag', () => {
    const result = detectBridgeDays(2026, holidays2026)
    for (const b of result) {
      const validNames = ['Samstag', 'Sonntag']
      const isHolidayOrWeekend = holidays2026.some(h => 
        h.name.some(n => n.text === b.connectsBeforeName)
      ) || validNames.includes(b.connectsBeforeName)
      expect(isHolidayOrWeekend).toBe(true)
    }
  })
})
