'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { KeyRound, LogOut, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AccountPanel({ username, hasLocalAccount }: { username?: string | null; hasLocalAccount: boolean }) {
  const [login, setLogin] = useState(username ?? '')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: login, password, currentPassword }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setRecoveryKey(data.recoveryKey); setPassword(''); setCurrentPassword('')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Verbindung fehlgeschlagen.') }
    finally { setBusy(false) }
  }

  async function logoutEverywhere() {
    setBusy(true)
    try {
      const response = await fetch('/api/account/sessions', { method: 'DELETE' })
      if (!response.ok) throw new Error('Abmeldung fehlgeschlagen.')
      await signOut({ callbackUrl: '/login' })
    } catch { setMessage('Abmeldung fehlgeschlagen. Bitte erneut versuchen.'); setBusy(false) }
  }

  async function deleteAccount() {
    if (!confirm('Konto und alle gespeicherten Planungen dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return
    setBusy(true)
    try {
      const response = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: currentPassword, confirmation: 'DELETE' }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await signOut({ callbackUrl: '/' })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Löschung fehlgeschlagen.'); setBusy(false) }
  }

  return <section className="rounded-xl border bg-card p-4 sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5" /> Mein Konto</h2>
    <p className="my-3 text-sm text-muted-foreground">{hasLocalAccount ? `Angemeldet als ${username}. Passwortänderungen melden alle Geräte ab.` : 'Richte die Anmeldung direkt im Urlaubsplaner ein. Dein vorhandener Plan bleibt erhalten.'}</p>
    {message && <p role="alert" className="mb-3 text-sm text-destructive">{message}</p>}
    {recoveryKey ? <div className="space-y-3"><p className="text-sm">Speichere deinen neuen Wiederherstellungsschlüssel im Passwortmanager. Der bisherige Schlüssel und alle bisherigen Sitzungen sind jetzt ungültig.</p><textarea aria-label="Neuer Wiederherstellungsschlüssel" readOnly value={recoveryKey} className="w-full rounded-lg border bg-muted p-3 font-mono text-sm" /><Button onClick={() => signOut({ callbackUrl: '/login' })}>Schlüssel gespeichert · neu anmelden</Button></div> : <>
      <form onSubmit={save} className="space-y-3">
        <label className="block text-sm">Benutzername<input required minLength={3} maxLength={32} autoComplete="username" value={login} onChange={e => setLogin(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" /></label>
        {hasLocalAccount && <label className="block text-sm">Aktuelles Passwort<input required type="password" maxLength={128} autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" /></label>}
        <label className="block text-sm">Neues Passwort (mindestens 12 Zeichen)<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" /></label>
        <Button disabled={busy} type="submit">{hasLocalAccount ? 'Zugangsdaten ändern' : 'App-Konto einrichten'}</Button>
      </form>
      <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
        <Button disabled={busy} variant="outline" onClick={logoutEverywhere}><LogOut className="h-4 w-4" /> Alle Geräte abmelden</Button>
        {hasLocalAccount && <Button disabled={busy || !currentPassword} variant="ghost" className="text-destructive" onClick={deleteAccount}><Trash2 className="h-4 w-4" /> Konto löschen</Button>}
      </div>
      {hasLocalAccount && <p className="mt-2 text-xs text-muted-foreground">Zum Löschen oben das aktuelle Passwort eingeben. Gespeicherte Planungen und das Kalender-Abo werden ebenfalls gelöscht.</p>}
    </>}
  </section>
}
