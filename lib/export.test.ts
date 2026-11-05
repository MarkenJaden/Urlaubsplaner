import { describe, it, expect } from 'vitest'
import { exportToCSV, exportToClipboardText, exportToJSON, exportToICS, parseImportFile, parseConfigJSON, exportConfigJSON, formatCustomClipboardExport } from './export'
import type { VacationEntry } from '@/types'

const mkEntry = (date: string, type: 'vacation' | 'gleittag' | 'note', title?: string): VacationEntry => ({
  id: `test-${date}-${type}`,
  date,
  type,
  title: title ?? null,
  userId: 'test',
  year: Number(date.slice(0, 4)),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const entries: VacationEntry[] = [
  mkEntry('2026-05-15', 'vacation', ''),
  mkEntry('2026-05-16', 'gleittag', 'Freitag frei'),
  mkEntry('2026-06-01', 'note', 'Termin'),
]

describe('exportToCSV', () => {
  it('returns header row', () => {
    const csv = exportToCSV(entries)
    expect(csv.startsWith('Datum;Typ;Titel')).toBe(true)
  })

  it('includes all entries', () => {
    const csv = exportToCSV(entries)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(4) // header + 3 entries
  })

  it('formats dates as dd.MM.yyyy', () => {
    const csv = exportToCSV(entries)
    expect(csv).toContain('15.05.2026')
  })

  it('translates types to German', () => {
    const csv = exportToCSV(entries)
    expect(csv).toContain('Urlaub')
    expect(csv).toContain('Gleittag')
    expect(csv).toContain('Notiz')
  })

  it('sorts by date', () => {
    const unsorted = [mkEntry('2026-12-01', 'vacation'), mkEntry('2026-01-01', 'vacation')]
    const csv = exportToCSV(unsorted)
    const lines = csv.split('\n').slice(1)
    expect(lines[0]).toContain('01.01.2026')
    expect(lines[1]).toContain('01.12.2026')
  })

  it('handles empty entries', () => {
    const csv = exportToCSV([])
    expect(csv).toBe('Datum;Typ;Titel')
  })
})

describe('exportToClipboardText', () => {
  it('formats with weekday names', () => {
    const text = exportToClipboardText([mkEntry('2026-05-15', 'vacation')])
    expect(text).toContain('Freitag')
    expect(text).toContain('Urlaub')
  })

  it('includes title after dash', () => {
    const text = exportToClipboardText([mkEntry('2026-05-16', 'gleittag', 'Freitag frei')])
    expect(text).toContain('Freitag frei')
  })

  it('handles empty array', () => {
    expect(exportToClipboardText([])).toBe('')
  })
})

describe('exportToJSON', () => {
  it('returns valid JSON', () => {
    const json = exportToJSON(entries, { year: 2026 })
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('includes vacations and preferences', () => {
    const json = exportToJSON(entries, { budget: 30 })
    const data = JSON.parse(json)
    expect(data.vacations).toHaveLength(3)
    expect(data.preferences.budget).toBe(30)
  })

  it('strips time from dates', () => {
    const json = exportToJSON([mkEntry('2026-05-15T12:00:00Z', 'vacation')], {})
    const data = JSON.parse(json)
    expect(data.vacations[0].date).toBe('2026-05-15')
  })
})

describe('exportToICS', () => {
  it('starts with VCALENDAR', () => {
    const ics = exportToICS(entries)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('contains VEVENT for each entry', () => {
    const ics = exportToICS(entries)
    const events = ics.split('BEGIN:VEVENT').length - 1
    expect(events).toBe(3)
  })

  it('has DTSTART in yyyyMMdd format', () => {
    const ics = exportToICS([mkEntry('2026-05-15', 'vacation')])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260515')
  })

  it('has UID per event', () => {
    const ics = exportToICS(entries)
    expect(ics).toContain('UID:')
  })

  it('handles empty entries', () => {
    const ics = exportToICS([])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})

describe('parseImportFile', () => {
  it('parses valid JSON', () => {
    const data = parseImportFile('{"vacations": [{"date": "2026-01-01", "type": "vacation"}]}')
    expect(data).not.toBeNull()
    expect(data!.vacations).toHaveLength(1)
  })

  it('returns null for invalid JSON', () => {
    expect(parseImportFile('not json')).toBeNull()
  })

  it('returns null for missing vacations array', () => {
    expect(parseImportFile('{"foo": "bar"}')).toBeNull()
  })

  it('returns null for non-array vacations', () => {
    expect(parseImportFile('{"vacations": "string"}')).toBeNull()
  })
})

describe('parseConfigJSON / exportConfigJSON', () => {
  it('round-trips config', () => {
    const config = { year: 2026, budget: 30, country: 'DE' }
    const json = exportConfigJSON(config)
    const parsed = parseConfigJSON(json)
    expect(parsed).toEqual(config)
  })

  it('returns null for invalid JSON', () => {
    expect(parseConfigJSON('broken')).toBeNull()
  })

  it('returns null for non-object', () => {
    expect(parseConfigJSON('"string"')).toBeNull()
    expect(parseConfigJSON('42')).toBeNull()
    expect(parseConfigJSON('null')).toBeNull()
  })
})

describe('export does not change the displayed plan', () => {
  it('sorts a copy and keeps calendar dates in every time zone', () => {
    const unsorted = [mkEntry('2026-06-01', 'note', 'B'), mkEntry('2026-01-01T00:00:00.000Z', 'vacation')]
    expect(exportToCSV(unsorted).split('\n')[1]).toBe('01.01.2026;Urlaub;')
    expect(unsorted[0].date).toBe('2026-06-01')
  })
})

describe('onlyWorkdays export filtering', () => {
  // 2026-06-01 is Monday, 2026-06-07 is Sunday
  const wholeWeek = [
    mkEntry('2026-06-01', 'vacation'),
    mkEntry('2026-06-02', 'vacation'),
    mkEntry('2026-06-03', 'vacation'),
    mkEntry('2026-06-04', 'vacation'),
    mkEntry('2026-06-05', 'vacation'),
    mkEntry('2026-06-06', 'vacation'), // Saturday
    mkEntry('2026-06-07', 'vacation'), // Sunday
  ]

  it('filters out weekend days by default in compact_periods', () => {
    const text = formatCustomClipboardExport(wholeWeek, {
      format: 'compact_periods',
      includeVacations: true,
      includeGleittage: true,
      includeNotes: false,
      includeTitles: false,
      includeWeekNumbers: false,
      includeWeekdays: false,
      includeSummary: false,
      onlyFuture: false,
      onlyWorkdays: true,
    })
    expect(text).toContain('01.06.2026 – 05.06.2026: Urlaub · 5 Arbeitstage')
    expect(text).not.toContain('07.06.2026')
  })

  it('preserves weekend days when onlyWorkdays is explicitly false', () => {
    const text = formatCustomClipboardExport(wholeWeek, {
      format: 'compact_periods',
      includeVacations: true,
      includeGleittage: true,
      includeNotes: false,
      includeTitles: false,
      includeWeekNumbers: false,
      includeWeekdays: false,
      includeSummary: false,
      onlyFuture: false,
      onlyWorkdays: false,
    })
    expect(text).toContain('01.06.2026 – 07.06.2026: Urlaub · 7 Tage')
  })

  it('correctly merges two weeks across the weekend into 10 Arbeitstage', () => {
    const twoWeeks = [
      ...wholeWeek,
      mkEntry('2026-06-08', 'vacation'),
      mkEntry('2026-06-09', 'vacation'),
      mkEntry('2026-06-10', 'vacation'),
      mkEntry('2026-06-11', 'vacation'),
      mkEntry('2026-06-12', 'vacation'),
    ]
    const text = formatCustomClipboardExport(twoWeeks, {
      format: 'compact_periods',
      includeVacations: true,
      includeGleittage: true,
      includeNotes: false,
      includeTitles: false,
      includeWeekNumbers: false,
      includeWeekdays: false,
      includeSummary: false,
      onlyFuture: false,
      onlyWorkdays: true,
    })
    expect(text).toContain('01.06.2026 – 12.06.2026: Urlaub · 10 Arbeitstage')
  })

  it('omits weekend lines in single_days format when onlyWorkdays is true', () => {
    const text = formatCustomClipboardExport(wholeWeek, {
      format: 'single_days',
      includeVacations: true,
      includeGleittage: true,
      includeNotes: false,
      includeTitles: false,
      includeWeekNumbers: false,
      includeWeekdays: true,
      includeSummary: false,
      onlyFuture: false,
      onlyWorkdays: true,
    })
    expect(text).toContain('Freitag')
    expect(text).not.toContain('Samstag')
    expect(text).not.toContain('Sonntag')
  })

  it('supports onlyWorkdays in exportToCSV', () => {
    const csv = exportToCSV(wholeWeek, { onlyWorkdays: true })
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(6) // header + 5 workdays
    expect(csv).toContain('05.06.2026')
    expect(csv).not.toContain('06.06.2026')
    expect(csv).not.toContain('07.06.2026')
  })
})
