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
  Shield,
  MapPin,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Send,
  Server,
  Search,
  LogOut,
  Edit3,
  X,
  Activity,
  Monitor,
  Smartphone,
  Tablet,
  Clock,
} from 'lucide-react'

interface SafeOAuthSettings {
  googleEnabled: boolean
  googleClientId: string
  hasGoogleSecret: boolean
  githubEnabled: boolean
  githubClientId: string
  hasGithubSecret: boolean
}

interface SafeSmtpSettings {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  user: string
  hasPass: boolean
  fromEmail: string
  fromName: string
}

interface AdminUserRow {
  id: string
  username: string | null
  name: string | null
  email: string | null
  isAdmin: boolean
  hasPassword: boolean
  googleLinked: boolean
  githubLinked: boolean
  vacationsCount: number
  sharesCount: number
  feedsCount: number
  lastActiveAt: string | null
  isOnlineNow: boolean
  createdAt: string
  updatedAt: string
}

interface AdminStatsResponse {
  currentAdminId: string
  serverTimestamp?: string
  live?: {
    activeNow: number
    activeAuthedNow: number
    activeGuestsNow: number
    active30m: number
    active24h: number
    activePaths: Array<{ path: string; count: number }>
    liveDevices: { desktop: number; mobile: number; tablet: number }
    devices7d: { desktop: number; mobile: number; tablet: number }
  }
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
  users: AdminUserRow[]
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
  smtpSettings?: SafeSmtpSettings
  umamiUrl: string
}

const relativeFormatter = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' })

function formatLastActive(iso: string | null | undefined): { relative: string; exact: string } {
  if (!iso) return { relative: 'Noch nie', exact: 'Keine Aktivität erfasst' }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return { relative: 'Unbekannt', exact: '' }

  const exact = date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)

  if (absSeconds < 60) {
    return { relative: 'Gerade eben', exact }
  }
  if (absSeconds < 3600) {
    return { relative: relativeFormatter.format(Math.round(diffSeconds / 60), 'minute'), exact }
  }
  if (absSeconds < 86400) {
    return { relative: relativeFormatter.format(Math.round(diffSeconds / 3600), 'hour'), exact }
  }
  if (absSeconds < 86400 * 30) {
    return { relative: relativeFormatter.format(Math.round(diffSeconds / 86400), 'day'), exact }
  }
  return { relative: date.toLocaleDateString('de-DE'), exact }
}

type UserSortKey = 'lastActive' | 'onlineFirst' | 'createdAt' | 'entries' | 'name'

