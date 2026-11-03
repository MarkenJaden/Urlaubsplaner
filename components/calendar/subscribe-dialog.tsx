'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CalendarDays, Copy, Check, ExternalLink, RefreshCw, ShieldCheck, Download, LogIn } from 'lucide-react'
import { useProfile, useUpdatePreferences } from '@/hooks/use-profile'
import { createCalendar } from '@/lib/calendar'
import { downloadFile } from '@/lib/export'
import type { UserPreferences, UserProfile, VacationEntry } from '@/types'

interface SubscribeDialogProps {
  open: boolean
  onClose: () => void
  isLoggedIn: boolean
  entries: VacationEntry[]
  year: number
  locationReady: boolean
  regionLabel?: string
}

export function SubscribeDialog({
  open,
  onClose,
  isLoggedIn,
  entries,
  year,
  locationReady,
  regionLabel = 'meiner Region',
}: SubscribeDialogProps) {
  const profile = useProfile(isLoggedIn)
  const updatePrefs = useUpdatePreferences()
  const queryClient = useQueryClient()
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Guest filter states for ICS export
  const [guestVacations, setGuestVacations] = useState(true)
  const [guestGleittage, setGuestGleittage] = useState(true)
  const [guestNotes, setGuestNotes] = useState(false)
  const [guestNoteTitles, setGuestNoteTitles] = useState(true)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const prefs = (profile.data?.preferences ?? {}) as UserPreferences
  const token = profile.data?.calendarToken ?? ''

  const includeVacations = prefs.feedIncludeVacations ?? true
  const includeGleittage = prefs.feedIncludeGleittage ?? true
  const includeNotes = Boolean(prefs.feedIncludeNotes)
  const includeNoteTitles = prefs.feedIncludeNoteTitles ?? true
  const includePublic = Boolean(prefs.feedIncludePublicHolidays)
  const includeSchool = Boolean(prefs.feedIncludeSchoolHolidays)
  const includeBridge = Boolean(prefs.feedIncludeBridgeDays)

  const calendarUrl = token && origin ? `${origin}/api/calendar/${token}/feed.ics` : ''
  const webcalUrl = calendarUrl ? calendarUrl.replace(/^https?:/, 'webcal:') : ''
  const googleCalendarUrl = webcalUrl
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`
    : ''
  const outlookWebUrl = calendarUrl
    ? `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(calendarUrl)}&name=${encodeURIComponent('Urlaubsplaner')}`
    : ''

  async function copyUrl() {
    if (!calendarUrl) return
    try {
      await navigator.clipboard.writeText(calendarUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Kopieren nicht möglich. Bitte markiere den Link manuell.')
    }
  }

  async function rotateToken() {
    if (!confirm('Der bisherige Kalender-Link wird ungültig. Du musst das Abo auf deinen Geräten anschließend neu einrichten. Fortfahren?')) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/calendar/token', { method: 'POST' })
      if (!response.ok) throw new Error('Kalender-Link konnte nicht erneuert werden.')
      const data = await response.json()
      queryClient.setQueryData<UserProfile>(['profile'], previous =>
        previous ? { ...previous, calendarToken: data.calendarToken } : previous,
      )
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  function handleGuestDownloadICS() {
    const filtered = entries
      .filter(e => {
        if (e.type === 'vacation') return guestVacations
        if (e.type === 'gleittag') return guestGleittage
        if (e.type === 'note') return guestNotes
        return true
      })
      .map(e => ({
        ...e,
        title: e.type === 'note' && !guestNoteTitles ? null : e.title,
      }))
    downloadFile(createCalendar(filtered), `urlaubsplaner-${year}.ics`, 'text/calendar')
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <CalendarDays className="h-5 w-5 text-primary" /> Kalender abonnieren & verbinden
        </DialogTitle>
        <p className="text-sm text-muted-foreground mb-3">
          Binde deine Urlaubsplanung direkt in Google Kalender, Apple Kalender oder Outlook ein und wähle genau aus, welche Einträge enthalten sein sollen.
        </p>

        {isLoggedIn ? (
          <div className="space-y-4 text-sm">
            {error && (
              <p role="alert" className="rounded-lg border border-destructive/30 p-2.5 text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                1. Inhalte im Kalender-Abo konfigurieren
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                  <span>🌴 Urlaubstage</span>
                  <Switch
                    checked={includeVacations}
                    onCheckedChange={checked => updatePrefs.mutate({ feedIncludeVacations: checked })}
                  />
                </label>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                  <span>⏰ Gleittage</span>
                  <Switch
                    checked={includeGleittage}
                    onCheckedChange={checked => updatePrefs.mutate({ feedIncludeGleittage: checked })}
                  />
                </label>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                  <span>📝 Meine Notizen</span>
                  <Switch
                    checked={includeNotes}
                    onCheckedChange={checked => updatePrefs.mutate({ feedIncludeNotes: checked })}
                  />
                </label>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                  <span>🔒 Notiz-Texte zeigen</span>
                  <Switch
                    checked={includeNoteTitles}
                    disabled={!includeNotes}
                    onCheckedChange={checked => updatePrefs.mutate({ feedIncludeNoteTitles: checked })}
                  />
                </label>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                  <span>🎉 Feiertage ({regionLabel})</span>
                  <Switch
                    checked={includePublic}
                    disabled={!locationReady}
                    onCheckedChange={checked => updatePrefs.mutate({ feedIncludePublicHolidays: checked })}
                  />
                </label>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                  <span>🏫 Schulferien ({regionLabel})</span>
                  <Switch
                    checked={includeSchool}
                    disabled={!locationReady}
                    onCheckedChange={checked => updatePrefs.mutate({ feedIncludeSchoolHolidays: checked })}
                  />
                </label>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 sm:col-span-2">
                  <span>🌉 Brückentag-Empfehlungen im Kalender markieren</span>
                  <Switch
                    checked={includeBridge}
                    disabled={!locationReady}
                    onCheckedChange={checked => updatePrefs.mutate({ feedIncludeBridgeDays: checked })}
                  />
                </label>
              </div>
              {!locationReady && (
                <p className="text-[11px] text-muted-foreground">
                  Wähle zuerst dein Bundesland / deine Region, um Feiertage, Schulferien und Brückentage im Abo einzuschließen.
                </p>
              )}
            </div>

            {/* Direct Subscription Buttons */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                2. Direkt mit deinem Kalender verbinden
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {googleCalendarUrl && (
                  <Button asChild className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white">
                    <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> In Google Kalender abonnieren
                    </a>
                  </Button>
                )}
                {webcalUrl && (
                  <Button asChild variant="secondary" className="w-full justify-start">
                    <a href={webcalUrl}>
                      <ExternalLink className="h-4 w-4" /> In Apple Kalender öffnen
                    </a>
                  </Button>
                )}
                {outlookWebUrl && (
                  <Button asChild variant="outline" className="w-full justify-start">
                    <a href={outlookWebUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> In Outlook.com abonnieren
                    </a>
                  </Button>
                )}
                <Button variant="outline" onClick={copyUrl} className="w-full justify-start">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Abo-Link kopiert!' : 'Abo-Link kopieren'}
                </Button>
              </div>
            </div>

            {/* Link Input */}
            <div>
              <label htmlFor="sub-dialog-link" className="block text-xs font-medium text-muted-foreground mb-1">
                Dein persönlicher Kalender-Feed (iCal / Webcal)
              </label>
              <input
                id="sub-dialog-link"
                readOnly
                value={calendarUrl}
                className="min-h-10 w-full rounded-lg border bg-muted px-3 font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                Privater Link – bitte nur in deinen eigenen Kalender-Apps eintragen.
              </span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={rotateToken}>
                <RefreshCw className="h-3.5 w-3.5" /> Link erneuern
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
              <p className="font-medium text-foreground">
                💡 Live-Synchronisierung mit Google Kalender, Apple & Outlook
              </p>
              <p className="text-xs text-muted-foreground">
                Für ein automatisches Kalender-Abo (damit Änderungen sofort in deinem Google- oder Smartphone-Kalender erscheinen) benötigst du ein kostenloses Konto – ganz ohne E-Mail-Adresse.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" asChild>
                  <Link href="/register">Kostenloses Konto erstellen</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/login">
                    <LogIn className="h-3.5 w-3.5" /> Anmelden
                  </Link>
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Oder: Aktuellen Stand als .ics-Kalenderdatei herunterladen
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                  <span>🌴 Urlaubstage</span>
                  <Switch checked={guestVacations} onCheckedChange={setGuestVacations} />
                </label>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                  <span>⏰ Gleittage</span>
                  <Switch checked={guestGleittage} onCheckedChange={setGuestGleittage} />
                </label>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                  <span>📝 Notizen</span>
                  <Switch checked={guestNotes} onCheckedChange={setGuestNotes} />
                </label>
                <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                  <span>🔒 Notiz-Texte</span>
                  <Switch checked={guestNoteTitles} disabled={!guestNotes} onCheckedChange={setGuestNoteTitles} />
                </label>
              </div>
              <Button variant="secondary" onClick={handleGuestDownloadICS} className="w-full mt-2">
                <Download className="h-4 w-4" /> ICS-Kalenderdatei für {year} herunterladen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
