// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { THEME_KEY, themeScript, applyStoredTheme, setThemePreference, getStoredTheme } from './theme'

function mockSystemDark(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark') ? matches : !matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('lib/theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    document.head.innerHTML = '<meta name="color-scheme" content="light dark">'
  })

  it('themeScript applies dark mode from OS preference when nothing is stored', () => {
    mockSystemDark(true)
    new Function(themeScript)()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light dark')
  })

  it('themeScript applies stored dark override even when OS is light', () => {
    mockSystemDark(false)
    localStorage.setItem(THEME_KEY, 'dark')
    new Function(themeScript)()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark')
  })

  it('applyStoredTheme restores dark class even if <html> class was cleared', () => {
    mockSystemDark(false)
    localStorage.setItem(THEME_KEY, 'dark')
    document.documentElement.className = ''
    expect(applyStoredTheme()).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setThemePreference stores override only when diverging from system default and clears when returning', () => {
    mockSystemDark(true)
    // System is dark -> switching to light stores explicit 'light'
    expect(setThemePreference(false)).toBe(false)
    expect(getStoredTheme()).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light')

    // Switching back to dark matches system -> clears storage so system default resumes
    expect(setThemePreference(true)).toBe(true)
    expect(getStoredTheme()).toBeNull()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light dark')
  })
})
