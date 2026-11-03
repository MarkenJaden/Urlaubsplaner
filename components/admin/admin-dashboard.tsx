'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Users,
  UserCheck,
  UserPlus,
  Calendar,
  BarChart3,
  Mail,
  Trash2,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  MapPin,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react'

interface SafeOAuthSettings {
  googleEnabled: boolean
  googleClientId: string
  hasGoogleSecret: boolean
  githubEnabled: boolean
  githubClientId: string
  hasGithubSecret: boolean
}

interface AdminStatsResponse {
  overview: {
    totalRegisteredUsers: number
    activeRegisteredUsers: number
    unregisteredGuests: number
    guestsWithPlans: number
    totalUsersCombined: number
    totalVisitors: number
    activeVisitors7d: number
    activeVisitors30d: number
    totalSavedEntries: number
    vacationEntriesCount: number
    gleittagEntriesCount: number
    noteEntriesCount: number
    totalGuestPlannedDays: number
    totalShares: number
  }
  regions: Array<{ subdivision: string; count: number }>
  dailyStats: Array<{
    date: string
    pageViews: number
    uniqueVisitors: number
    registeredUsers: number
    guestUsers: number
  }>
  contactMessages: Array<{
    id: string
    name: string
    email: string
    subject: string
    message: string
    isRead: boolean
    createdAt: string
  }>
  oauthSettings?: SafeOAuthSettings
  umamiUrl: string
}

