'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { AccountPanel } from '@/components/account/account-panel'
import { CalendarFeedsList } from '@/components/calendar/calendar-feeds-list'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { LocationFields } from '@/components/calendar/location-fields'
import { useCountries } from '@/hooks/use-holidays'
import { useHomeRegion } from '@/hooks/use-home-region'
import { useProfile, useUpdatePreferences } from '@/hooks/use-profile'
import { countryChangePatch } from '@/lib/preferences'
import { DEFAULT_WORK_DAYS } from '@/lib/vacation-accounting'
import { CalendarDays, Copy, Check, RefreshCw, MapPin, ExternalLink, ShieldCheck, Briefcase } from 'lucide-react'
import type { CalendarFeedSubscription, PasskeyInfo, UserPreferences, UserProfile } from '@/types'

const WEEKDAYS_CONFIG = [
  { day: 1, short: 'Mo', full: 'Montag' },
  { day: 2, short: 'Di', full: 'Dienstag' },
  { day: 3, short: 'Mi', full: 'Mittwoch' },
  { day: 4, short: 'Do', full: 'Donnerstag' },
  { day: 5, short: 'Fr', full: 'Freitag' },
  { day: 6, short: 'Sa', full: 'Samstag' },
  { day: 0, short: 'So', full: 'Sonntag' },
] as const

function sameDays(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort((x, y) => x - y)
  const sortedB = [...b].sort((x, y) => x - y)
  return sortedA.every((v, i) => v === sortedB[i])
}

interface SettingsClientProps {
  calendarToken: string
  initialFeeds?: CalendarFeedSubscription[]
  preferences: Record<string, unknown>
  username?: string | null
  email?: string | null
  hasLocalAccount: boolean
  totpEnabled?: boolean
  initialPasskeys?: PasskeyInfo[]
  googleLinked?: boolean
  githubLinked?: boolean
  googleOAuthEnabled?: boolean
  githubOAuthEnabled?: boolean
}

