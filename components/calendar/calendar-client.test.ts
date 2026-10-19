// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarClient } from './calendar-client'
import { nlGroups, nlSubdivisions } from '@/lib/__fixtures__/openholidays'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  profilePreferences: {} as Record<string, unknown>,
  vacationsError: true,
  subdivisions: [] as unknown[],
  groups: [] as unknown[],
  useHolidays: vi.fn((_options: Record<string, unknown>) => ({ data: [], isError: false, isLoading: false, refetch: vi.fn() })),
}))

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: { preferences: mocks.profilePreferences }, isError: false, isLoading: false, refetch: vi.fn() }),
  useUpdatePreferences: () => ({ mutate: mocks.mutate, isPending: false, isError: false }),
}))
vi.mock('@/hooks/use-vacations', () => ({
  useVacations: () => ({ data: [], isLoading: false, isError: mocks.vacationsError }),
  useToggleVacation: () => ({ addMutation: { isPending: false, isError: false }, removeMutation: { isPending: false, isError: false } }),
}))
vi.mock('@/hooks/use-holidays', () => ({
  useHolidays: mocks.useHolidays,
  useCompareHolidays: () => ({ holidays: [], isError: false, isLoading: false, retry: vi.fn() }),
  useCountryHolidays: () => [],
  useSubdivisions: () => ({ data: mocks.subdivisions, isSuccess: true, isError: false, refetch: vi.fn() }),
  useHolidayGroups: () => ({ data: mocks.groups, isLoading: false, isError: false, refetch: vi.fn() }),
  useCountries: () => ({ data: [] }),
}))
vi.mock('./suggestions-panel', () => ({ SuggestionsPanel: () => null }))
vi.mock('./year-view', () => ({ YearView: () => null }))

function renderCalendar(isLoggedIn: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client }, createElement(CalendarClient, { isLoggedIn, preferences: {} })))
}

beforeEach(() => {
  mocks.mutate.mockReset(); mocks.useHolidays.mockClear()
  mocks.profilePreferences = {}; mocks.vacationsError = true; mocks.subdivisions = []; mocks.groups = []
  localStorage.clear()
})
afterEach(cleanup)

describe('saved plan loading failures', () => {
  it('shows a failed vacation read even when the profile succeeds and never claims synchronization', () => {
    renderCalendar(true)
    expect(screen.getByRole('alert').textContent).toContain('Synchronisieren fehlgeschlagen')
    expect(screen.queryByText('Mit deinem Konto synchronisiert')).toBeNull()
  })
})

describe('preferences follow the visible controls', () => {
  it('saves signed-in changes to the account instead of local storage', () => {
    mocks.vacationsError = false
    renderCalendar(true)
    fireEvent.click(screen.getByRole('switch', { name: 'Heatmap' }))
    fireEvent.click(screen.getByLabelText('24./31.12. als halbe Tage zählen (0,5)'))
    expect(mocks.mutate).toHaveBeenCalledWith({ showHeatmap: true })
    expect(mocks.mutate).toHaveBeenCalledWith({ halfDaysChristmas: false })
    expect(localStorage.getItem('urlaubsplaner_config')).toBeNull()
  })
  it('keeps guest changes on this device', () => {
    renderCalendar(false)
    fireEvent.click(screen.getByRole('switch', { name: 'Schulferien' }))
    fireEvent.change(screen.getByLabelText('Urlaubsanspruch (Tage)'), { target: { value: '27' } })
    const stored = JSON.parse(localStorage.getItem('urlaubsplaner_config') ?? '{}')
    expect(stored.showSchoolHolidays).toBe(false)
    expect(stored.vacationDaysPerYear[new Date().getFullYear()]).toBe(27)
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('uses the stored home country and holiday group for school holidays', () => {
    mocks.vacationsError = false
    mocks.profilePreferences = { country: 'NL', subdivision: 'NL-UT', holidayGroup: 'NL-MI' }
    mocks.subdivisions = nlSubdivisions; mocks.groups = nlGroups
    renderCalendar(true)
    const school = mocks.useHolidays.mock.calls.map(([options]) => options).filter(options => options.type === 'school').at(-1)
    expect(school).toMatchObject({ country: 'NL', subdivision: 'NL-UT', group: 'NL-MI', enabled: true })
  })
  it('asks for a holiday region when a province spans several', () => {
    mocks.vacationsError = false
    mocks.profilePreferences = { country: 'NL', subdivision: 'NL-UT' }
    mocks.subdivisions = nlSubdivisions; mocks.groups = nlGroups
    renderCalendar(true)
    expect(screen.getByText(/Hier gelten mehrere Ferienregionen/)).toBeTruthy()
  })
})
