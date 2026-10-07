'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { AccountPanel } from '@/components/account/account-panel'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { useSubdivisions } from '@/hooks/use-holidays'
import { useProfile, useUpdatePreferences } from '@/hooks/use-profile'
import { CalendarDays, Copy, Check, RefreshCw, MapPin, ExternalLink, ShieldCheck } from 'lucide-react'
import type { Subdivision, UserPreferences, UserProfile } from '@/types'

interface SettingsClientProps {
  calendarToken: string
  preferences: Record<string, unknown>
  username?: string | null
  hasLocalAccount: boolean
}

export function SettingsClient({ calendarToken, preferences, username, hasLocalAccount }: SettingsClientProps) {
  const profile = useProfile()
  const prefs = (profile.data?.preferences ?? preferences) as UserPreferences
  const updatePrefs = useUpdatePreferences()
  const queryClient = useQueryClient()
  const [origin, setOrigin] = useState('')
  const [token, setToken] = useState(calendarToken)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const { data: subdivisions = [], isError: subdivisionsError, refetch } = useSubdivisions('DE')
  const calendarUrl = `${origin}/api/calendar/${profile.data?.calendarToken ?? token}/feed.ics`
  const subscriptionUrl = calendarUrl.replace(/^https?:/, 'webcal:')

  async function copyUrl() {
    try { await navigator.clipboard.writeText(calendarUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { setError('Kopieren nicht möglich. Markiere den Link und kopiere ihn manuell.') }
  }
  async function rotateToken() {
    if (!confirm('Der bisherige Kalender-Link wird ungültig. Du musst das Abo auf deinen Geräten anschließend mit dem neuen Link einrichten. Fortfahren?')) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/calendar/token', { method: 'POST' })
      if (!response.ok) throw new Error('Kalender-Link konnte nicht erneuert werden.')
      const data = await response.json()
      setToken(data.calendarToken)
      queryClient.setQueryData<UserProfile>(['profile'], previous => previous ? { ...previous, calendarToken: data.calendarToken } : previous)
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
    } catch (error) { setError(error instanceof Error ? error.message : 'Verbindung fehlgeschlagen.') }
    finally { setBusy(false) }
  }

  return <div className="min-h-screen bg-background">
    <Header isLoggedIn />
    <main className="container mx-auto max-w-2xl space-y-6 px-4 py-6 sm:py-8">
      <div><Link href="/" className="text-sm text-primary">Zurück zum Kalender</Link><h1 className="mt-2 text-2xl font-semibold tracking-tight">Dein Urlaubsplaner</h1><p className="mt-1 text-sm text-muted-foreground">Konto, Region und Kalender-Verbindung.</p></div>
      {(error || profile.isError || updatePrefs.isError) && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error || 'Einstellungen konnten nicht geladen oder gespeichert werden. Prüfe deine Verbindung und Anmeldung.'} <Link className="underline" href="/login">Anmelden</Link></p>}
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5" /> Mein Bundesland</h2>
        <Combobox options={subdivisions.map((sub: Subdivision) => ({ value: sub.code, label: sub.name.find(n => n.language === 'DE')?.text ?? sub.code }))} value={prefs.subdivision} onChange={subdivision => updatePrefs.mutate({ subdivision })} placeholder="Bundesland wählen" />
        {subdivisionsError && <Button variant="outline" onClick={() => refetch()}>Bundesländer erneut laden</Button>}
        <p className="mt-2 text-xs text-muted-foreground">Wird mit deinen Geräten synchronisiert und für Ferien und Feiertage im Abo verwendet.</p>
      </section>
      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5" /> Kalender automatisch aktualisieren</h2>
        <p className="text-sm text-muted-foreground">Abonniere deinen Plan einmal. Neue oder gelöschte Urlaubstage erscheinen beim nächsten Abruf in deiner Kalender-App.</p>
        <div className="space-y-2">
          {([
            ['feedIncludePublicHolidays', 'Feiertage meines Bundeslands'],
            ['feedIncludeSchoolHolidays', 'Schulferien meines Bundeslands'],
            ['feedIncludeNotes', 'Meine Notizen (können persönliche Angaben enthalten)'],
          ] as const).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4" checked={Boolean(prefs[key])} disabled={key !== 'feedIncludeNotes' && !prefs.subdivision} onChange={event => updatePrefs.mutate({ [key]: event.target.checked })} />{label}</label>)}
        </div>
        {!prefs.subdivision && <p className="text-xs text-muted-foreground">Wähle zuerst dein Bundesland, um Ferien und Feiertage einzuschließen.</p>}
        <p className="text-xs text-muted-foreground">Ferien und Feiertage umfassen das vorherige, aktuelle und nächste Jahr.</p>
        <label className="block text-sm font-medium">Dein privater Abo-Link<input aria-label="Privater Kalender-Abo-Link" readOnly value={calendarUrl} className="mt-1 min-h-11 w-full rounded-lg border bg-muted px-3 font-mono text-xs" /></label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyUrl}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Kopiert' : 'Link kopieren'}</Button>
          {origin && <Button asChild><a href={subscriptionUrl}><ExternalLink className="h-4 w-4" /> In Apple Kalender öffnen</a></Button>}
        </div>
        <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
          <p><strong>iPhone:</strong> Kalender → Kalender → Hinzufügen → Kalenderabo hinzufügen. Den Abo-Link einfügen.</p>
          <p><strong>Outlook im Web:</strong> Kalender → Kalender hinzufügen → Aus dem Internet abonnieren. Den Abo-Link einfügen.</p>
          <p className="text-muted-foreground">Änderungen machst du hier im Urlaubsplaner. Das Abo ist schreibgeschützt. Outlook kann für Aktualisierungen mehr als 24 Stunden benötigen.</p>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" /> Wer diesen Link kennt, kann die freigegebenen Kalenderdaten lesen. Gib ihn nur in deinen Kalender-Apps ein.</p>
        <Button variant="ghost" disabled={busy} onClick={rotateToken}><RefreshCw className="h-4 w-4" /> Kalender-Link erneuern</Button>
      </section>
      <AccountPanel username={profile.data?.username ?? username} hasLocalAccount={profile.data?.hasLocalAccount ?? hasLocalAccount} />
      <p role="status" className="text-xs text-muted-foreground">{updatePrefs.isPending ? 'Einstellungen werden gespeichert…' : 'Änderungen werden automatisch gespeichert.'}</p>
    </main>
  </div>
}
