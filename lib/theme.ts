export const THEME_KEY = 'urlaubsplaner_theme'

// Runs synchronously right after <meta name="color-scheme" content="light dark"> in app/layout.tsx
// so the page never flashes the wrong scheme before first paint.
export const themeScript = `try{var m=document.querySelector('meta[name="color-scheme"]');var t=null;try{t=localStorage.getItem('${THEME_KEY}')}catch(e){}var s=typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||(t!=='light'&&s);document.documentElement.classList.toggle('dark',d);if(m)m.content=(t==='dark'||t==='light')?t:'light dark'}catch(e){}`

export function getStoredTheme(): 'dark' | 'light' | null {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw === 'dark' || raw === 'light' ? raw : null
  } catch {
    return null
  }
}

export function applyStoredTheme(): boolean {
  if (typeof document === 'undefined') return false
  const stored = getStoredTheme()
  const sysDark =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  const isDark = stored === 'dark' || (stored !== 'light' && sysDark)
  document.documentElement.classList.toggle('dark', isDark)
  const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null
  if (meta) {
    meta.content = stored ?? 'light dark'
  }
  return isDark
}

export function setThemePreference(wantDark: boolean): boolean {
  const sysDark =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  const nextStored: 'dark' | 'light' | null =
    wantDark === sysDark ? null : wantDark ? 'dark' : 'light'

  try {
    if (nextStored === null) {
      localStorage.removeItem(THEME_KEY)
    } else {
      localStorage.setItem(THEME_KEY, nextStored)
    }
  } catch {
    // Storage blocked — still apply to current document below.
  }

  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', wantDark)
    const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null
    if (meta) {
      meta.content = nextStored ?? 'light dark'
    }
  }
  return wantDark
}
