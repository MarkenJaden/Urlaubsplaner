'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { THEME_KEY } from '@/lib/theme'

const systemDark = () => typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null

/** Sun in dark mode, moon in light mode. Follows the system until the first click. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    let stored: string | null = null
    try { stored = localStorage.getItem(THEME_KEY) } catch { /* storage blocked */ }
    const media = systemDark()
    if (stored || !media) return
    const onChange = () => {
      try { if (localStorage.getItem(THEME_KEY)) return } catch { /* storage blocked */ }
      document.documentElement.classList.toggle('dark', media.matches)
      setDark(media.matches)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const value = !dark
    document.documentElement.classList.toggle('dark', value)
    setDark(value)
    try { localStorage.setItem(THEME_KEY, value ? 'dark' : 'light') } catch { /* storage blocked */ }
  }

  const label = dark ? 'Helles Design' : 'Dunkles Design'
  return (
    <Button variant="ghost" size="icon" onClick={toggle} title={label} aria-label={label}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
