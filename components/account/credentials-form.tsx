'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { KeyRound, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CredentialsForm({
  mode,
  legacyLoginEnabled = false,
  googleEnabled = false,
  githubEnabled = false,
}: {
  mode: 'login' | 'register' | 'recover'
  legacyLoginEnabled?: boolean
  googleEnabled?: boolean
  githubEnabled?: boolean
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryInput, setRecoveryInput] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedKey, setSavedKey] = useState(false)
  const heading = mode === 'register' ? 'Dein Konto erstellen' : mode === 'recover' ? 'Konto wiederherstellen' : 'Willkommen zurück'
  const showSocial = mode !== 'recover' && (googleEnabled || githubEnabled)

  async function login() {
    const result = await signIn('credentials', { username, password, redirect: false })
    if (result?.error) throw new Error('Anmeldung fehlgeschlagen. Prüfe deine Angaben oder versuche es später erneut.')
    window.location.assign('/')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (mode === 'login') { await login(); return }
      const response = await fetch(`/api/account/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          ...(mode === 'register' ? { email } : {}),
          ...(mode === 'recover' ? { recoveryKey: recoveryInput } : {}),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Bitte erneut versuchen.')
      setRecoveryKey(data.recoveryKey)
    } catch (error) { setError(error instanceof Error ? error.message : 'Verbindung fehlgeschlagen.') }
    finally { setBusy(false) }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold"><img src="/icon.svg" alt="" className="h-6 w-6" /> Urlaubsplaner</Link>
        <div><h1 className="text-2xl font-semibold tracking-tight">{heading}</h1><p className="mt-2 text-sm text-muted-foreground">Dein Urlaub und deine Einstellungen auf allen Geräten.</p></div>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {recoveryKey ? (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 font-medium"><ShieldCheck className="h-5 w-5" /> Wiederherstellungsschlüssel sichern</h2>
            <p className="text-sm text-muted-foreground">Speichere diesen Schlüssel in deinem Passwortmanager. Er wird nur jetzt angezeigt und ersetzt bei Bedarf dein vergessenes Passwort. Nach einer Wiederherstellung ist der alte Schlüssel ungültig.</p>
            <textarea aria-label="Wiederherstellungsschlüssel" readOnly value={recoveryKey} className="w-full resize-none rounded-lg border bg-muted p-3 font-mono text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={savedKey} onChange={e => setSavedKey(e.target.checked)} /> Ich habe den Schlüssel sicher gespeichert.</label>
            <Button className="w-full" disabled={!savedKey || busy} onClick={async () => { setBusy(true); try { await login() } catch { setError('Konto gespeichert. Bitte melde dich mit deinem neuen Passwort an.'); setBusy(false) } }}>Zum Urlaubsplaner <ArrowRight className="h-4 w-4" /></Button>
          </div>
        ) : (
          <>
            {showSocial && (
              <div className="space-y-2.5">
                {googleEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className="w-full justify-center gap-2.5"
                    onClick={() => signIn('google', { callbackUrl: '/' })}
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z" />
                      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z" />
                    </svg>
                    Mit Google {mode === 'register' ? 'registrieren' : 'anmelden'}
                  </Button>
                )}
                {githubEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className="w-full justify-center gap-2.5"
                    onClick={() => signIn('github', { callbackUrl: '/' })}
                  >
                    <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                    </svg>
                    Mit GitHub {mode === 'register' ? 'registrieren' : 'anmelden'}
                  </Button>
                )}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">oder mit Benutzername</span></div>
                </div>
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <label className="block space-y-1.5 text-sm font-medium">Benutzername<input required autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,31}" value={username} onChange={e => setUsername(e.target.value)} className="min-h-11 w-full rounded-lg border bg-background px-3" /></label>
              {mode !== 'login' && <p className="text-xs text-muted-foreground">3–32 Zeichen: Buchstaben, Zahlen, Punkt, Bindestrich oder Unterstrich.</p>}
              {mode === 'register' && (
                <label className="block space-y-1.5 text-sm font-medium">
                  E-Mail-Adresse <span className="font-normal text-muted-foreground">(optional)</span>
                  <input
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    placeholder="name@beispiel.de"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="min-h-11 w-full rounded-lg border bg-background px-3"
                  />
                </label>
              )}
              {mode === 'recover' && <label className="block space-y-1.5 text-sm font-medium">Wiederherstellungsschlüssel<input required autoComplete="off" value={recoveryInput} onChange={e => setRecoveryInput(e.target.value.trim())} className="min-h-11 w-full rounded-lg border bg-background px-3" /></label>}
              <label className="block space-y-1.5 text-sm font-medium">
                {mode === 'recover' ? 'Neues Passwort' : 'Passwort'}
                <div className="relative">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={mode === 'login' ? 1 : 6}
                    maxLength={128}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="min-h-11 w-full rounded-lg border bg-background pl-3 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    title={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              {mode !== 'login' && <p className="text-xs text-muted-foreground">Mindestens 6 Zeichen.</p>}
              <Button type="submit" disabled={busy} className="w-full"><KeyRound className="h-4 w-4" />{busy ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Konto erstellen' : 'Passwort zurücksetzen'}</Button>
            </form>
          </>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-primary">
          {mode !== 'login' && <Link href="/login">Anmelden</Link>}
          {mode !== 'register' && <Link href="/register">Konto erstellen</Link>}
          {mode === 'login' && <Link href="/recover">Passwort vergessen?</Link>}
          <Link href="/" className="text-muted-foreground">Ohne Konto planen</Link>
        </div>
        {legacyLoginEnabled && <div className="border-t pt-4 text-sm"><p className="mb-2 text-muted-foreground">Schon einen Plan über die bisherige Anmeldung? Melde dich einmal damit an und richte unter Einstellungen dein App-Konto ein.</p><Button variant="outline" className="w-full" onClick={() => signIn('keycloak', { callbackUrl: '/settings' })}>Bestehendes Konto übernehmen</Button></div>}
      </div>
    </main>
  )
}
