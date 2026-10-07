// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarClient } from './calendar-client'

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: { preferences: {} }, isError: false, isLoading: false, refetch: vi.fn() }),
  useUpdatePreferences: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}))
vi.mock('@/hooks/use-vacations', () => ({
  useVacations: () => ({ data: [], isLoading: false, isError: true }),
  useToggleVacation: () => ({ addMutation: { isPending: false, isError: false }, removeMutation: { isPending: false, isError: false } }),
}))
vi.mock('@/hooks/use-holidays', () => ({
  useHolidays: () => ({ data: [], isError: false, isLoading: false, refetch: vi.fn() }),
  useCompareHolidays: () => ({ holidays: [], isError: false, isLoading: false, retry: vi.fn() }),
  useCountryHolidays: () => [], useSubdivisions: () => ({ data: [] }), useCountries: () => ({ data: [] }),
}))
vi.mock('./suggestions-panel', () => ({ SuggestionsPanel: () => null }))
vi.mock('./year-view', () => ({ YearView: () => null }))

afterEach(cleanup)
describe('saved plan loading failures', () => {
  it('shows a failed vacation read even when the profile succeeds and never claims synchronization', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(createElement(QueryClientProvider, { client }, createElement(CalendarClient, { isLoggedIn: true, preferences: {} })))
    expect(screen.getByRole('alert').textContent).toContain('Synchronisieren fehlgeschlagen')
    expect(screen.queryByText('Mit deinem Konto synchronisiert')).toBeNull()
  })
})
