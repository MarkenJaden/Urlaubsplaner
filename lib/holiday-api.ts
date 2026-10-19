import { normalizeHolidays } from './holidays'
import { findSubdivision, isCountryCode, isRegionCode, resolveHolidayGroup } from './holiday-regions'
import type { Country, HolidayGroup, Subdivision } from '@/types'

const BASE = 'https://openholidaysapi.org'

export class HolidayProviderError extends Error {}

async function request(path: string, params: Record<string, string>): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${BASE}/${path}?${new URLSearchParams(params)}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new HolidayProviderError('Holiday provider unreachable')
  }
  if (!response.ok) throw new HolidayProviderError('Holiday provider unavailable')
  try { return await response.json() } catch { throw new HolidayProviderError('Invalid holiday provider response') }
}

async function requestList<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const data = await request(path, params)
  if (!Array.isArray(data)) throw new HolidayProviderError('Invalid holiday provider response')
  return data as T[]
}

export const fetchCountries = () => requestList<Country>('Countries', { languageIsoCode: 'DE' })
export const fetchSubdivisions = (country: string) => requestList<Subdivision>('Subdivisions', { countryIsoCode: country, languageIsoCode: 'DE' })
export const fetchGroups = (country: string) => requestList<HolidayGroup>('Groups', { countryIsoCode: country, languageIsoCode: 'DE' })

/**
 * School holidays use the holiday group when one is known: OpenHolidays'
 * subdivision filter returns every region of a province (e.g. NL-UT gets both
 * Mitte and Nord summer holidays). Public holidays are filtered by subdivision.
 */
export async function fetchHolidays(country: string, subdivision: string | null | undefined, year: number, type: 'public' | 'school', group?: string | null) {
  const params: Record<string, string> = { countryIsoCode: country, validFrom: `${year}-01-01`, validTo: `${year}-12-31`, languageIsoCode: 'DE' }
  if (type === 'school' && group) params.groupCode = group
  else if (subdivision) params.subdivisionCode = subdivision
  try { return normalizeHolidays(await request(type === 'school' ? 'SchoolHolidays' : 'PublicHolidays', params), year) }
  catch (error) { throw error instanceof HolidayProviderError ? error : new HolidayProviderError('Invalid holiday provider response') }
}

export interface RegionInput { country: string; subdivision?: string | null; group?: string | null }

/**
 * Checks codes against OpenHolidays metadata. The provider answers unknown
 * codes with an empty list, which would otherwise look like "no holidays".
 * Returns an error message for invalid input; throws HolidayProviderError
 * when the metadata cannot be loaded.
 */
export async function validateRegion({ country, subdivision, group }: RegionInput): Promise<string | null> {
  if (!isCountryCode(country)) return 'Ungültiges Land.'
  if (subdivision != null && !isRegionCode(subdivision, country)) return 'Ungültige Region.'
  if (group != null && !isRegionCode(group, country)) return 'Ungültige Ferienregion.'
  if (!(await fetchCountries()).some(c => c.isoCode === country)) return 'Dieses Land wird nicht unterstützt.'
  if (subdivision != null && !findSubdivision(await fetchSubdivisions(country), subdivision)) return 'Unbekannte Region.'
  if (group != null && !(await fetchGroups(country)).some(g => g.code === group)) return 'Unbekannte Ferienregion.'
  return null
}

/** Group for server-side school holiday lookups (feed, suggestions). */
export async function resolveSchoolGroup(country: string, subdivision?: string | null, preferred?: string | null): Promise<string | undefined> {
  const groups = await fetchGroups(country)
  if (!groups.length) return undefined
  const subdivisions = subdivision ? await fetchSubdivisions(country) : []
  return resolveHolidayGroup(groups, subdivisions, subdivision ?? undefined, preferred ?? undefined).group
}
