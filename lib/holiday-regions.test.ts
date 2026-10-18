import { describe, expect, it } from 'vitest'
import { comparisonRegions, defaultComparisonSelection, groupsForSubdivision, isRegionCode, resolveHolidayGroup } from './holiday-regions'
import { deGroups, nlGroups, nlSubdivisions } from './__fixtures__/openholidays'
import type { HolidayGroup, Subdivision } from '@/types'

const codes = (groups: HolidayGroup[]) => groups.map(g => g.code).sort()
const deSubdivisions: Subdivision[] = [
  { code: 'DE-BY', shortName: 'BY', name: [{ language: 'DE', text: 'Bayern' }] },
  { code: 'DE-MV', shortName: 'MV', name: [{ language: 'DE', text: 'Mecklenburg-Vorpommern' }] },
]
const beGroups: HolidayGroup[] = ['BE-DE', 'BE-FR', 'BE-NL'].map(code => ({ code, name: [{ language: 'DE', text: code }] }))

describe('Netherlands school holiday regions (subdivision → group)', () => {
  it('maps a province in a single region directly to its group', () => {
    expect(resolveHolidayGroup(nlGroups, nlSubdivisions, 'NL-DR')).toEqual({ candidates: [expect.objectContaining({ code: 'NL-NO' })], group: 'NL-NO', ambiguous: false })
    expect(resolveHolidayGroup(nlGroups, nlSubdivisions, 'NL-LI').group).toBe('NL-ZU')
  })
  it('requires a choice for provinces spanning several regions and honours it', () => {
    const utrecht = resolveHolidayGroup(nlGroups, nlSubdivisions, 'NL-UT')
    expect(codes(utrecht.candidates)).toEqual(['NL-MI', 'NL-NO'])
    expect(utrecht).toMatchObject({ group: undefined, ambiguous: true })
    expect(resolveHolidayGroup(nlGroups, nlSubdivisions, 'NL-UT', 'NL-MI')).toMatchObject({ group: 'NL-MI', ambiguous: false })
    expect(codes(resolveHolidayGroup(nlGroups, nlSubdivisions, 'NL-ZH').candidates)).toEqual(['NL-MI', 'NL-NO', 'NL-ZU'])
  })
  it('ignores a stored group that does not apply to the subdivision', () => {
    expect(resolveHolidayGroup(nlGroups, nlSubdivisions, 'NL-DR', 'NL-ZU').group).toBe('NL-NO')
  })
  it('resolves municipalities via the group membership lists', () => {
    expect(codes(groupsForSubdivision(nlGroups, nlSubdivisions, 'NL-UT-UT'))).toEqual(['NL-MI'])
    expect(codes(groupsForSubdivision(nlGroups, nlSubdivisions, 'NL-LI-MA'))).toEqual(['NL-ZU'])
  })
  it('offers the regional groups without a province selection and for comparison', () => {
    expect(codes(groupsForSubdivision(nlGroups, nlSubdivisions))).toEqual(['NL-MI', 'NL-NO', 'NL-ZU'])
    expect(defaultComparisonSelection(nlSubdivisions, nlGroups).sort()).toEqual(['NL-MI', 'NL-NO', 'NL-ZU'])
    expect(comparisonRegions(nlSubdivisions, nlGroups).filter(r => r.kind === 'group').map(r => r.code).sort()).toEqual(['NL-MI', 'NL-NO', 'NL-ZU'])
  })
})

describe('other countries keep working with the same model', () => {
  it('keeps German states without groups unchanged', () => {
    expect(resolveHolidayGroup(deGroups, deSubdivisions, 'DE-BY')).toEqual({ candidates: [], group: undefined, ambiguous: false })
    expect(groupsForSubdivision(deGroups, deSubdivisions)).toEqual([])
    expect(defaultComparisonSelection(deSubdivisions, deGroups)).toEqual(['DE-BY', 'DE-MV'])
    expect(comparisonRegions(deSubdivisions, deGroups).every(r => r.kind === 'subdivision')).toBe(true)
  })
  it('exposes the school types of Mecklenburg-Vorpommern as groups', () => {
    expect(codes(resolveHolidayGroup(deGroups, deSubdivisions, 'DE-MV').candidates)).toEqual(['DE-MV-ABS', 'DE-MV-BBS'])
    expect(resolveHolidayGroup(deGroups, deSubdivisions, 'DE-MV', 'DE-MV-ABS').group).toBe('DE-MV-ABS')
  })
  it('supports countries whose groups are not tied to subdivisions (Belgium)', () => {
    expect(codes(groupsForSubdivision(beGroups, []))).toEqual(['BE-DE', 'BE-FR', 'BE-NL'])
    expect(resolveHolidayGroup(beGroups, [], undefined, 'BE-DE').group).toBe('BE-DE')
  })
  it('validates region code format and country binding', () => {
    expect(isRegionCode('NL-UT-UT', 'NL')).toBe(true)
    expect(isRegionCode('DE-BY', 'NL')).toBe(false)
    expect(isRegionCode('nl-ut')).toBe(false)
    expect(isRegionCode('NL-<script>')).toBe(false)
  })
})