export function AdminDashboard() {
  const [data, setData] = useState<AdminStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [origin, setOrigin] = useState('https://urlaubsplaner.me')

  // OAuth form states
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [hasGoogleSecret, setHasGoogleSecret] = useState(false)
  const [showGoogleSecret, setShowGoogleSecret] = useState(false)

  const [githubEnabled, setGithubEnabled] = useState(false)
  const [githubClientId, setGithubClientId] = useState('')
  const [githubClientSecret, setGithubClientSecret] = useState('')
  const [hasGithubSecret, setHasGithubSecret] = useState(false)
  const [showGithubSecret, setShowGithubSecret] = useState(false)

  const [savingOAuth, setSavingOAuth] = useState(false)
  const [oauthMessage, setOauthMessage] = useState('')
  const [copiedCallback, setCopiedCallback] = useState<'google' | 'github' | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      setOrigin(window.location.origin)
    }
  }, [])

  const applyOAuthData = useCallback((oauth?: SafeOAuthSettings) => {
    if (!oauth) return
    setGoogleEnabled(oauth.googleEnabled)
    setGoogleClientId(oauth.googleClientId)
    setHasGoogleSecret(oauth.hasGoogleSecret)
    setGoogleClientSecret('')
    setGithubEnabled(oauth.githubEnabled)
    setGithubClientId(oauth.githubClientId)
    setHasGithubSecret(oauth.hasGithubSecret)
    setGithubClientSecret('')
  }, [])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/stats')
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Zugriff verweigert.')
      }
      setData(body)
      applyOAuthData(body.oauthSettings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Statistiken.')
    } finally {
      setLoading(false)
    }
  }, [applyOAuthData])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  const handleSaveOAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingOAuth(true)
    setOauthMessage('')
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_oauth',
          oauth: {
            googleEnabled,
            googleClientId: googleClientId.trim(),
            ...(googleClientSecret.trim() ? { googleClientSecret: googleClientSecret.trim() } : {}),
            githubEnabled,
            githubClientId: githubClientId.trim(),
            ...(githubClientSecret.trim() ? { githubClientSecret: githubClientSecret.trim() } : {}),
          },
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Speichern fehlgeschlagen.')
      applyOAuthData(body.oauthSettings)
      setOauthMessage('Social-Login-Einstellungen erfolgreich gespeichert.')
    } catch (err) {
      setOauthMessage(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setSavingOAuth(false)
    }
  }

  const copyCallbackUrl = async (provider: 'google' | 'github') => {
    const url = `${origin}/api/auth/callback/${provider}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedCallback(provider)
      setTimeout(() => setCopiedCallback(null), 2000)
    } catch {
      // ignore
    }
  }

  const toggleMessageRead = async (id: string, isRead: boolean) => {
    await fetch('/api/admin/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_message_read', id, isRead }),
    })
    void fetchStats()
  }

  const deleteMessage = async (id: string) => {
    if (!confirm('Diese Nachricht wirklich löschen?')) return
    await fetch('/api/admin/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_message', id }),
    })
    void fetchStats()
  }

  if (loading && !data) {
    return (
      <main className="container max-w-6xl space-y-6 py-8">
        <p className="text-sm text-muted-foreground">Admin-Dashboard wird geladen…</p>
      </main>
    )
  }

  if (error && !data) {
    return (
      <main className="container max-w-xl space-y-6 py-12">
        <div className="rounded-2xl border bg-card p-6 space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Admin-Dashboard</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="pt-2">
            <Link href="/" className="text-sm text-primary underline">
              ← Zurück zum Urlaubsplaner
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!data) return null
  const { overview, regions, dailyStats, contactMessages, umamiUrl } = data
  const maxDailyViews = Math.max(1, ...dailyStats.map(d => d.pageViews))
  const unreadMessages = contactMessages.filter(m => !m.isRead).length

  return (
    <main className="container max-w-6xl space-y-6 py-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-primary underline font-medium">
            ← Zurück zum Urlaubsplaner
          </Link>
          <h1 className="mt-1 text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Admin-Dashboard &amp; Einstellungen
          </h1>
          <p className="text-xs text-muted-foreground">
            Exklusiver Zugriff für Administrator <strong>markenjaden</strong> · Nutzungsstatistiken, Social Logins &amp; Kontaktanfragen
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchStats()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Aktualisieren
          </Button>
          <Button variant="default" size="sm" asChild>
            <a href={umamiUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Umami Analytics öffnen
            </a>
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Gesamtnutzer (Konto + Gäste)</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{overview.totalUsersCombined.toLocaleString('de-DE')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {overview.activeVisitors7d} aktiv (7 Tage) · {overview.activeVisitors30d} aktiv (30 Tage)
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Registrierte Nutzerkonten</span>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold">{overview.totalRegisteredUsers.toLocaleString('de-DE')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Davon {overview.activeRegisteredUsers} mit gespeicherten Urlaubstagen
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Nicht-registrierte Gäste</span>
            <UserPlus className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold">{overview.unregisteredGuests.toLocaleString('de-DE')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Davon {overview.guestsWithPlans} mit aktiver lokaler Planung ({overview.totalGuestPlannedDays} Tage)
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Geplante Tage &amp; Teilungen</span>
            <Calendar className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-2 text-2xl font-bold">
            {(overview.totalSavedEntries + overview.totalGuestPlannedDays).toLocaleString('de-DE')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {overview.vacationEntriesCount} Urlaub · {overview.gleittagEntriesCount} Gleittag · {overview.totalShares} Freigabelinks
          </p>
        </div>
      </div>

      {/* Social Logins (Google & GitHub OAuth) Configuration */}
      <form onSubmit={handleSaveOAuth} className="rounded-xl border bg-card p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Social Logins einrichten (Google &amp; GitHub OAuth)
            </h2>
            <p className="text-xs text-muted-foreground">
              Aktiviere die Anmeldung über Google oder GitHub. Sobald aktiviert und hinterlegt, erscheinen die Buttons automatisch auf <code>/login</code> und <code>/register</code>.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Google OAuth Card */}
          <div className="rounded-xl border bg-background/60 p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Google Login</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${googleEnabled && googleClientId && (hasGoogleSecret || googleClientSecret) ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                  {googleEnabled && googleClientId && (hasGoogleSecret || googleClientSecret) ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
              <Switch checked={googleEnabled} onCheckedChange={setGoogleEnabled} aria-label="Google Login aktivieren" />
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-muted-foreground">Autorisierte Weiterleitungs-URI (Google Cloud Console):</span>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 truncate rounded border bg-muted px-2 py-1 font-mono text-[11px]">
                  {origin}/api/auth/callback/google
                </code>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => void copyCallbackUrl('google')}>
                  {copiedCallback === 'google' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <label className="block space-y-1 text-xs font-medium">
              Google Client ID
              <input
                type="text"
                placeholder="1234567890-abc.apps.googleusercontent.com"
                value={googleClientId}
                onChange={e => setGoogleClientId(e.target.value)}
                className="min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal"
              />
            </label>

            <label className="block space-y-1 text-xs font-medium">
              Google Client Secret {hasGoogleSecret && <span className="text-emerald-600 dark:text-emerald-400 font-normal">(bereits hinterlegt – leer lassen zum Behalten)</span>}
              <div className="relative">
                <input
                  type={showGoogleSecret ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={hasGoogleSecret ? '••••••••••••••••••••••••' : 'GOCSPX-...'}
                  value={googleClientSecret}
                  onChange={e => setGoogleClientSecret(e.target.value)}
                  className="min-h-10 w-full rounded-lg border bg-background pl-3 pr-10 text-sm font-normal"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogleSecret(v => !v)}
                  aria-label={showGoogleSecret ? 'Secret verbergen' : 'Secret anzeigen'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {showGoogleSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>

          {/* GitHub OAuth Card */}
          <div className="rounded-xl border bg-background/60 p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold">GitHub Login</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${githubEnabled && githubClientId && (hasGithubSecret || githubClientSecret) ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                  {githubEnabled && githubClientId && (hasGithubSecret || githubClientSecret) ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
              <Switch checked={githubEnabled} onCheckedChange={setGithubEnabled} aria-label="GitHub Login aktivieren" />
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-muted-foreground">Authorization callback URL (GitHub OAuth App):</span>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 truncate rounded border bg-muted px-2 py-1 font-mono text-[11px]">
                  {origin}/api/auth/callback/github
                </code>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => void copyCallbackUrl('github')}>
                  {copiedCallback === 'github' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <label className="block space-y-1 text-xs font-medium">
              GitHub Client ID
              <input
                type="text"
                placeholder="Iv1.1234567890abcdef"
                value={githubClientId}
                onChange={e => setGithubClientId(e.target.value)}
                className="min-h-10 w-full rounded-lg border bg-background px-3 text-sm font-normal"
              />
            </label>

            <label className="block space-y-1 text-xs font-medium">
              GitHub Client Secret {hasGithubSecret && <span className="text-emerald-600 dark:text-emerald-400 font-normal">(bereits hinterlegt – leer lassen zum Behalten)</span>}
              <div className="relative">
                <input
                  type={showGithubSecret ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={hasGithubSecret ? '••••••••••••••••••••••••' : 'Client Secret eingeben'}
                  value={githubClientSecret}
                  onChange={e => setGithubClientSecret(e.target.value)}
                  className="min-h-10 w-full rounded-lg border bg-background pl-3 pr-10 text-sm font-normal"
                />
                <button
                  type="button"
                  onClick={() => setShowGithubSecret(v => !v)}
                  aria-label={showGithubSecret ? 'Secret verbergen' : 'Secret anzeigen'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {showGithubSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {oauthMessage ? (
            <p role="status" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {oauthMessage}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">
              Geheime Schlüssel werden verschlüsselt auf dem Server verwendet und niemals im Browser ausgelesen.
            </span>
          )}
          <Button type="submit" size="sm" disabled={savingOAuth}>
            {savingOAuth ? 'Wird gespeichert…' : 'Social-Login-Einstellungen speichern'}
          </Button>
        </div>
      </form>

      {/* Daily Traffic & Region Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base">Tägliche Nutzung (letzte 30 Tage)</h2>
              <p className="text-xs text-muted-foreground">
                Aufrufe sowie eindeutige registrierte Nutzer und Gäste pro Tag
              </p>
            </div>
          </div>

          {dailyStats.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Noch keine Tagesdaten vorhanden. Sobald Besucher die Seite aufrufen, erscheinen hier die Verlaufsdaten.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-1.5 h-44 pt-4 border-b pb-2 overflow-x-auto">
                {dailyStats.map(day => {
                  const heightPercent = Math.max(8, Math.round((day.pageViews / maxDailyViews) * 100))
                  return (
                    <div
                      key={day.date}
                      className="flex-1 min-w-[20px] flex flex-col items-center gap-1 group"
                      title={`${day.date}: ${day.pageViews} Aufrufe, ${day.uniqueVisitors} Besucher (${day.registeredUsers} Konto / ${day.guestUsers} Gäste)`}
                    >
                      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        {day.uniqueVisitors}
                      </span>
                      <div className="w-full flex items-end justify-center h-32">
                        <div
                          className="w-full max-w-[24px] rounded-t bg-primary/80 group-hover:bg-primary transition-all"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground truncate max-w-full">
                        {day.date.slice(5)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Balkenhöhe = Seitenaufrufe · Zahl beim Überfahren = Eindeutige Besucher</span>
                <span>Gesamt erfasste Besucher-IDs: {overview.totalVisitors}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                Beliebteste Bundesländer
              </h2>
              <p className="text-xs text-muted-foreground">Nach aktiven Besuchern (Konto &amp; Gäste)</p>
            </div>
          </div>

          {regions.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Noch keine Regionsdaten erfasst.</p>
          ) : (
            <div className="space-y-2.5">
              {regions.map(r => {
                const maxRegion = Math.max(1, regions[0]?.count ?? 1)
                const pct = Math.round((r.count / maxRegion) * 100)
                return (
                  <div key={r.subdivision} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{r.subdivision}</span>
                      <span className="text-muted-foreground">{r.count} Nutzer</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Contact Messages Inbox */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Nachrichten über das Kontaktformular
              {unreadMessages > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {unreadMessages} neu
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Direkte Anfragen von Nutzern über <code>/kontakt</code>
            </p>
          </div>
        </div>

        {contactMessages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Bisher sind noch keine Kontaktanfragen eingegangen.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {contactMessages.map(msg => (
              <div
                key={msg.id}
                className={`p-4 space-y-2 ${msg.isRead ? 'bg-background/50 opacity-80' : 'bg-primary/5'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {!msg.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary" title="Ungelesen" />
                      )}
                      <span className="font-semibold">{msg.subject}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Von <strong>{msg.name}</strong> (
                      <a href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject)}`} className="text-primary underline">
                        {msg.email}
                      </a>
                      ) · {new Date(msg.createdAt).toLocaleString('de-DE')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => void toggleMessageRead(msg.id, !msg.isRead)}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      {msg.isRead ? 'Als ungelesen' : 'Erledigt'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => void deleteMessage(msg.id)}
                      aria-label="Nachricht löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-xs leading-relaxed rounded-md bg-muted/40 p-3">
                  {msg.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
