'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { THEME_KEY, applyStoredTheme, getStoredTheme, setThemePreference } from '@/lib/theme'

const systemDarkMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

/** Sun in dark mode, moon in light mode. Follows the system unless overridden. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(applyStoredTheme())

    const media = systemDarkMedia()
    const onSystemChange = () => {
      if (getStoredTheme() !== null) return
      setDark(applyStoredTheme())
    }
    const onStorageChange = (event: StorageEvent) => {
      if (event.key !== null && event.key !== THEME_KEY) return
      setDark(applyStoredTheme())
    }

    media?.addEventListener('change', onSystemChange)
    window.addEventListener('storage', onStorageChange)
    return () => {
      media?.removeEventListener('change', onSystemChange)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  const toggle = () => {
    setDark(prev => setThemePreference(!prev))
  }

  const label = dark ? 'Helles Design' : 'Dunkles Design'
  return (
    <Button variant="ghost" size="icon" onClick={toggle} title={label} aria-label={label}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