export function SettingsClient({
  calendarToken,
  initialFeeds = [],
  preferences,
  username,
  email,
  hasLocalAccount,
  totpEnabled = false,
  initialPasskeys = [],
  googleLinked = false,
  githubLinked = false,
  googleOAuthEnabled = false,
  githubOAuthEnabled = false,
}: SettingsClientProps) {
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
  const home = useHomeRegion(prefs)
  const { data: countries = [] } = useCountries()
  const workDays = prefs.workDays ?? DEFAULT_WORK_DAYS
  const regionLabel = home.country === 'DE' ? 'meines Bundeslands' : 'meiner Region'
  const calendarUrl = `${origin}/api/calendar/${profile.data?.calendarToken ?? token}/feed.ics`
  const subscriptionUrl = calendarUrl.replace(/^https?:/, 'webcal:')
  const googleCalendarUrl = origin ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(subscriptionUrl)}` : ''
  const outlookWebUrl = origin ? `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(calendarUrl)}&name=${encodeURIComponent('Urlaubsplaner')}` : ''
  const feeds = profile.data?.calendarFeeds ?? initialFeeds

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

  function toggleWorkDay(day: number) {
    const exists = workDays.includes(day)
    if (exists && workDays.length <= 1) return
    const next = exists
      ? workDays.filter(d => d !== day)
      : [...workDays, day].sort((a, b) => a - b)
    updatePrefs.mutate({ workDays: next })
  }

  return <div className="min-h-screen bg-background">
    <Header isLoggedIn />
    <main className="container mx-auto max-w-2xl space-y-6 px-4 py-6 sm:py-8">
      <div><Link href="/" className="text-sm text-primary hover:underline">← Zurück zum Kalender</Link><h1 className="mt-2 text-2xl font-semibold tracking-tight">Dein Urlaubsplaner</h1><p className="mt-1 text-sm text-muted-foreground">Konto, Arbeitszeit, Region und Kalender-Verbindung.</p></div>
      {(error || profile.isError || updatePrefs.isError) && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error || 'Einstellungen konnten nicht geladen oder gespeichert werden. Prüfe deine Verbindung und Anmeldung.'} <Link className="underline" href="/login">Anmelden</Link></p>}
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5" /> Meine Region</h2>
        <div className="space-y-3">
          <LocationFields
            countries={countries} country={home.country} onCountryChange={country => { if (country !== home.country) updatePrefs.mutate(countryChangePatch(country)) }}
            subdivisions={home.subdivisions} subdivision={home.subdivision} onSubdivisionChange={subdivision => updatePrefs.mutate({ subdivision, holidayGroup: null })}
            groups={home.region.candidates} holidayGroup={home.region.group} onHolidayGroupChange={holidayGroup => updatePrefs.mutate({ holidayGroup })}
          />
        </div>
        {home.isError && <Button variant="outline" onClick={() => home.retry()}>Regionen erneut laden</Button>}
        <p className="mt-2 text-xs text-muted-foreground">Wird mit deinen Geräten synchronisiert und für Ferien und Feiertage im Abo verwendet.</p>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Briefcase className="h-5 w-5" /> Meine Arbeitswoche ({workDays.length}-Tage-Woche)</h2>
          <div className="flex flex-wrap gap-1.5">
            {([
              { label: '5-Tage (Mo–Fr)', days: [1, 2, 3, 4, 5] },
              { label: '4-Tage (Mo–Do)', days: [1, 2, 3, 4] },
              { label: '4-Tage (Di–Fr)', days: [2, 3, 4, 5] },
              { label: '6-Tage (Mo–Sa)', days: [1, 2, 3, 4, 5, 6] },
            ] as const).map(preset => {
              const active = sameDays(workDays, [...preset.days])
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => updatePrefs.mutate({ workDays: [...preset.days] })}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    active ? 'bg-primary text-primary-foreground' : 'border bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Wähle deine regulären Arbeitstage aus. Nicht ausgewählte Wochentage (z.B. Freitag bis Sonntag bei einer 4-Tage-Woche) werden im Kalender als Wochenende dargestellt, kosten keinen Urlaubstag und werden bei der Brückentage- &amp; Smart-Planung automatisch als freie Tage berücksichtigt.
        </p>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS_CONFIG.map(({ day, short, full }) => {
            const active = workDays.includes(day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleWorkDay(day)}
                aria-pressed={active}
                title={`${full}: ${active ? 'Arbeitstag' : 'Frei (Wochenende)'}`}
                className={`min-h-11 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-dashed bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                {short}
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5" /> Kalender automatisch aktualisieren</h2>
        <p className="text-sm text-muted-foreground">Abonniere deinen Plan einmal als Haupt-Feed oder lege darunter beliebig viele getrennte Kalender-Abos mit unterschiedlichen Einstellungen an.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>🌴 Urlaubstage</span>
            <Switch checked={prefs.feedIncludeVacations ?? true} onCheckedChange={checked => updatePrefs.mutate({ feedIncludeVacations: checked })} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>⏰ Gleittage</span>
            <Switch checked={prefs.feedIncludeGleittage ?? true} onCheckedChange={checked => updatePrefs.mutate({ feedIncludeGleittage: checked })} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>📝 Meine Notizen</span>
            <Switch checked={Boolean(prefs.feedIncludeNotes)} onCheckedChange={checked => updatePrefs.mutate({ feedIncludeNotes: checked })} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>🔒 Notiz-Texte zeigen</span>
            <Switch checked={prefs.feedIncludeNoteTitles ?? true} disabled={!prefs.feedIncludeNotes} onCheckedChange={checked => updatePrefs.mutate({ feedIncludeNoteTitles: checked })} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>🎉 Feiertage {regionLabel}</span>
            <Switch checked={Boolean(prefs.feedIncludePublicHolidays)} disabled={!home.locationReady} onCheckedChange={checked => updatePrefs.mutate({ feedIncludePublicHolidays: checked })} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>🏫 Schulferien {regionLabel}</span>
            <Switch checked={Boolean(prefs.feedIncludeSchoolHolidays)} disabled={!home.locationReady} onCheckedChange={checked => updatePrefs.mutate({ feedIncludeSchoolHolidays: checked })} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm sm:col-span-2">
            <span>🌉 Brückentag-Empfehlungen {regionLabel}</span>
            <Switch checked={Boolean(prefs.feedIncludeBridgeDays)} disabled={!home.locationReady} onCheckedChange={checked => updatePrefs.mutate({ feedIncludeBridgeDays: checked })} />
          </label>
        </div>
        {!home.locationReady && <p className="text-xs text-muted-foreground">Wähle zuerst deine Region, um Ferien, Feiertage und Brückentage einzuschließen.</p>}
        {home.region.ambiguous && prefs.feedIncludeSchoolHolidays && <p className="text-xs text-muted-foreground">Wähle deine Ferienregion, damit das Abo nur deine Schulferien enthält.</p>}
        <p className="text-xs text-muted-foreground">Ferien und Feiertage umfassen das vorherige, aktuelle und nächste Jahr.</p>
        <label className="block text-sm font-medium">Dein privater Haupt-Abo-Link<input aria-label="Privater Kalender-Abo-Link" readOnly value={calendarUrl} className="mt-1 min-h-11 w-full rounded-lg border bg-muted px-3 font-mono text-xs" /></label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyUrl}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Kopiert' : 'Link kopieren'}</Button>
          {origin && <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white"><a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> In Google Kalender abonnieren</a></Button>}
          {origin && <Button asChild variant="secondary"><a href={subscriptionUrl}><ExternalLink className="h-4 w-4" /> In Apple Kalender öffnen</a></Button>}
          {origin && <Button asChild variant="outline"><a href={outlookWebUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> In Outlook.com abonnieren</a></Button>}
        </div>
        <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
          <p><strong>Google Kalender:</strong> Klicke auf „In Google Kalender abonnieren“ und bestätige im neuen Tab „Hinzufügen“.</p>
          <p><strong>iPhone / Mac:</strong> Klicke auf „In Apple Kalender öffnen“ oder füge den Link unter Kalender → Kalenderabo hinzufügen ein.</p>
          <p><strong>Outlook im Web:</strong> Klicke auf „In Outlook.com abonnieren“ oder füge den Link unter „Aus dem Internet abonnieren“ ein.</p>
          <p className="text-muted-foreground">Änderungen machst du hier im Urlaubsplaner. Das Abo ist schreibgeschützt.</p>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" /> Wer diesen Link kennt, kann die freigegebenen Kalenderdaten lesen. Gib ihn nur in deinen Kalender-Apps ein.</p>
        <Button variant="ghost" disabled={busy} onClick={rotateToken}><RefreshCw className="h-4 w-4" /> Kalender-Link erneuern</Button>

        <CalendarFeedsList
          feeds={feeds}
          origin={origin}
          locationReady={home.locationReady}
          regionLabel={regionLabel}
        />
      </section>
      <AccountPanel
        username={profile.data?.username ?? username}
        email={profile.data?.email ?? email}
        hasLocalAccount={profile.data?.hasLocalAccount ?? hasLocalAccount}
        totpEnabled={profile.data?.totpEnabled ?? totpEnabled}
        passkeys={profile.data?.passkeys ?? initialPasskeys}
        googleLinked={profile.data?.googleLinked ?? googleLinked}
        githubLinked={profile.data?.githubLinked ?? githubLinked}
        googleOAuthEnabled={profile.data?.googleOAuthEnabled ?? googleOAuthEnabled}
        githubOAuthEnabled={profile.data?.githubOAuthEnabled ?? githubOAuthEnabled}
      />
      <p role="status" className="text-xs text-muted-foreground">{updatePrefs.isPending ? 'Einstellungen werden gespeichert…' : 'Änderungen werden automatisch gespeichert.'}</p>
    </main>
  </div>
}
