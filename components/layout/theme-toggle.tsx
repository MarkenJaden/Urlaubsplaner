'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { THEME_KEY } from '@/lib/theme'

type Theme = 'system' | 'light' | 'dark'

const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const labels: Record<Theme, string> = { system: 'Design: wie System', light: 'Design: hell', dark: 'Design: dunkel' }

const systemDark = () => typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && Boolean(systemDark()?.matches))
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    try { setTheme((localStorage.getItem(THEME_KEY) as Theme | null) ?? 'system') } catch { /* storage blocked */ }
  }, [])

  useEffect(() => {
    apply(theme)
    if (theme !== 'system') return
    const media = systemDark()
    if (!media) return
    const onChange = () => apply('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const cycle = () => {
    const value = next[theme]
    setTheme(value)
    try { if (value === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, value) } catch { /* storage blocked */ }
  }

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  return (
    <Button variant="ghost" size="icon" onClick={cycle} title={`${labels[theme]} – klicken zum Wechseln`} aria-label={labels[theme]}>
      <Icon className="h-4 w-4" />
    </Button>
  )
}
