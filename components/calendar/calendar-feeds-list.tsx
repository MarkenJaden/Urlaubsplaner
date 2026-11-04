'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Plus,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Trash2,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { CalendarFeedSubscription, UserProfile } from '@/types'

interface CalendarFeedsListProps {
  feeds: CalendarFeedSubscription[]
  origin: string
  locationReady: boolean
  regionLabel: string
}

const PRESETS = [
  {
    label: '🌴 Nur Urlaub & Gleittage',
    name: 'Urlaub & Gleittage',
    includeVacations: true,
    includeGleittage: true,
    includeNotes: false,
    includeNoteTitles: false,
    includePublicHolidays: false,
    includeSchoolHolidays: false,
    includeBridgeDays: false,
  },
  {
    label: '🏫 Nur Ferien & Feiertage',
    name: 'Ferien & Feiertage',
    includeVacations: false,
    includeGleittage: false,
    includeNotes: false,
    includeNoteTitles: false,
    includePublicHolidays: true,
    includeSchoolHolidays: true,
    includeBridgeDays: false,
  },
  {
    label: '🏢 Büro / Team (ohne Notizen)',
    name: 'Abwesenheiten (Büro)',
    includeVacations: true,
    includeGleittage: true,
    includeNotes: false,
    includeNoteTitles: false,
    includePublicHolidays: true,
    includeSchoolHolidays: false,
    includeBridgeDays: false,
  },
  {
    label: '🌉 Notizen & Brückentage',
    name: 'Notizen & Brückentage',
    includeVacations: false,
    includeGleittage: false,
    includeNotes: true,
    includeNoteTitles: true,
    includePublicHolidays: false,
    includeSchoolHolidays: false,
    includeBridgeDays: true,
  },
] as const

