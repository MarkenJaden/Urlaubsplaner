export const THEME_KEY = 'urlaubsplaner_theme'

// Runs before the first paint (see app/layout.tsx) so the page never flashes light.
export const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`
