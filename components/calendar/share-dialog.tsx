'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Share2, Copy, Check, Trash2, Users, Eye, Edit3, Plus, RefreshCw } from 'lucide-react'
import { encodeSharePayload } from '@/lib/export'
import { formatDays, formatWorkDaysLabel, isStandardFiveDayWeek } from '@/lib/vacation-accounting'
import type { VacationEntry, SharedPlanOverlay } from '@/types'
import type { SharedPlanStatSummary } from '@/components/calendar/toolbar'

const COLOR_SWATCHES = [
  { hex: '#10b981', name: 'Smaragd' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#8b5cf6', name: 'Violett' },
  { hex: '#ef4444', name: 'Koralle' },
]

export const GUEST_OWNED_SHARES_STORAGE_KEY = 'urlaubsplaner_guest_owned_shares_v1'

export interface StoredShareLink {
  id: string
  token: string
  ownerSecret?: string
  label: string
  permission: 'view' | 'edit'
  includeNotes: boolean
  color: string
  createdAt: string
}

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  isLoggedIn: boolean
  entries: VacationEntry[]
  country?: string
  subdivision?: string
  workDays?: number[]
  vacationDaysTotal?: number
  preferences?: Record<string, unknown>
  overlays: SharedPlanOverlay[]
  sharedPlanSummaries?: SharedPlanStatSummary[]
  onToggleOverlay: (id: string, enabled: boolean) => void
  onRemoveOverlay: (id: string) => void
  onAddOverlayByLink: (linkOrToken: string) => Promise<boolean>
  onRefreshOverlays?: () => Promise<void>
  onGuestShareCreated?: (share: StoredShareLink) => void
  activeCollabToken: string | null
  onSelectCollabToken: (token: string | null) => void
}

