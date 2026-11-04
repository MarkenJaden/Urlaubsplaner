'use client'

import { useEffect, useState } from 'react'
import { signIn, signOut } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, LogOut, Trash2, Eye, EyeOff, Link2, Unlink, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AccountPanel({
  username,
  email: initialEmail,
  hasLocalAccount,
  googleLinked = false,
  githubLinked = false,
  googleOAuthEnabled = false,
  githubOAuthEnabled = false,
}: {
  username?: string | null
  email?: string | null
  hasLocalAccount: boolean
  googleLinked?: boolean
  githubLinked?: boolean
  googleOAuthEnabled?: boolean
  githubOAuthEnabled?: boolean
}) {
  const queryClient = useQueryClient()
  const [login, setLogin] = useState(username ?? '')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [message, setMessage] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (username !== undefined) setLogin(username ?? '')
  }, [username])

  useEffect(() => {
    if (initialEmail !== undefined) setEmail(initialEmail ?? '')
  }, [initialEmail])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const linked = params.get('linked')
      if (linked === 'google' || linked === 'github') {
        setSuccessMsg(`Dein Konto wurde erfolgreich mit ${linked === 'google' ? 'Google' : 'GitHub'} verknüpft.`)
        void queryClient.invalidateQueries({ queryKey: ['profile'] })
      }
    }
  }, [queryClient])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setSuccessMsg('')
    try {
      const response = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: login, email, password, currentPassword }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (data.recoveryKey) {
        setRecoveryKey(data.recoveryKey)
      } else {
        setSuccessMsg('Benutzername und E-Mail-Adresse wurden gespeichert.')
        await queryClient.invalidateQueries({ queryKey: ['profile'] })
      }
      setPassword('')
      setCurrentPassword('')
    } catch (error) {
      setMessage(error instanceof Error ? errMsg(error) : 'Verbindung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  function errMsg(err: Error) {
    return err.message || 'Ein Fehler ist aufgetreten.'
  }

  async function linkProvider(provider: 'google' | 'github') {
    setBusy(true)
    setMessage('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/account/oauth', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Verknüpfung konnte nicht gestartet werden.')
      }
      await signIn(provider, { callbackUrl: `/settings?linked=${provider}` })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Verknüpfung fehlgeschlagen.')
      setBusy(false)
    }
  }

  async function unlinkProvider(provider: 'google' | 'github') {
    const label = provider === 'google' ? 'Google' : 'GitHub'
    if (!confirm(`Verknüpfung mit ${label} wirklich aufheben?`)) return
    setBusy(true)
    setMessage('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/account/oauth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Trennen fehlgeschlagen.')
      setSuccessMsg(`Verknüpfung mit ${label} wurde getrennt.`)
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Trennen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function logoutEverywhere() {
    setBusy(true)
    try {
      const response = await fetch('/api/account/sessions', { method: 'DELETE' })
      if (!response.ok) throw new Error('Abmeldung fehlgeschlagen.')
      await signOut({ callbackUrl: '/login' })
    } catch {
      setMessage('Abmeldung fehlgeschlagen. Bitte erneut versuchen.')
      setBusy(false)
    }
  }

  async function deleteAccount() {
    if (!confirm('Konto und alle gespeicherten Planungen dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return
    setBusy(true)
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentPassword, confirmation: 'DELETE' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Löschung fehlgeschlagen.')
      setBusy(false)
    }
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="h-5 w-5" /> Mein Konto &amp; Anmeldearten
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasLocalAccount
            ? `Angemeldet als ${username || initialEmail || 'Nutzer'}. Du kannst dich mit Benutzername, E-Mail-Adresse oder verknüpften Anbietern anmelden.`
            : 'Du bist über einen Social-Login angemeldet. Du kannst hier zusätzlich einen Benutzernamen und ein Passwort einrichten.'}
        </p>
      </div>

      {message && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {message}
        </p>
      )}

      {successMsg && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMsg}
        </p>
      )}

      {/* OAuth Account Linking Section */}
      <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-primary" />
            Verknüpfte Konten (Google &amp; GitHub)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verknüpfe dein Konto mit Google oder GitHub für den 1-Klick-Login. Wenn deine hinterlegte E-Mail-Adresse mit deiner Google-E-Mail übereinstimmt, werden beide auch automatisch beim Login verknüpft.
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {/* Google Connection Card */}
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-background p-3">
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z" />
                <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z" />
              </svg>
              <div>
                <div className="text-xs font-semibold">Google</div>
                <div className={`text-[11px] ${googleLinked ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
                  {googleLinked ? 'Verknüpft' : googleOAuthEnabled ? 'Nicht verknüpft' : 'Vom Admin nicht aktiviert'}
                </div>
              </div>
            </div>
            {googleLinked ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy || (!hasLocalAccount && !githubLinked)}
                onClick={() => void unlinkProvider('google')}
                className="h-8 text-xs text-destructive hover:text-destructive"
                title={!hasLocalAccount && !githubLinked ? 'Richte erst ein Passwort ein, bevor du Google trennst' : 'Google-Verknüpfung trennen'}
              >
                <Unlink className="h-3.5 w-3.5 mr-1" /> Trennen
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || !googleOAuthEnabled}
                onClick={() => void linkProvider('google')}
                className="h-8 text-xs"
              >
                <Link2 className="h-3.5 w-3.5 mr-1" /> Verknüpfen
              </Button>
            )}
          </div>

          {/* GitHub Connection Card */}
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-background p-3">
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
              <div>
                <div className="text-xs font-semibold">GitHub</div>
                <div className={`text-[11px] ${githubLinked ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
                  {githubLinked ? 'Verknüpft' : githubOAuthEnabled ? 'Nicht verknüpft' : 'Vom Admin nicht aktiviert'}
                </div>
              </div>
            </div>
            {githubLinked ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy || (!hasLocalAccount && !googleLinked)}
                onClick={() => void unlinkProvider('github')}
                className="h-8 text-xs text-destructive hover:text-destructive"
                title={!hasLocalAccount && !googleLinked ? 'Richte erst ein Passwort ein, bevor du GitHub trennst' : 'GitHub-Verknüpfung trennen'}
              >
                <Unlink className="h-3.5 w-3.5 mr-1" /> Trennen
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || !githubOAuthEnabled}
                onClick={() => void linkProvider('github')}
                className="h-8 text-xs"
              >
                <Link2 className="h-3.5 w-3.5 mr-1" /> Verknüpfen
              </Button>
            )}
          </div>
        </div>
      </div>

      {recoveryKey ? (
        <div className="space-y-3">
          <p className="text-sm">
            Speichere deinen neuen Wiederherstellungsschlüssel im Passwortmanager. Der bisherige Schlüssel und alle bisherigen Sitzungen sind jetzt ungültig.
          </p>
          <textarea
            aria-label="Neuer Wiederherstellungsschlüssel"
            readOnly
            value={recoveryKey}
            className="w-full rounded-lg border bg-muted p-3 font-mono text-sm"
          />
          <Button onClick={() => signOut({ callbackUrl: '/login' })}>Schlüssel gespeichert · neu anmelden</Button>
        </div>
      ) : (
        <>
          <form onSubmit={save} className="space-y-3">
            <label className="block text-sm">
              Benutzername
              <input
                required
                minLength={3}
                maxLength={32}
                autoComplete="username"
                value={login}
                onChange={e => setLogin(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <label className="block text-sm">
              E-Mail-Adresse <span className="text-muted-foreground">(empfohlen für Login, Passwort-Reset &amp; Google-Verknüpfung)</span>
              <input
                type="email"
                maxLength={254}
                autoComplete="email"
                placeholder="name@beispiel.de"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3"
              />
            </label>
            {hasLocalAccount && (
              <label className="block text-sm">
                Aktuelles Passwort (zur Bestätigung von Änderungen)
                <div className="relative mt-1">
                  <input
                    required
                    type={showCurrentPassword ? 'text' : 'password'}
                    maxLength={128}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="min-h-11 w-full rounded-lg border bg-background pl-3 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(v => !v)}
                    aria-label={showCurrentPassword ? 'Aktuelles Passwort verbergen' : 'Aktuelles Passwort anzeigen'}
                    title={showCurrentPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            )}
            <label className="block text-sm">
              {hasLocalAccount ? 'Neues Passwort (optional – leer lassen zum Behalten)' : 'Passwort festlegen (mindestens 6 Zeichen)'}
              <div className="relative mt-1">
                <input
                  required={!hasLocalAccount}
                  type={showNewPassword ? 'text' : 'password'}
                  minLength={6}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="min-h-11 w-full rounded-lg border bg-background pl-3 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(v => !v)}
                  aria-label={showNewPassword ? 'Neues Passwort verbergen' : 'Neues Passwort anzeigen'}
                  title={showNewPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <Button disabled={busy} type="submit">
              {hasLocalAccount ? 'Zugangsdaten speichern' : 'Lokales Passwort & Benutzername einrichten'}
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
            <Button disabled={busy} variant="outline" onClick={logoutEverywhere}>
              <LogOut className="h-4 w-4" /> Alle Geräte abmelden
            </Button>
            <Button
              disabled={busy || (hasLocalAccount && !currentPassword)}
              variant="ghost"
              className="text-destructive"
              onClick={deleteAccount}
            >
              <Trash2 className="h-4 w-4" /> Konto löschen
            </Button>
          </div>
          {hasLocalAccount && (
            <p className="mt-2 text-xs text-muted-foreground">
              Zum Löschen oben das aktuelle Passwort eingeben. Gespeicherte Planungen und alle Kalender-Abos werden ebenfalls gelöscht.
            </p>
          )}
        </>
      )}
    </section>
  )
}
