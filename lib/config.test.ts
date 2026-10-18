// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyConfigPatch, configToEntries, defaultConfig, loadConfig, mergeImportedEntries, saveConfig, toggleEntry } from './config'

beforeEach(() => localStorage.clear())

describe('guest plan import', () => {
  const current = [{ date: '2026-05-04', type: 'vacation' }, { date: '2026-05-05', type: 'note', title: 'Arzt' }]

  it('never removes or overwrites identical existing entries', () => {
    const imported = [{ date: '2026-05-04', type: 'vacation' }, { date: '2026-05-05T00:00:00.000Z', type: 'note', title: 'Anderer Text' }]
    expect(mergeImportedEntries(current, imported)).toEqual(current)
  })
  it('is idempotent across repeated imports and adds only missing entries', () => {
    const imported = [{ date: '2026-05-04', type: 'vacation' }, { date: '2026-05-06', type: 'vacation' }, { date: '2026-05-06', type: 'vacation' }]
    const once = mergeImportedEntries(current, imported)
    expect(once).toEqual([...current, { date: '2026-05-06', type: 'vacation' }])
    expect(mergeImportedEntries(once, imported)).toEqual(once)
  })
  it('keeps a vacation and a Gleittag on the same day as separate entries', () => {
    expect(mergeImportedEntries(current, [{ date: '2026-05-04', type: 'gleittag' }])).toHaveLength(3)
  })
  it('toggling is reserved for clicks on the calendar', () => {
    expect(toggleEntry(current, '2026-05-04', 'vacation')).toEqual([current[1]])
    expect(toggleEntry(current, '2026-05-07', 'note', 'Termin')).toContainEqual({ date: '2026-05-07', type: 'note', title: 'Termin' })
  })
})

describe('guest settings', () => {
  it('stores settings locally with the same merge rules as accounts', () => {
    const next = applyConfigPatch({ ...defaultConfig(), country: 'NL', subdivision: 'NL-UT', vacationDaysPerYear: { 2026: 30 } }, { holidayGroup: 'NL-MI', vacationDaysPerYear: { 2027: 25 } })
    saveConfig(next)
    expect(loadConfig()).toMatchObject({ country: 'NL', subdivision: 'NL-UT', holidayGroup: 'NL-MI', vacationDaysPerYear: { 2026: 30, 2027: 25 } })
    expect(applyConfigPatch(next, { subdivision: null, holidayGroup: null }).subdivision).toBeUndefined()
  })
  it('assigns date-only entries to their calendar year in every time zone', () => {
    const config = { ...defaultConfig(), entries: [{ date: '2026-01-01', type: 'vacation' }, { date: '2025-12-31', type: 'vacation' }] }
    expect(configToEntries(config, 2026).map(e => e.date)).toEqual(['2026-01-01T00:00:00.000Z'])
  })
})