export function ShareDialog({
  open,
  onClose,
  isLoggedIn,
  entries,
  country,
  subdivision,
  workDays,
  vacationDaysTotal = 30,
  preferences,
  overlays,
  sharedPlanSummaries = [],
  onToggleOverlay,
  onRemoveOverlay,
  onAddOverlayByLink,
  onRefreshOverlays,
  onGuestShareCreated,
  activeCollabToken,
  onSelectCollabToken,
}: ShareDialogProps) {
  const [origin, setOrigin] = useState('')
  const [label, setLabel] = useState('Mein Urlaubsplan')
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [includeNotes, setIncludeNotes] = useState(false)
  const [color, setColor] = useState('#10b981')
  const [shares, setShares] = useState<StoredShareLink[]>([])
  const [loadingShares, setLoadingShares] = useState(false)
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [externalInput, setExternalInput] = useState('')
  const [addingExternal, setAddingExternal] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const fetchShares = useCallback(async () => {
    if (!isLoggedIn) {
      try {
        const raw = localStorage.getItem(GUEST_OWNED_SHARES_STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) setShares(parsed)
        }
      } catch {
        // Ignore
      }
      return
    }
    setLoadingShares(true)
    try {
      const res = await fetch('/api/shares')
      if (res.ok) setShares(await res.json())
    } catch {
      // Ignore
    } finally {
      setLoadingShares(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (open) void fetchShares()
  }, [open, fetchShares])

  const handleCopySnapshotUrl = async () => {
    const filtered = entries
      .filter(e => includeNotes || e.type !== 'note')
      .map(e => ({ date: e.date.slice(0, 10), type: e.type, ...(e.title ? { title: e.title } : {}) }))
    const encoded = encodeSharePayload({
      label: label.trim() || 'Geteilter Plan',
      color,
      country,
      subdivision,
      workDays,
      vacationDays: vacationDaysTotal,
      entries: filtered,
    })
    const url = `${origin}/?share=${encoded}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId('snapshot')
      setTimeout(() => setCopiedId(null), 2000)
      void fetch('/api/analytics/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'share' }),
      }).catch(() => {})
    } catch {
      setError('Link konnte nicht in die Zwischenablage kopiert werden.')
    }
  }

  const handleCreateLiveShare = async () => {
    setCreating(true)
    setError('')
    try {
      const payload: Record<string, unknown> = { label, permission, includeNotes, color }
      if (!isLoggedIn) {
        payload.entries = entries.map(e => ({
          date: e.date.slice(0, 10),
          type: e.type,
          ...(e.title ? { title: e.title } : {}),
        }))
        payload.preferences = {
          ...(preferences ?? {}),
          country,
          subdivision,
          workDays,
          vacationDays: vacationDaysTotal,
        }
      }

      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Freigabe-Link konnte nicht erstellt werden.')

      setShares(prev => {
        const next = [data as StoredShareLink, ...prev]
        if (!isLoggedIn) {
          try {
            localStorage.setItem(GUEST_OWNED_SHARES_STORAGE_KEY, JSON.stringify(next))
          } catch {
            // Ignore
          }
        }
        return next
      })
      if (!isLoggedIn && data.ownerSecret) {
        onGuestShareCreated?.(data as StoredShareLink)
      }

      const liveUrl = `${origin}/?shareToken=${data.token}`
      await navigator.clipboard.writeText(liveUrl).catch(() => {})
      setCopiedId(data.id)
      setTimeout(() => setCopiedId(null), 2500)
      void fetch('/api/analytics/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'share' }),
      }).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Erstellen.')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteShare = async (share: StoredShareLink) => {
    try {
      const query = share.ownerSecret
        ? `id=${encodeURIComponent(share.id)}&ownerSecret=${encodeURIComponent(share.ownerSecret)}`
        : `id=${encodeURIComponent(share.id)}`
      const res = await fetch(`/api/shares?${query}`, { method: 'DELETE' })
      if (res.ok || !isLoggedIn) {
        setShares(prev => {
          const next = prev.filter(s => s.id !== share.id)
          if (!isLoggedIn) {
            try {
              localStorage.setItem(GUEST_OWNED_SHARES_STORAGE_KEY, JSON.stringify(next))
            } catch {
              // Ignore
            }
          }
          return next
        })
      }
    } catch {
      setError('Freigabe konnte nicht gelöscht werden.')
    }
  }

  const handleCopyLiveLink = async (share: StoredShareLink) => {
    const url = `${origin}/?shareToken=${share.token}`
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopiedId(share.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleAddExternal = async () => {
    if (!externalInput.trim()) return
    setAddingExternal(true)
    setError('')
    try {
      const ok = await onAddOverlayByLink(externalInput.trim())
      if (ok) setExternalInput('')
      else setError('Ungültiger oder abgelaufener Freigabe-Link.')
    } finally {
      setAddingExternal(false)
    }
  }

  const handleManualRefresh = async () => {
    if (!onRefreshOverlays) return
    setRefreshing(true)
    try {
      await onRefreshOverlays()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <Share2 className="h-5 w-5 text-primary" /> Urlaubsplanung teilen & gemeinsam planen
        </DialogTitle>
        <p className="text-sm text-muted-foreground mb-3">
          Erstelle einen <strong>Echtzeit-Freigabe-Link</strong>, damit Partner, Familie oder Kollegen deine Planung live in ihrem Kalender sehen oder direkt mitbearbeiten können.
        </p>

        {error && (
          <p role="alert" className="mb-3 rounded-lg border border-destructive/30 p-2.5 text-xs text-destructive">
            {error}
          </p>
        )}

        {/* Konfiguration für neuen Link */}
        <div className="mb-4 rounded-xl border bg-muted/20 p-3.5 space-y-3 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
            1. Deinen Plan in Echtzeit teilen
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground block">Anzeigename des Plans</span>
              <input
                type="text"
                maxLength={60}
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="z.B. Jans Urlaub"
                className="min-h-10 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              />
            </label>
            <div className="space-y-1 text-xs">
              <span className="text-muted-foreground block">Markierungsfarbe beim Einblenden</span>
              <div className="flex items-center gap-2 pt-1">
                {COLOR_SWATCHES.map(s => (
                  <button
                    key={s.hex}
                    type="button"
                    onClick={() => setColor(s.hex)}
                    title={s.name}
                    aria-label={`Farbe ${s.name}`}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${
                      color === s.hex ? 'scale-110 border-foreground ring-2 ring-primary/40' : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: s.hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setPermission('view')}
                aria-pressed={permission === 'view'}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  permission === 'view' ? 'border-primary bg-primary/10 font-medium ring-1 ring-primary' : 'bg-background hover:bg-muted'
                }`}
              >
                <Eye className="h-3.5 w-3.5 text-primary shrink-0" />
                <div>
                  <div>Nur ansehen</div>
                  <div className="text-[10px] text-muted-foreground">Live einblenden</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPermission('edit')}
                aria-pressed={permission === 'edit'}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  permission === 'edit' ? 'border-primary bg-primary/10 font-medium ring-1 ring-primary' : 'bg-background hover:bg-muted'
                }`}
              >
                <Edit3 className="h-3.5 w-3.5 text-primary shrink-0" />
                <div>
                  <div>Mitbearbeiten</div>
                  <div className="text-[10px] text-muted-foreground">Gemeinsam planen</div>
                </div>
              </button>
            </div>

            <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
              <span>📝 Notizen ebenfalls teilen</span>
              <Switch checked={includeNotes} onCheckedChange={setIncludeNotes} />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={handleCreateLiveShare} disabled={creating}>
              <Plus className="h-4 w-4" />
              {creating ? 'Erstelle Live-Link…' : `Live-Freigabe-Link erstellen & kopieren (${permission === 'edit' ? 'Bearbeitbar' : 'Echtzeit-Ansicht'})`}
            </Button>
            <Button type="button" variant="outline" onClick={handleCopySnapshotUrl} title="Statische Kopie ohne Live-Synchronisierung">
              {copiedId === 'snapshot' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copiedId === 'snapshot' ? 'Statischer Link kopiert!' : 'Statische Momentaufnahme kopieren'}
            </Button>
          </div>
        </div>

        {/* Aktive Live-Freigabe-Links */}
        <div className="mb-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
            2. Deine aktiven Live-Freigabe-Links
          </span>
          {loadingShares ? (
            <p className="text-xs text-muted-foreground">Lade Freigaben…</p>
          ) : shares.length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch keine aktiven Live-Freigabe-Links erstellt.</p>
          ) : (
            <div className="space-y-2">
              {shares.map(s => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="font-medium truncate">{s.label}</span>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                      ● Echtzeit
                    </Badge>
                    <Badge variant={s.permission === 'edit' ? 'default' : 'secondary'} className="text-[10px]">
                      {s.permission === 'edit' ? '✏️ Bearbeitbar' : '👁️ Nur Ansicht'}
                    </Badge>
                    {s.includeNotes && <Badge variant="outline" className="text-[10px]">inkl. Notizen</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleCopyLiveLink(s)}>
                      {copiedId === s.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedId === s.id ? 'Kopiert!' : 'Link kopieren'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteShare(s)}
                      aria-label="Freigabe widerrufen"
                      title="Freigabe widerrufen"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Eingeblendete Pläne anderer Personen */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> 3. Pläne anderer Personen einblenden oder mitbearbeiten
            </span>
            {overlays.some(o => Boolean(o.token)) && onRefreshOverlays && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1"
                disabled={refreshing}
                onClick={() => void handleManualRefresh()}
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                Jetzt synchronisieren
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={externalInput}
              onChange={e => setExternalInput(e.target.value)}
              placeholder="Geteilten Link hier einfügen…"
              className="min-h-10 flex-1 rounded-md border bg-background px-3 py-1.5 text-xs"
            />
            <Button type="button" size="sm" variant="secondary" disabled={addingExternal} onClick={handleAddExternal}>
              <Plus className="h-4 w-4" /> Einblenden
            </Button>
          </div>

          {overlays.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aktuell sind keine fremden Pläne eingeblendet. Öffne einen geteilten Link oder füge ihn oben ein, um den Urlaub von Partnern, Freunden oder Kollegen in Echtzeit in deinem Kalender zu sehen.
            </p>
          ) : (
            <div className="space-y-2">
              {overlays.map(ov => {
                const isEditingThis = activeCollabToken !== null && ov.token === activeCollabToken
                const stat = sharedPlanSummaries.find(s => s.id === ov.id)
                const wdLabel = formatWorkDaysLabel(ov.workDays)
                const isCustomWd = !isStandardFiveDayWeek(ov.workDays)
                return (
                  <div key={ov.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <Switch
                        checked={ov.enabled}
                        onCheckedChange={v => onToggleOverlay(ov.id, v)}
                        aria-label={`${ov.label} einblenden`}
                      />
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: ov.color }} />
                      <span className="font-medium truncate">{ov.label}</span>
                      {ov.token ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                          ● Live
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Momentaufnahme
                        </Badge>
                      )}
                      {stat && (
                        <Badge variant="outline" className="text-[10px]">
                          Urlaub: {formatDays(stat.used)}/{formatDays(stat.total)} ({formatDays(stat.remaining)} übrig)
                        </Badge>
                      )}
                      {isCustomWd && (
                        <Badge variant="secondary" className="text-[10px]">
                          {wdLabel}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {ov.permission === 'edit' && ov.token && (
                        <Button
                          size="sm"
                          variant={isEditingThis ? 'default' : 'outline'}
                          onClick={() => onSelectCollabToken(isEditingThis ? null : ov.token!)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          {isEditingThis ? 'Bearbeitungsmodus aktiv' : 'Jetzt mitbearbeiten'}
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onRemoveOverlay(ov.id)}
                        aria-label="Eingeblendeten Plan entfernen"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
