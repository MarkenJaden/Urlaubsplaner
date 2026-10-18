import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchHolidays, HolidayProviderError, resolveSchoolGroup, validateRegion } from './holiday-api'
import { deGroups, nlGroups, nlPublicHolidays2026, nlSchoolHolidays2026, nlSubdivisions } from './__fixtures__/openholidays'

type Route = (url: URL) => unknown

/** Simulates OpenHolidays, including its groupCode filter. */
function mockProvider(route: Route) {
  const calls: URL[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input)
    calls.push(url)
    const body = route(url)
    return body instanceof Response ? body : new Response(JSON.stringify(body), { status: 200 })
  }))
  return calls
}

const openHolidays: Route = url => {
  const country = url.searchParams.get('countryIsoCode')
  const group = url.searchParams.get('groupCode')
  switch (url.pathname) {
    case '/Countries': return [{ isoCode: 'DE', name: [], officialLanguages: ['DE'] }, { isoCode: 'NL', name: [], officialLanguages: ['NL'] }]
    case '/Subdivisions': return country === 'NL' ? nlSubdivisions : [{ code: 'DE-BY', shortName: 'BY', name: [] }]
    case '/Groups': return country === 'NL' ? nlGroups : deGroups
    case '/SchoolHolidays': return country === 'NL' ? nlSchoolHolidays2026.filter(h => !group || h.groups?.some(g => g.code === group)) : []
    case '/PublicHolidays': return country === 'NL' ? nlPublicHolidays2026 : []
    default: return new Response('not found', { status: 404 })
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('OpenHolidays school holidays by group', () => {
  it('loads Dutch school holidays with groupCode so regions are not mixed', async () => {
    const calls = mockProvider(openHolidays)
    const holidays = await fetchHolidays('NL', 'NL-UT', 2026, 'school', 'NL-MI')
    expect(calls[0].searchParams.get('groupCode')).toBe('NL-MI')
    expect(calls[0].searchParams.has('subdivisionCode')).toBe(false)
    const summer = holidays.filter(h => h.name[0].text === 'Sommerferien')
    expect(summer).toEqual([expect.objectContaining({ startDate: '2026-07-18', endDate: '2026-08-30' })])
    expect(holidays.find(h => h.name[0].text === 'Weihnachtsferien')?.startDate).toBe('2026-01-01')
  })
  it('keeps the subdivision filter for public holidays and German states', async () => {
    const calls = mockProvider(openHolidays)
    await fetchHolidays('NL', 'NL-UT', 2026, 'public', 'NL-MI')
    await fetchHolidays('DE', 'DE-BY', 2026, 'school')
    expect(calls[0].searchParams.get('subdivisionCode')).toBe('NL-UT')
    expect(calls[0].searchParams.has('groupCode')).toBe(false)
    expect(calls[1].pathname).toBe('/SchoolHolidays')
    expect(calls[1].searchParams.get('subdivisionCode')).toBe('DE-BY')
  })
  it('drops bulky subdivision lists but keeps the group references', async () => {
    mockProvider(openHolidays)
    const [holiday] = await fetchHolidays('NL', null, 2026, 'school', 'NL-NO')
    expect(holiday).not.toHaveProperty('subdivisions')
    expect(holiday.groups?.map(g => g.code)).toContain('NL-NO')
  })
  it('resolves the group server-side for feeds and suggestions', async () => {
    mockProvider(openHolidays)
    expect(await resolveSchoolGroup('NL', 'NL-DR')).toBe('NL-NO')
    expect(await resolveSchoolGroup('NL', 'NL-UT')).toBeUndefined()
    expect(await resolveSchoolGroup('NL', 'NL-UT', 'NL-MI')).toBe('NL-MI')
    expect(await resolveSchoolGroup('DE', 'DE-BY')).toBeUndefined()
  })
})

describe('region validation and provider failures', () => {
  it('rejects unknown countries, subdivisions and groups instead of showing empty holidays', async () => {
    mockProvider(openHolidays)
    expect(await validateRegion({ country: 'NL', subdivision: 'NL-UT', group: 'NL-MI' })).toBeNull()
    expect(await validateRegion({ country: 'XX' })).toMatch(/nicht unterstützt/)
    expect(await validateRegion({ country: 'NL', subdivision: 'NL-XX' })).toMatch(/Unbekannte Region/)
    expect(await validateRegion({ country: 'NL', group: 'NL-XX' })).toMatch(/Unbekannte Ferienregion/)
    expect(await validateRegion({ country: 'NL', subdivision: 'DE-BY' })).toMatch(/Ungültige Region/)
    expect(await validateRegion({ country: 'nl' })).toMatch(/Ungültiges Land/)
  })
  it('reports provider errors, timeouts and malformed data as HolidayProviderError', async () => {
    mockProvider(() => new Response('down', { status: 503 }))
    await expect(fetchHolidays('NL', null, 2026, 'public')).rejects.toBeInstanceOf(HolidayProviderError)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timeout', 'TimeoutError') }))
    await expect(fetchHolidays('NL', null, 2026, 'public')).rejects.toBeInstanceOf(HolidayProviderError)
    mockProvider(() => [{ id: 'x', startDate: 'invalid' }])
    await expect(fetchHolidays('NL', null, 2026, 'public')).rejects.toBeInstanceOf(HolidayProviderError)
  })
})
