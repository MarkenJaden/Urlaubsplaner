import { afterEach, describe, expect, it, vi } from 'vitest'
import { nlGroups, nlPublicHolidays2026, nlSchoolHolidays2026, nlSubdivisions } from './__fixtures__/openholidays'

const user = vi.hoisted(() => ({ getUserByToken: vi.fn() }))
vi.mock('@/lib/user', () => user)

const { GET } = await import('@/app/api/calendar/[token]/feed.ics/route')

const token = 'a'.repeat(43)
const stored = (preferences: Record<string, unknown>) => ({
  id: 'user-1', name: 'Jan', preferences,
  vacations: [
    { id: 'v1', userId: 'user-1', date: new Date('2026-12-31T00:00:00Z'), type: 'vacation', title: null, year: 2026, createdAt: new Date('2026-01-01T10:00:00Z'), updatedAt: new Date('2026-01-02T10:00:00Z') },
    { id: 'n1', userId: 'user-1', date: new Date('2026-06-01T00:00:00Z'), type: 'note', title: 'Arzt, privat', year: 2026, createdAt: new Date('2026-01-01T10:00:00Z'), updatedAt: new Date('2026-01-01T10:00:00Z') },
  ],
})
const call = (value = token) => GET(new Request(`http://localhost/api/calendar/${value}/feed.ics`), { params: Promise.resolve({ token: value }) })

function mockOpenHolidays() {
  const calls: URL[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input)
    calls.push(url)
    const group = url.searchParams.get('groupCode')
    const year = url.searchParams.get('validFrom')?.slice(0, 4)
    const body = url.pathname === '/Groups' ? nlGroups
      : url.pathname === '/Subdivisions' ? nlSubdivisions
      : year !== '2026' ? []
      : url.pathname === '/SchoolHolidays' ? nlSchoolHolidays2026.filter(h => !group || h.groups?.some(g => g.code === group))
      : nlPublicHolidays2026
    return new Response(JSON.stringify(body))
  }))
  return calls
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); user.getUserByToken.mockReset() })

describe('calendar subscription feed', () => {
  it('rejects malformed and unknown tokens without leaking data', async () => {
    expect((await call('short')).status).toBe(404)
    expect(user.getUserByToken).not.toHaveBeenCalled()
    user.getUserByToken.mockResolvedValue(null)
    const response = await call()
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not found')
  })
  it('serves a valid iCalendar document for the token owner only', async () => {
    user.getUserByToken.mockResolvedValue(stored({}))
    const response = await call()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(response.headers.get('cache-control')).toContain('no-store')
    const ics = await response.text()
    expect(user.getUserByToken).toHaveBeenCalledWith(token)
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101')
    expect(ics).toContain('UID:user-1-2026-12-31-vacation@urlaubsplaner')
    expect(ics).not.toContain('Arzt')
  })
  it('includes escaped notes only when enabled', async () => {
    user.getUserByToken.mockResolvedValue(stored({ feedIncludeNotes: true }))
    expect(await (await call()).text()).toContain('SUMMARY:Notiz: Arzt\\, privat')
  })
  it('uses the Dutch holiday region for school holidays', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-18T12:00:00Z'))
    const calls = mockOpenHolidays()
    user.getUserByToken.mockResolvedValue(stored({ country: 'NL', subdivision: 'NL-UT', holidayGroup: 'NL-MI', feedIncludeSchoolHolidays: true, feedIncludePublicHolidays: true }))
    const ics = await (await call()).text()
    expect(calls.filter(url => url.pathname === '/SchoolHolidays').every(url => url.searchParams.get('groupCode') === 'NL-MI')).toBe(true)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260718\r\nDTEND;VALUE=DATE:20260831')
    expect(ics).not.toContain('DTSTART;VALUE=DATE:20260704')
    expect(ics).toContain('SUMMARY:Feiertag: Königstag')
  })
  it('returns 503 instead of a partial feed when holidays are unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })))
    user.getUserByToken.mockResolvedValue(stored({ subdivision: 'DE-BY', feedIncludePublicHolidays: true }))
    const response = await call()
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('300')
  })
})