export function CalendarFeedsList({
  feeds,
  origin,
  locationReady,
  regionLabel,
}: CalendarFeedsListProps) {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(feeds[0]?.id ?? null)
  const [error, setError] = useState('')

  async function refreshProfile() {
    await queryClient.invalidateQueries({ queryKey: ['profile'] })
  }

  async function createFeed(preset?: (typeof PRESETS)[number]) {
    setCreating(true)
    setError('')
    try {
      const payload = preset
        ? {
            name: preset.name,
            includeVacations: preset.includeVacations,
            includeGleittage: preset.includeGleittage,
            includeNotes: preset.includeNotes,
            includeNoteTitles: preset.includeNoteTitles,
            includePublicHolidays: preset.includePublicHolidays,
            includeSchoolHolidays: preset.includeSchoolHolidays,
            includeBridgeDays: preset.includeBridgeDays,
          }
        : {
            name: newName.trim() || `Weiteres Kalender-Abo ${feeds.length + 1}`,
          }

      const res = await fetch('/api/calendar/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kalender-Abo konnte nicht angelegt werden.')
      setNewName('')
      if (data.feed?.id) setExpandedId(data.feed.id)
      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen.')
    } finally {
      setCreating(false)
    }
  }

  async function updateFeed(id: string, patch: Record<string, unknown>) {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch('/api/calendar/feeds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Änderung fehlgeschlagen.')
      queryClient.setQueryData<UserProfile>(['profile'], prev =>
        prev
          ? {
              ...prev,
              calendarFeeds: (prev.calendarFeeds ?? []).map(f => (f.id === id ? data.feed : f)),
            }
          : prev
      )
      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteFeed(id: string, name: string) {
    if (!confirm(`Kalender-Abo „${name}“ wirklich löschen? Der zugehörige Abo-Link funktioniert danach nicht mehr.`)) return
    setBusyId(id)
    setError('')
    try {
      const res = await fetch('/api/calendar/feeds', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Löschen fehlgeschlagen.')
      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen.')
    } finally {
      setBusyId(null)
    }
  }

  async function copyFeedUrl(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setError('Kopieren nicht möglich. Bitte markiere den Link manuell.')
    }
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4 text-primary" />
            Separate Kalender-Abos nach Kategorien ({feeds.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Erstelle eigene Kalender-Links mit unterschiedlichen Filtern – z.B. um Urlaub, Schulferien oder Büro-Abwesenheiten in Google Kalender oder Outlook farblich getrennt einzuordnen.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 p-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Quick Presets */}
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-muted-foreground block">
          Schnell-Vorlage hinzufügen:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(preset => (
            <Button
              key={preset.name}
              type="button"
              variant="outline"
              size="sm"
              disabled={creating}
              onClick={() => void createFeed(preset)}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            maxLength={60}
            placeholder="Eigener Name (z.B. Familienkalender, Vereinsplanung…)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="min-h-9 flex-1 rounded-lg border bg-background px-3 text-xs"
          />
          <Button
            type="button"
            size="sm"
            disabled={creating}
            onClick={() => void createFeed()}
            className="h-9"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Kalender-Abo anlegen
          </Button>
        </div>
      </div>

      {/* Existing Custom Feeds */}
      {feeds.length > 0 && (
        <div className="space-y-2.5">
          {feeds.map(feed => {
            const feedUrl = origin ? `${origin}/api/calendar/${feed.token}/feed.ics` : ''
            const webcalUrl = feedUrl ? feedUrl.replace(/^https?:/, 'webcal:') : ''
            const googleUrl = webcalUrl
              ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`
              : ''
            const outlookUrl = feedUrl
              ? `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent(`Urlaubsplaner – ${feed.name}`)}`
              : ''
            const isExpanded = expandedId === feed.id

            const activeTags: string[] = []
            if (feed.includeVacations) activeTags.push('🌴 Urlaub')
            if (feed.includeGleittage) activeTags.push('⏰ Gleittag')
            if (feed.includeNotes) activeTags.push('📝 Notizen')
            if (feed.includePublicHolidays) activeTags.push('🎉 Feiertage')
            if (feed.includeSchoolHolidays) activeTags.push('🏫 Ferien')
            if (feed.includeBridgeDays) activeTags.push('🌉 Brückentage')

            return (
              <div key={feed.id} className="rounded-xl border bg-background/70 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : feed.id)}
                    className="flex items-center gap-2 text-left font-medium text-sm hover:text-primary"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span>{feed.name}</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      ({activeTags.length > 0 ? activeTags.join(', ') : 'Leer'})
                    </span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => void copyFeedUrl(feed.id, feedUrl)}
                    >
                      {copiedId === feed.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      <span className="ml-1">{copiedId === feed.id ? 'Kopiert' : 'Link'}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busyId === feed.id}
                      onClick={() => void deleteFeed(feed.id, feed.name)}
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      aria-label={`Kalender-Abo ${feed.name} löschen`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-3 border-t pt-3 text-xs">
                    <label className="block space-y-1 font-medium">
                      Name des Kalender-Abos
                      <input
                        type="text"
                        maxLength={60}
                        defaultValue={feed.name}
                        onBlur={e => {
                          const trimmed = e.target.value.trim()
                          if (trimmed && trimmed !== feed.name) {
                            void updateFeed(feed.id, { name: trimmed })
                          }
                        }}
                        className="min-h-9 w-full rounded-lg border bg-background px-2.5 text-xs font-normal"
                      />
                    </label>

                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <label className="flex min-h-9 items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1">
                        <span>🌴 Urlaubstage</span>
                        <Switch
                          checked={feed.includeVacations}
                          onCheckedChange={checked => void updateFeed(feed.id, { includeVacations: checked })}
                        />
                      </label>
                      <label className="flex min-h-9 items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1">
                        <span>⏰ Gleittage</span>
                        <Switch
                          checked={feed.includeGleittage}
                          onCheckedChange={checked => void updateFeed(feed.id, { includeGleittage: checked })}
                        />
                      </label>
                      <label className="flex min-h-9 items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1">
                        <span>📝 Meine Notizen</span>
                        <Switch
                          checked={feed.includeNotes}
                          onCheckedChange={checked => void updateFeed(feed.id, { includeNotes: checked })}
                        />
                      </label>
                      <label className="flex min-h-9 items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1">
                        <span>🔒 Notiz-Texte zeigen</span>
                        <Switch
                          checked={feed.includeNoteTitles}
                          disabled={!feed.includeNotes}
                          onCheckedChange={checked => void updateFeed(feed.id, { includeNoteTitles: checked })}
                        />
                      </label>
                      <label className="flex min-h-9 items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1">
                        <span>🎉 Feiertage ({regionLabel})</span>
                        <Switch
                          checked={feed.includePublicHolidays}
                          disabled={!locationReady}
                          onCheckedChange={checked => void updateFeed(feed.id, { includePublicHolidays: checked })}
                        />
                      </label>
                      <label className="flex min-h-9 items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1">
                        <span>🏫 Schulferien ({regionLabel})</span>
                        <Switch
                          checked={feed.includeSchoolHolidays}
                          disabled={!locationReady}
                          onCheckedChange={checked => void updateFeed(feed.id, { includeSchoolHolidays: checked })}
                        />
                      </label>
                      <label className="flex min-h-9 items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1 sm:col-span-2">
                        <span>🌉 Brückentag-Empfehlungen</span>
                        <Switch
                          checked={feed.includeBridgeDays}
                          disabled={!locationReady}
                          onCheckedChange={checked => void updateFeed(feed.id, { includeBridgeDays: checked })}
                        />
                      </label>
                    </div>

                    <input
                      readOnly
                      aria-label={`Abo-Link für ${feed.name}`}
                      value={feedUrl}
                      className="min-h-9 w-full rounded-lg border bg-muted px-2.5 font-mono text-[11px]"
                    />

                    <div className="flex flex-wrap gap-1.5">
                      {googleUrl && (
                        <Button asChild size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                          <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Google Kalender
                          </a>
                        </Button>
                      )}
                      {webcalUrl && (
                        <Button asChild size="sm" variant="secondary" className="h-8 text-xs">
                          <a href={webcalUrl}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Apple Kalender
                          </a>
                        </Button>
                      )}
                      {outlookUrl && (
                        <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                          <a href={outlookUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Outlook.com
                          </a>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyId === feed.id}
                        onClick={() => {
                          if (confirm('Diesen Abo-Link wirklich neu generieren?')) {
                            void updateFeed(feed.id, { rotateToken: true })
                          }
                        }}
                        className="h-8 text-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Link erneuern
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
