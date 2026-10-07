import { describe, expect, it } from 'vitest'
import { parsePreferences, mergePreferences, parseEntry } from './preferences'

describe('personal plan validation', () => {
  it('accepts all 16 German states and rejects invalid state codes', () => {
    expect(parsePreferences({ compareSubdivisions: ['DE-BW', 'DE-NW'] })).toEqual({ compareSubdivisions: ['DE-BW', 'DE-NW'] })
    expect(parsePreferences({ subdivision: 'DE-NOPE' })).toBeNull()
  })
  it('rejects unknown keys, invalid booleans and dangerous budgets', () => {
    expect(parsePreferences({ admin: true })).toBeNull()
    expect(parsePreferences({ showSchoolHolidays: 'true' })).toBeNull()
    expect(parsePreferences({ vacationDaysPerYear: { 2026: -1 } })).toBeNull()
    expect(parsePreferences({ vacationDaysPerYear: { 2026: 0 } })).toEqual({ vacationDaysPerYear: { 2026: 0 } })
  })
  it('counts duplicate comparison state codes only once', () => {
    expect(parsePreferences({ compareSubdivisions: ['DE-NW', 'DE-NW', 'DE-BW'] })).toEqual({ compareSubdivisions: ['DE-NW', 'DE-BW'] })
  })
  it('merges independent preference changes without losing other years', () => {
    expect(mergePreferences({ subdivision: 'DE-NW', vacationDaysPerYear: { 2026: 30 } }, { vacationDaysPerYear: { 2027: 25 } })).toEqual({ subdivision: 'DE-NW', vacationDaysPerYear: { 2026: 30, 2027: 25 } })
  })
  it('normalizes date-only entries and rejects impossible dates and unknown types', () => {
    expect(parseEntry({ date: '2026-03-29', type: 'vacation' })?.date.toISOString()).toBe('2026-03-29T00:00:00.000Z')
    expect(parseEntry({ date: '2026-02-30', type: 'vacation' })).toBeNull()
    expect(parseEntry({ date: '2026-01-01', type: 'admin' })).toBeNull()
  })
})