export function AdminDashboard() {
  const [data, setData] = useState<AdminStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [liveRefresh, setLiveRefresh] = useState(true)
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

  // SMTP form states
  const [smtpEnabled, setSmtpEnabled] = useState(false)
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [hasSmtpPass, setHasSmtpPass] = useState(false)
  const [showSmtpPass, setShowSmtpPass] = useState(false)
  const [smtpFromEmail, setSmtpFromEmail] = useState('')
  const [smtpFromName, setSmtpFromName] = useState('Urlaubsplaner')
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [smtpMessage, setSmtpMessage] = useState('')
  const [testSmtpTo, setTestSmtpTo] = useState('')
  const [testingSmtp, setTestingSmtp] = useState(false)

  // User Management states
  const [userSearch, setUserSearch] = useState('')
  const [userSort, setUserSort] = useState<UserSortKey>('lastActive')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userActionStatus, setUserActionStatus] = useState('')
  const [userActionBusy, setUserActionBusy] = useState<string | null>(null)
  const [passwordModalUser, setPasswordModalUser] = useState<AdminUserRow | null>(null)
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [editModalUser, setEditModalUser] = useState<AdminUserRow | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editName, setEditName] = useState('')

  // Broadcast Mail (Rundmail) states
  const [broadcastMode, setBroadcastMode] = useState<'all' | 'admins' | 'selected'>('all')
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState('')

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

  const applySmtpData = useCallback((smtp?: SafeSmtpSettings) => {
    if (!smtp) return
    setSmtpEnabled(smtp.enabled)
    setSmtpHost(smtp.host)
    setSmtpPort(smtp.port || 587)
    setSmtpSecure(smtp.secure)
    setSmtpUser(smtp.user)
    setHasSmtpPass(smtp.hasPass)
    setSmtpPass('')
    setSmtpFromEmail(smtp.fromEmail)
    setSmtpFromName(smtp.fromName || 'Urlaubsplaner')
  }, [])

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Zugriff verweigert.')
      }
      setData(body)
      if (!silent) {
        applyOAuthData(body.oauthSettings)
        applySmtpData(body.smtpSettings)
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Statistiken.')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [applyOAuthData, applySmtpData])

  useEffect(() => {
    void fetchStats(false)
  }, [fetchStats])

  // Live auto-refresh every 15s while tab is visible and liveRefresh is enabled
  useEffect(() => {
    if (!liveRefresh) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchStats(true)
      }
    }, 15_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchStats(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [liveRefresh, fetchStats])

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

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSmtp(true)
    setSmtpMessage('')
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_smtp',
          smtp: {
            enabled: smtpEnabled,
            host: smtpHost.trim(),
            port: Number(smtpPort) || 587,
            secure: smtpSecure,
            user: smtpUser.trim(),
            ...(smtpPass.trim() ? { pass: smtpPass.trim() } : {}),
            fromEmail: smtpFromEmail.trim(),
            fromName: smtpFromName.trim() || 'Urlaubsplaner',
          },
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Speichern fehlgeschlagen.')
      applySmtpData(body.smtpSettings)
      setSmtpMessage('SMTP-Einstellungen erfolgreich gespeichert.')
    } catch (err) {
      setSmtpMessage(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setSavingSmtp(false)
    }
  }

  const handleTestSmtp = async () => {
    setTestingSmtp(true)
    setSmtpMessage('')
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_smtp',
          to: testSmtpTo.trim() || smtpFromEmail.trim(),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Test-Mail fehlgeschlagen.')
      setSmtpMessage(body.message || 'Test-E-Mail erfolgreich gesendet.')
    } catch (err) {
      setSmtpMessage(err instanceof Error ? err.message : 'Fehler beim Testversand.')
    } finally {
      setTestingSmtp(false)
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

  const handleToggleAdmin = async (u: AdminUserRow) => {
    const nextAdmin = !u.isAdmin
    if (!confirm(`Möchtest du ${u.username || u.email || u.name} wirklich ${nextAdmin ? 'zum Administrator ernennen' : 'die Admin-Rechte entziehen'}?`)) return
    setUserActionBusy(u.id)
    setUserActionStatus('')
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_user_admin', userId: u.id, isAdmin: nextAdmin }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Aktion fehlgeschlagen.')
      setUserActionStatus(`Rolle für ${u.username || u.email || 'Nutzer'} aktualisiert.`)
      await fetchStats()
    } catch (err) {
      setUserActionStatus(err instanceof Error ? err.message : 'Fehler.')
    } finally {
      setUserActionBusy(null)
    }
  }

  const handleDeleteUser = async (u: AdminUserRow) => {
    if (!confirm(`Konto „${u.username || u.email || u.name}“ samt allen Urlaubseinträgen und Freigaben wirklich unwiderruflich löschen?`)) return
    setUserActionBusy(u.id)
    setUserActionStatus('')
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_user', userId: u.id }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Löschen fehlgeschlagen.')
      setUserActionStatus(`Konto „${u.username || u.email || u.id}“ wurde gelöscht.`)
      await fetchStats()
    } catch (err) {
      setUserActionStatus(err instanceof Error ? err.message : 'Fehler beim Löschen.')
    } finally {
      setUserActionBusy(null)
    }
  }

  const handleLogoutUser = async (u: AdminUserRow) => {
    setUserActionBusy(u.id)
    setUserActionStatus('')
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_logout_user', userId: u.id }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Abmelden fehlgeschlagen.')
      setUserActionStatus(`Alle aktiven Sitzungen von ${u.username || u.email || 'Nutzer'} wurden abgemeldet.`)
    } catch (err) {
      setUserActionStatus(err instanceof Error ? err.message : 'Fehler.')
    } finally {
      setUserActionBusy(null)
    }
  }

  const handleAdminResetPassword = async (mode: 'set_password' | 'send_reset_link') => {
    if (!passwordModalUser) return
    setUserActionBusy(passwordModalUser.id)
    setUserActionStatus('')
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_reset_user_password',
          userId: passwordModalUser.id,
          mode,
          newPassword: newAdminPassword,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Passwort-Aktion fehlgeschlagen.')
      setUserActionStatus(body.message || 'Passwort-Aktion erfolgreich ausgeführt.')
      setPasswordModalUser(null)
      setNewAdminPassword('')
      await fetchStats()
    } catch (err) {
      setUserActionStatus(err instanceof Error ? err.message : 'Fehler.')
    } finally {
      setUserActionBusy(null)
    }
  }

  const handleAdminUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editModalUser) return
    setUserActionBusy(editModalUser.id)
    setUserActionStatus('')
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_update_user',
          userId: editModalUser.id,
          username: editUsername.trim(),
          email: editEmail.trim(),
          name: editName.trim(),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Speichern fehlgeschlagen.')
      setUserActionStatus(`Kontodaten für ${editUsername || editEmail || editModalUser.id} wurden aktualisiert.`)
      setEditModalUser(null)
      await fetchStats()
    } catch (err) {
      setUserActionStatus(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setUserActionBusy(null)
    }
  }

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirm('Rundmail jetzt an die ausgewählten Empfänger versenden?')) return
    setSendingBroadcast(true)
    setBroadcastResult('')
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_broadcast_email',
          recipientMode: broadcastMode,
          userIds: selectedUserIds,
          subject: broadcastSubject,
          message: broadcastBody,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Rundmail fehlgeschlagen.')
      setBroadcastResult(`Rundmail versendet: ${body.sent} erfolgreich zugestellt${body.failed ? `, ${body.failed} fehlgeschlagen` : ''}.`)
      if (body.sent > 0 && body.failed === 0) {
        setBroadcastSubject('')
        setBroadcastBody('')
      }
    } catch (err) {
      setBroadcastResult(err instanceof Error ? err.message : 'Versandfehler.')
    } finally {
      setSendingBroadcast(false)
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
  const { overview, live, users, regions, dailyStats, contactMessages, umamiUrl, currentAdminId, serverTimestamp } = data
  const maxDailyViews = Math.max(1, ...dailyStats.map(d => d.pageViews))
  const unreadMessages = contactMessages.filter(m => !m.isRead).length
  const usersWithEmailCount = users.filter(u => Boolean(u.email)).length
  const onlineRegisteredCount = users.filter(u => u.isOnlineNow).length

  const filteredUsers = users
    .filter(u => {
      const q = userSearch.trim().toLowerCase()
      if (!q) return true
      return (
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (userSort === 'onlineFirst') {
        if (a.isOnlineNow !== b.isOnlineNow) return a.isOnlineNow ? -1 : 1
        const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
        const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
        return tb - ta
      }
      if (userSort === 'lastActive') {
        const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
        const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
        return tb - ta
      }
      if (userSort === 'entries') {
        return b.vacationsCount - a.vacationsCount
      }
      if (userSort === 'name') {
        const na = (a.name || a.username || a.email || '').toLowerCase()
        const nb = (b.name || b.username || b.email || '').toLowerCase()
        return na.localeCompare(nb, 'de')
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  return (
    <main className="container max-w-6xl space-y-6 py-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-primary underline font-medium">
            ← Zurück zum Urlaubsplaner
          </Link>
          <h1 className="mt-1 text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Admin-Dashboard, Live-Analytics &amp; Nutzerverwaltung
          </h1>
          <p className="text-xs text-muted-foreground">
            Echtzeit-Besucher, Benutzerkonten &amp; letzte Aktivität, SMTP, Social Logins &amp; Rundmails
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium cursor-pointer">
            <span className="relative flex h-2 w-2">
              {liveRefresh && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${liveRefresh ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
            </span>
            <span>Live (15s)</span>
            <Switch checked={liveRefresh} onCheckedChange={setLiveRefresh} aria-label="Automatische Live-Aktualisierung alle 15 Sekunden" />
          </label>
          <Button variant="outline" size="sm" onClick={() => void fetchStats(false)}>
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

      {/* ==================================================================== */}
      {/* Live Real-Time Analytics Panel                                       */}
      {/* ==================================================================== */}
      {live && (
        <section aria-labelledby="live-analytics-heading" className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-card to-card p-5 space-y-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div>
                <h2 id="live-analytics-heading" className="font-semibold text-base flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Live-Analytics – Echtzeit-Aktivität auf urlaubsplaner.me
                </h2>
                <p className="text-xs text-muted-foreground">
                  Datenschutzfreundlicher Heartbeat (alle 45 Sek. bei aktivem Tab, ohne IP-Speicherung)
                </p>
              </div>
            </div>
            {serverTimestamp && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Stand: {new Date(serverTimestamp).toLocaleTimeString('de-DE')} Uhr
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-background/80 p-3.5">
              <span className="text-xs text-muted-foreground">Jetzt gerade online</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {live.activeNow.toLocaleString('de-DE')}
                </span>
                <span className="text-xs text-muted-foreground">aktive Nutzer</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {live.activeAuthedNow} mit Konto · {live.activeGuestsNow} Gäste
              </p>
            </div>

            <div className="rounded-lg border bg-background/80 p-3.5">
              <span className="text-xs text-muted-foreground">Letzte 30 Minuten</span>
              <p className="mt-1 text-2xl font-bold">{live.active30m.toLocaleString('de-DE')}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Aktive Sitzungen in den letzten 30 Min.
              </p>
            </div>

            <div className="rounded-lg border bg-background/80 p-3.5">
              <span className="text-xs text-muted-foreground">Letzte 24 Stunden</span>
              <p className="mt-1 text-2xl font-bold">{live.active24h.toLocaleString('de-DE')}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Eindeutige Besucher in 24 Std.
              </p>
            </div>

            <div className="rounded-lg border bg-background/80 p-3.5">
              <span className="text-xs text-muted-foreground">Geräte-Verteilung (7 Tage)</span>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1" aria-label="Desktop">
                  <Monitor className="h-3.5 w-3.5 text-primary" />
                  <strong>{live.devices7d.desktop}</strong> PC
                </span>
                <span className="inline-flex items-center gap-1" aria-label="Smartphone">
                  <Smartphone className="h-3.5 w-3.5 text-sky-600" />
                  <strong>{live.devices7d.mobile}</strong> Mobil
                </span>
                <span className="inline-flex items-center gap-1" aria-label="Tablet">
                  <Tablet className="h-3.5 w-3.5 text-purple-600" />
                  <strong>{live.devices7d.tablet}</strong> Tablet
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Live jetzt: {live.liveDevices.desktop} PC · {live.liveDevices.mobile} Mobil · {live.liveDevices.tablet} Tablet
              </p>
            </div>
          </div>

          {live.activePaths.length > 0 && (
            <div className="rounded-lg border bg-background/60 p-3 space-y-2">
              <div className="text-xs font-medium text-foreground">Gerade angesehene Seiten (Live):</div>
              <div className="flex flex-wrap gap-2">
                {live.activePaths.map(item => (
                  <span
                    key={item.path}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs"
                  >
                    <code className="font-mono text-[11px] text-primary">{item.path}</code>
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      {item.count} live
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

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
            {overview.activeRegisteredUsers} mit Urlaubstagen · {usersWithEmailCount} mit E-Mail
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

      {/* ==================================================================== */}
      {/* User Management Table                                                */}
      {/* ==================================================================== */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="admin-users-heading" className="font-semibold text-base flex flex-wrap items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>Benutzerverwaltung ({users.length} registrierte Konten)</span>
              {onlineRegisteredCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {onlineRegisteredCount} online
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Verwalte alle Nutzerkonten: letzte Aktivität prüfen, Admin-Rechte vergeben, Passwörter zurücksetzen, Kontodaten bearbeiten oder Konten löschen.
            </p>
          </div>
          <search className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              aria-label="Nutzer sortieren"
              value={userSort}
              onChange={e => setUserSort(e.target.value as UserSortKey)}
              className="min-h-9 rounded-lg border bg-background px-2.5 text-xs"
            >
              <option value="lastActive">Sortierung: Zuletzt aktiv</option>
              <option value="onlineFirst">Sortierung: Online zuerst</option>
              <option value="createdAt">Sortierung: Neueste Konten</option>
              <option value="entries">Sortierung: Meiste Einträge</option>
              <option value="name">Sortierung: Name (A–Z)</option>
            </select>
            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                aria-label="Nutzer durchsuchen"
                placeholder="Suche nach Name, @user, E-Mail…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="min-h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-xs"
              />
            </div>
          </search>
        </div>

        {userActionStatus && (
          <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
            {userActionStatus}
          </p>
        )}

        {/* Password Reset Inline Dialog */}
        {passwordModalUser && (
          <div className="rounded-xl border border-primary/40 bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Passwort zurücksetzen für: {passwordModalUser.username || passwordModalUser.email || passwordModalUser.name}
              </h3>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setPasswordModalUser(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="text-xs font-semibold">Option 1: Neues Passwort direkt festlegen</div>
                <input
                  type="text"
                  minLength={6}
                  maxLength={128}
                  placeholder="Neues Passwort (mind. 6 Zeichen)"
                  value={newAdminPassword}
                  onChange={e => setNewAdminPassword(e.target.value)}
                  className="min-h-9 w-full rounded-lg border bg-background px-3 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={newAdminPassword.length < 6 || userActionBusy === passwordModalUser.id}
                  onClick={() => void handleAdminResetPassword('set_password')}
                  className="w-full h-8 text-xs"
                >
                  Passwort speichern &amp; Sitzungen abmelden
                </Button>
              </div>
              <div className="rounded-lg border bg-card p-3 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold">Option 2: Reset-Link per E-Mail senden</div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {passwordModalUser.email
                      ? `Sendet einen 60 Minuten gültigen Passwort-Reset-Link an ${passwordModalUser.email}.`
                      : 'Für dieses Konto ist keine E-Mail-Adresse hinterlegt.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!passwordModalUser.email || userActionBusy === passwordModalUser.id}
                  onClick={() => void handleAdminResetPassword('send_reset_link')}
                  className="w-full h-8 text-xs"
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Reset-E-Mail senden
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Inline Dialog */}
        {editModalUser && (
          <form onSubmit={handleAdminUpdateUser} className="rounded-xl border border-primary/40 bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-primary" />
                Kontodaten bearbeiten: {editModalUser.username || editModalUser.email || editModalUser.id}
              </h3>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditModalUser(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <label className="block space-y-1 font-medium">
                Benutzername
                <input
                  type="text"
                  placeholder="z.B. max.mustermann"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  className="min-h-9 w-full rounded-lg border bg-background px-2.5 font-normal"
                />
              </label>
              <label className="block space-y-1 font-medium">
                E-Mail-Adresse
                <input
                  type="email"
                  placeholder="name@beispiel.de"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="min-h-9 w-full rounded-lg border bg-background px-2.5 font-normal"
                />
              </label>
              <label className="block space-y-1 font-medium">
                Anzeigename
                <input
                  type="text"
                  placeholder="Anzeigename"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="min-h-9 w-full rounded-lg border bg-background px-2.5 font-normal"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditModalUser(null)}>
                Abbrechen
              </Button>
              <Button type="submit" size="sm" disabled={userActionBusy === editModalUser.id}>
                Änderungen speichern
              </Button>
            </div>
          </form>
        )}

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="admin-users-heading"
          className="overflow-auto max-h-[560px] rounded-lg border"
        >
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="border-b p-2.5 w-8">
                  <input
                    type="checkbox"
                    aria-label="Alle Nutzer auswählen"
                    checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u.id))}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedUserIds(filteredUsers.map(u => u.id))
                      } else {
                        setSelectedUserIds([])
                      }
                    }}
                  />
                </th>
                <th scope="col" className="border-b p-2.5">Nutzer / E-Mail</th>
                <th scope="col" className="border-b p-2.5">Zuletzt aktiv</th>
                <th scope="col" className="border-b p-2.5">Logins</th>
                <th scope="col" className="border-b p-2.5">Rolle</th>
                <th scope="col" className="border-b p-2.5">Nutzung</th>
                <th scope="col" className="border-b p-2.5">Registriert</th>
                <th scope="col" className="border-b p-2.5 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    Keine passenden Benutzerkonten gefunden.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const activity = formatLastActive(u.lastActiveAt)
                  return (
                    <tr key={u.id} className="hover:bg-muted/20">
                      <td className="p-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Nutzer ${u.username || u.email || u.id} auswählen`}
                          checked={selectedUserIds.includes(u.id)}
                          onChange={e => {
                            setSelectedUserIds(prev =>
                              e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                            )
                          }}
                        />
                      </td>
                      <th scope="row" className="p-2.5 font-normal text-left">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {u.name || u.username || 'Unbenannt'}
                          {u.username && (
                            <span className="font-mono text-[11px] font-normal text-muted-foreground">
                              @{u.username}
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          {u.email ? (
                            <a href={`mailto:${u.email}`} className="text-primary hover:underline">
                              {u.email}
                            </a>
                          ) : (
                            <span className="italic">Keine E-Mail hinterlegt</span>
                          )}
                        </div>
                      </th>
                      <td className="p-2.5 whitespace-nowrap">
                        {u.isOnlineNow ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                              </span>
                              Gerade online
                            </span>
                            <div className="text-[10px] text-muted-foreground">{activity.exact}</div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-medium text-foreground">{activity.relative}</div>
                            {u.lastActiveAt && (
                              <div className="text-[10px] text-muted-foreground">{activity.exact}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {u.hasPassword && (
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                              Passwort
                            </span>
                          )}
                          {u.googleLinked && (
                            <span className="rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 text-[10px] font-medium">
                              Google
                            </span>
                          )}
                          {u.githubLinked && (
                            <span className="rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 text-[10px] font-medium">
                              GitHub
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5">
                        {u.isAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold">
                            <Shield className="h-3 w-3" aria-hidden="true" /> Admin
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Nutzer</span>
                        )}
                      </td>
                      <td className="p-2.5 text-[11px] text-muted-foreground">
                        {u.vacationsCount} Einträge · {u.feedsCount} Kalender · {u.sharesCount} Shares
                      </td>
                      <td className="p-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString('de-DE')}
                      </td>
                      <td className="p-2.5 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => {
                              setEditModalUser(u)
                              setEditUsername(u.username || '')
                              setEditEmail(u.email || '')
                              setEditName(u.name || '')
                            }}
                            aria-label={`Kontodaten von ${u.username || u.email || u.id} bearbeiten`}
                          >
                            <Edit3 className="h-3 w-3" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => {
                              setPasswordModalUser(u)
                              setNewAdminPassword('')
                            }}
                            aria-label={`Passwort von ${u.username || u.email || u.id} zurücksetzen`}
                          >
                            <KeyRound className="h-3 w-3 mr-1" aria-hidden="true" /> Passwort
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={userActionBusy === u.id || (u.id === currentAdminId && u.isAdmin)}
                            className="h-7 px-2 text-[11px]"
                            onClick={() => void handleToggleAdmin(u)}
                            aria-label={u.isAdmin ? `Admin-Rechte von ${u.username || u.id} entziehen` : `${u.username || u.id} zum Admin machen`}
                          >
                            <Shield className="h-3 w-3 mr-1" aria-hidden="true" />
                            {u.isAdmin ? 'Entziehen' : 'Admin'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={userActionBusy === u.id}
                            className="h-7 px-2 text-[11px]"
                            onClick={() => void handleLogoutUser(u)}
                            aria-label={`Alle Sitzungen von ${u.username || u.email || u.id} abmelden`}
                          >
                            <LogOut className="h-3 w-3" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={userActionBusy === u.id || u.id === currentAdminId || u.username === 'markenjaden'}
                            className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                            onClick={() => void handleDeleteUser(u)}
                            aria-label={`Konto von ${u.username || u.email || u.id} löschen`}
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SMTP Configuration & Broadcast Email (Rundmail)                      */}
      {/* ==================================================================== */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* SMTP Server Configuration */}
        <form onSubmit={handleSaveSmtp} className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                SMTP-Server einrichten (E-Mail-Versand)
              </h2>
              <p className="text-xs text-muted-foreground">
                Wird für „Passwort vergessen“-Mails sowie für Rundmails an deine Nutzer verwendet.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${smtpEnabled && smtpHost && smtpFromEmail ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                {smtpEnabled && smtpHost && smtpFromEmail ? 'Aktiv' : 'Inaktiv'}
              </span>
              <Switch checked={smtpEnabled} onCheckedChange={setSmtpEnabled} aria-label="SMTP aktivieren" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            <label className="block space-y-1 font-medium sm:col-span-2">
              SMTP-Host
              <input
                type="text"
                placeholder="smtp.beispiel.de"
                value={smtpHost}
                onChange={e => setSmtpHost(e.target.value)}
                className="min-h-9 w-full rounded-lg border bg-background px-3 font-normal"
              />
            </label>
            <label className="block space-y-1 font-medium">
              Port
              <input
                type="number"
                min={1}
                max={65535}
                value={smtpPort}
                onChange={e => {
                  const p = Number(e.target.value)
                  setSmtpPort(p)
                  if (p === 465) setSmtpSecure(true)
                  if (p === 587) setSmtpSecure(false)
                }}
                className="min-h-9 w-full rounded-lg border bg-background px-3 font-normal"
              />
            </label>
          </div>

          <label className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2 text-xs">
            <span>Direktes SSL/TLS verwenden (aktiv für Port 465, aus für STARTTLS Port 587)</span>
            <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <label className="block space-y-1 font-medium">
              SMTP-Benutzername
              <input
                type="text"
                placeholder="noreply@urlaubsplaner.me"
                value={smtpUser}
                onChange={e => setSmtpUser(e.target.value)}
                className="min-h-9 w-full rounded-lg border bg-background px-3 font-normal"
              />
            </label>
            <label className="block space-y-1 font-medium">
              SMTP-Passwort {hasSmtpPass && <span className="text-emerald-600 font-normal">(gespeichert)</span>}
              <div className="relative">
                <input
                  type={showSmtpPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={hasSmtpPass ? '••••••••••••••••' : 'Passwort'}
                  value={smtpPass}
                  onChange={e => setSmtpPass(e.target.value)}
                  className="min-h-9 w-full rounded-lg border bg-background pl-3 pr-9 font-normal"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPass(v => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                  {showSmtpPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <label className="block space-y-1 font-medium">
              Absender-E-Mail (From)
              <input
                type="email"
                placeholder="noreply@urlaubsplaner.me"
                value={smtpFromEmail}
                onChange={e => setSmtpFromEmail(e.target.value)}
                className="min-h-9 w-full rounded-lg border bg-background px-3 font-normal"
              />
            </label>
            <label className="block space-y-1 font-medium">
              Absender-Name
              <input
                type="text"
                placeholder="Urlaubsplaner"
                value={smtpFromName}
                onChange={e => setSmtpFromName(e.target.value)}
                className="min-h-9 w-full rounded-lg border bg-background px-3 font-normal"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <input
              type="email"
              placeholder="Test-Empfänger (E-Mail)"
              value={testSmtpTo}
              onChange={e => setTestSmtpTo(e.target.value)}
              className="min-h-8 flex-1 rounded-lg border bg-background px-2.5 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testingSmtp || savingSmtp}
              onClick={() => void handleTestSmtp()}
            >
              {testingSmtp ? 'Sende…' : 'Test-Mail senden'}
            </Button>
            <Button type="submit" size="sm" disabled={savingSmtp}>
              {savingSmtp ? 'Speichert…' : 'SMTP speichern'}
            </Button>
          </div>

          {smtpMessage && (
            <p role="status" className="text-xs font-medium text-primary">
              {smtpMessage}
            </p>
          )}
        </form>

        {/* Broadcast Email (Rundmail) */}
        <form onSubmit={handleSendBroadcast} className="rounded-xl border bg-card p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div>
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                Rundmail an Nutzer verschicken
              </h2>
              <p className="text-xs text-muted-foreground">
                Versende Neuigkeiten, Wartungshinweise oder neue Funktionen direkt an deine registrierten Nutzer ({usersWithEmailCount} Konten mit E-Mail-Adresse).
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setBroadcastMode('all')}
                className={`rounded-md py-1.5 transition-colors ${broadcastMode === 'all' ? 'bg-background shadow-2xs text-foreground' : 'text-muted-foreground'}`}
              >
                Alle ({usersWithEmailCount})
              </button>
              <button
                type="button"
                onClick={() => setBroadcastMode('admins')}
                className={`rounded-md py-1.5 transition-colors ${broadcastMode === 'admins' ? 'bg-background shadow-2xs text-foreground' : 'text-muted-foreground'}`}
              >
                Nur Admins (Test)
              </button>
              <button
                type="button"
                onClick={() => setBroadcastMode('selected')}
                className={`rounded-md py-1.5 transition-colors ${broadcastMode === 'selected' ? 'bg-background shadow-2xs text-foreground' : 'text-muted-foreground'}`}
              >
                Auswahl ({selectedUserIds.length})
              </button>
            </div>

            <label className="block space-y-1 text-xs font-medium">
              Betreff der Rundmail
              <input
                required
                type="text"
                maxLength={140}
                placeholder="z.B. Neue Funktionen im Urlaubsplaner 🌴"
                value={broadcastSubject}
                onChange={e => setBroadcastSubject(e.target.value)}
                className="min-h-9 w-full rounded-lg border bg-background px-3 font-normal"
              />
            </label>

            <label className="block space-y-1 text-xs font-medium">
              Nachrichtentext
              <textarea
                required
                rows={5}
                placeholder="Hallo zusammen,&#10;&#10;im Urlaubsplaner gibt es ab sofort folgende Neuerungen..."
                value={broadcastBody}
                onChange={e => setBroadcastBody(e.target.value)}
                className="w-full rounded-lg border bg-background p-3 font-normal leading-relaxed"
              />
            </label>
          </div>

          <div className="space-y-2 border-t pt-3">
            {broadcastResult && (
              <p role="status" className="text-xs font-medium text-primary">
                {broadcastResult}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Wird einzeln über deinen konfigurierten SMTP-Server versendet.
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={sendingBroadcast || (broadcastMode === 'selected' && selectedUserIds.length === 0)}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {sendingBroadcast ? 'Wird gesendet…' : 'Rundmail absenden'}
              </Button>
            </div>
          </div>
        </form>
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
              Aktiviere die Anmeldung über Google oder GitHub. Sobald aktiviert und hinterlegt, erscheinen die Buttons automatisch auf <code>/login</code>, <code>/register</code> und zur Verknüpfung in <code>/settings</code>.
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
              Geheime Schlüssel werden nur auf dem Server verwendet und niemals im Browser ausgelesen.
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
