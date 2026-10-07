import { normalizeHolidays } from './holidays'

export async function fetchHolidays(country: string, subdivision: string | null | undefined, year: number, type: 'public' | 'school') {
  const params = new URLSearchParams({ countryIsoCode: country, validFrom: `${year}-01-01`, validTo: `${year}-12-31`, languageIsoCode: 'DE' })
  if (subdivision) params.set('subdivisionCode', subdivision)
  const response = await fetch(`https://openholidaysapi.org/${type === 'school' ? 'SchoolHolidays' : 'PublicHolidays'}?${params}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error('Holiday provider unavailable')
  return normalizeHolidays(await response.json(), year)
}
