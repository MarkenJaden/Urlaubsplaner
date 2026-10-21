import { describe, expect, it } from 'vitest'
import { parsePreferences, mergePreferences, parseEntry, normalizePreferences, mergeImportedPreferences, countryChangePatch } from './preferences'

describe('personal plan validation', () => {
  it('accepts German states and other countries, rejects malformed codes', () => {
    expect(parsePreferences({ compareSubdivisions: ['DE-BW', 'DE-NW'] })).toEqual({ compareSubdivisions: ['DE-BW', 'DE-NW'] })
    expect(parsePreferences({ country: 'NL', subdivision: 'NL-UT', holidayGroup: 'NL-MI', compareSubdivisions: ['NL-NO', 'NL-ZU'] })).toEqual({ country: 'NL', subdivision: 'NL-UT', holidayGroup: 'NL-MI', compareSubdivisions: ['NL-NO', 'NL-ZU'] })
    expect(parsePreferences({ subdivision: 'de-by' })).toBeNull()
    expect(parsePreferences({ subdivision: 'DE BY' })).toBeNull()
    expect(parsePreferences({ country: 'Deutschland' })).toBeNull()
    expect(parsePreferences({ selectedCountries: ['AT', 'at'] })).toBeNull()
  })
  it('allows clearing location values with null but nothing else', () => {
    expect(parsePreferences({ subdivision: null, holidayGroup: null })).toEqual({ subdivision: null, holidayGroup: null })
    expect(parsePreferences({ showHeatmap: null })).toBeNull()
    expect(mergePreferences({ country: 'NL', subdivision: 'NL-UT', holidayGroup: 'NL-MI' }, { holidayGroup: null })).toEqual({ country: 'NL', subdivision: 'NL-UT' })
  })
  it('drops region codes that do not belong to the home country', () => {
    expect(normalizePreferences({ subdivision: 'NL-UT', compareSubdivisions: ['DE-BY', 'NL-NO'] })).toEqual({ compareSubdivisions: ['DE-BY'] })
    expect(mergePreferences({ subdivision: 'DE-BY', compareSubdivisions: ['DE-NW'], selectedCountries: ['NL', 'AT'] }, countryChangePatch('NL'))).toEqual({ country: 'NL', compareSubdivisions: [], showHeatmap: false, selectedCountries: ['AT'] })
  })
  it('keeps stored settings on import and never mixes the stored and imported locations', () => {
    expect(mergeImportedPreferences({ subdivision: 'DE-BY', showHeatmap: true }, { country: 'NL', subdivision: 'NL-UT', showHeatmap: false, halfDaysChristmas: false })).toEqual({ subdivision: 'DE-BY', showHeatmap: true, halfDaysChristmas: false })
    expect(mergeImportedPreferences({ showHeatmap: true }, { country: 'NL', subdivision: 'NL-UT' })).toEqual({ country: 'NL', subdivision: 'NL-UT', showHeatmap: true })
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

describe('Gleitzeit preferences', () => {
  it('accepts allowances in days or hours and rejects invalid values', () => {
    expect(parsePreferences({ flexUnit: 'hours', flexHoursPerDay: 7.5, flexBudgetPerYear: { 2026: 120 } })).toEqual({ flexUnit: 'hours', flexHoursPerDay: 7.5, flexBudgetPerYear: { 2026: 120 } })
    expect(parsePreferences({ flexUnit: 'weeks' })).toBeNull()
    expect(parsePreferences({ flexHoursPerDay: 0 })).toBeNull()
    expect(parsePreferences({ flexHoursPerDay: 25 })).toBeNull()
    expect(parsePreferences({ flexBudgetPerYear: { 2026: -1 } })).toBeNull()
    expect(parsePreferences({ flexBudgetPerYear: { 2026: 9000 } })).toBeNull()
  })
  it('merges allowances per year', () => {
    expect(mergePreferences({ flexBudgetPerYear: { 2026: 10 } }, { flexBudgetPerYear: { 2027: 12 } })).toEqual({ flexBudgetPerYear: { 2026: 10, 2027: 12 } })
  })
})
