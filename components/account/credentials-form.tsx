'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { KeyRound, UserRound, ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CredentialsForm({ mode, legacyLoginEnabled = false }: { mode: 'login' | 'register' | 'recover'; legacyLoginEnabled?: boolean }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryInput, setRecoveryInput] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedKey, setSavedKey] = useState(false)
  const heading = mode === 'register' ? 'Dein Konto erstellen' : mode === 'recover' ? 'Konto wiederherstellen' : 'Willkommen zurück'

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
        body: JSON.stringify({ username, password, recoveryKey: recoveryInput }),
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
        <Link href="/" className="inline-flex items-center gap-2 font-semibold text-primary"><UserRound className="h-5 w-5" /> Urlaubsplaner</Link>
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
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium">Benutzername<input required autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" value={username} onChange={e => setUsername(e.target.value)} className="min-h-11 w-full rounded-lg border bg-background px-3" /></label>
            {mode !== 'login' && <p className="text-xs text-muted-foreground">3–32 Zeichen: Buchstaben, Zahlen, Punkt, Bindestrich oder Unterstrich.</p>}
            {mode === 'recover' && <label className="block space-y-1.5 text-sm font-medium">Wiederherstellungsschlüssel<input required autoComplete="off" value={recoveryInput} onChange={e => setRecoveryInput(e.target.value.trim())} className="min-h-11 w-full rounded-lg border bg-background px-3" /></label>}
            <label className="block space-y-1.5 text-sm font-medium">{mode === 'recover' ? 'Neues Passwort' : 'Passwort'}<input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="min-h-11 w-full rounded-lg border bg-background px-3" /></label>
            {mode !== 'login' && <p className="text-xs text-muted-foreground">Mindestens 12 Zeichen. Eine lange Passphrase ist gut merkbar.</p>}
            <Button type="submit" disabled={busy} className="w-full"><KeyRound className="h-4 w-4" />{busy ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Konto erstellen' : 'Passwort zurücksetzen'}</Button>
          </form>
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
