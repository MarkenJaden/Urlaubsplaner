import { describe, expect, it } from 'vitest'
import type { VacationEntry } from '@/types'
import { createCalendar } from './calendar'

const entry: VacationEntry = { id: 'local_0', userId: 'user-1', date: '2026-03-29', type: 'vacation', title: 'Reise, See;\nPause\\Ende', year: 2026, createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-02T10:00:00Z' }

describe('subscription calendar', () => {
  it('uses exclusive next-day ends across DST and year boundaries', () => {
    expect(createCalendar([entry])).toContain('DTEND;VALUE=DATE:20260330')
    expect(createCalendar([{ ...entry, date: '2026-12-31' }])).toContain('DTEND;VALUE=DATE:20270101')
  })
  it('keeps event identities stable after a reload or local array reorder', () => {
    const uid = (ics: string) => ics.split('\r\n').find(line => line.startsWith('UID:'))
    expect(uid(createCalendar([entry]))).toBe(uid(createCalendar([{ ...entry, id: 'local_9', title: 'Changed' }])))
  })
  it('escapes content and prevents line injection', () => {
    expect(createCalendar([entry])).toContain('Reise\\, See\\;\\nPause\\\\Ende')
  })
  it('folds Unicode lines to at most 75 UTF-8 bytes without losing characters', () => {
    const title = '🌴Ä'.repeat(60)
    const ics = createCalendar([{ ...entry, title }])
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(ics.replace(/\r\n /g, '')).toContain(title)
  })
  it('does not mutate the original entries and has a deterministic timestamp', () => {
    const entries = [{ ...entry, date: '2026-12-31' }, entry]
    expect(createCalendar(entries)).toBe(createCalendar(entries))
    expect(entries[0].date).toBe('2026-12-31')
    expect(createCalendar([entry])).toContain('DTSTAMP:20260102T100000Z')
  })
})
