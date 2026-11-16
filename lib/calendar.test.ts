import { describe, expect, it } from 'vitest'
import type { VacationEntry } from '@/types'
import { createCalendar, holidayEvents } from './calendar'
import type { Holiday } from '@/types'

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
  it('produces a complete RFC 5545 calendar with CRLF line endings', () => {
    const ics = createCalendar([entry], { name: 'Plan', refreshInterval: 'PT6H' })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Urlaubsplaner//DE\r\nCALSCALE:GREGORIAN\r\n')).toBe(true)
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT6H')
    for (const field of ['UID:', 'DTSTAMP:', 'DTSTART;VALUE=DATE:20260329', 'DTEND;VALUE=DATE:20260330', 'SUMMARY:']) expect(ics).toContain(field)
  })
  it('removes control characters that calendar apps reject', () => {
    expect(createCalendar([{ ...entry, title: 'A\u0007B\u0000C' }])).toContain('SUMMARY:Urlaub: ABC')
  })
  it('merges contiguous vacation days and weekend gaps into one multi-day VEVENT', () => {
    const twoWeeks: VacationEntry[] = [
      '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10',
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17',
    ].map((date, idx) => ({ ...entry, id: `v-${idx}`, date, title: 'Urlaub Fuerteventura' }))
    const ics = createCalendar(twoWeeks)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260706')
    expect(ics).toContain('DTEND;VALUE=DATE:20260718')
    expect(ics).toContain('SUMMARY:Urlaub: Urlaub Fuerteventura')
  })
  it('bridges public holidays between vacation days when holidayDates are given', () => {
    const aroundHoliday: VacationEntry[] = [
      { ...entry, id: 'v1', date: '2026-05-13', title: 'Kurzurlaub' },
      { ...entry, id: 'v2', date: '2026-05-15', title: 'Kurzurlaub' },
    ]
    const ics = createCalendar(aroundHoliday, { holidayDates: ['2026-05-14'] })
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260513')
    expect(ics).toContain('DTEND;VALUE=DATE:20260516')
  })
  it('keeps adjacent vacations with different custom titles as separate events', () => {
    const differentTitles: VacationEntry[] = [
      { ...entry, id: 'v1', date: '2026-07-06', title: 'Urlaub Fuerteventura' },
      { ...entry, id: 'v2', date: '2026-07-07', title: 'Urlaub Fuerteventura' },
      { ...entry, id: 'v3', date: '2026-07-08', title: 'Freizeitparkurlaub' },
    ]
    const ics = createCalendar(differentTitles)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('SUMMARY:Urlaub: Urlaub Fuerteventura')
    expect(ics).toContain('SUMMARY:Urlaub: Freizeitparkurlaub')
  })
  it('does not let a note on the same day split a contiguous vacation block', () => {
    const mixed: VacationEntry[] = [
      { ...entry, id: 'v1', date: '2026-07-06', title: 'Sommerurlaub' },
      { ...entry, id: 'n1', date: '2026-07-06', type: 'note', title: 'Abflug 08:00' },
      { ...entry, id: 'v2', date: '2026-07-07', title: 'Sommerurlaub' },
    ]
    const ics = createCalendar(mixed)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260706\r\nDTEND;VALUE=DATE:20260708\r\nSUMMARY:Urlaub: Sommerurlaub')
    expect(ics).toContain('SUMMARY:Notiz: Abflug 08:00')
  })
})

describe('holiday events in the subscription', () => {
  const school: Holiday = { id: 'summer', startDate: '2026-07-18', endDate: '2026-08-30', type: 'School', name: [{ language: 'DE', text: 'Sommerferien' }], nationwide: false }
  it('emits one multi-day event with an exclusive end instead of one event per day', () => {
    const ics = createCalendar(holidayEvents('user-1', 'school', [school]))
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260718')
    expect(ics).toContain('DTEND;VALUE=DATE:20260831')
    expect(ics).toContain('SUMMARY:Schulferien: Sommerferien')
  })
  it('joins holidays split at the year boundary and keeps their UID stable', () => {
    const christmas = { ...school, id: 'xmas', name: [{ language: 'DE', text: 'Weihnachtsferien' }] }
    const events = holidayEvents('user-1', 'school', [{ ...christmas, startDate: '2026-12-19', endDate: '2026-12-31' }, { ...christmas, startDate: '2027-01-01', endDate: '2027-01-03' }])
    expect(events).toEqual([expect.objectContaining({ date: '2026-12-19', endDate: '2027-01-03' })])
    const uid = (ics: string) => ics.split('\r\n').find(line => line.startsWith('UID:'))
    expect(uid(createCalendar(events))).toBe(uid(createCalendar(holidayEvents('user-1', 'school', [{ ...christmas, startDate: '2026-12-19', endDate: '2027-01-03' }]))))
    expect(createCalendar(events)).toContain('DTEND;VALUE=DATE:20270104')
  })
})
