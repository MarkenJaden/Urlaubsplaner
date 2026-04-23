'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSubdivisions } from '@/hooks/use-holidays'
import { useUpdatePreferences } from '@/hooks/use-profile'
import { Copy, Check, Calendar, Download } from 'lucide-react'
import type { Subdivision, UserPreferences } from '@/types'

const VACATION_DAYS_OPTIONS = [20, 24, 25, 27, 28, 30, 32, 35, 40]

interface SettingsClientProps {
  calendarToken: string
  preferences: Record<string, unknown>
}

export function SettingsClient({ calendarToken, preferences }: SettingsClientProps) {
  const [prefs, setPrefs] = useState<UserPreferences>({
    country: (preferences.country as string) ?? 'DE',
    subdivision: preferences.subdivision as string | undefined,
    vacationDays: (preferences.vacationDays as number) ?? 30,
    showPublicHolidays: (preferences.showPublicHolidays as boolean) ?? true,
    showSchoolHolidays: (preferences.showSchoolHolidays as boolean) ?? true,
    showHeatmap: (preferences.showHeatmap as boolean) ?? false,
  })
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data: subdivisions = [], isLoading: subdivisionsLoading } = useSubdivisions(prefs.country ?? 'DE')
  const updatePrefs = useUpdatePreferences()

  const calendarUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://urlaubsplaner.me'}/api/calendar/${calendarToken}/feed.ics`

  const handleCopyCalendarUrl = async () => {
    await navigator.clipboard.writeText(calendarUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    await updatePrefs.mutateAsync(prefs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-8">Einstellungen</h1>

        <div className="space-y-8">
          {/* Region */}
          <section className="bg-card rounded-lg p-6 shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Region</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Land</label>
                <Select
                  value={prefs.country ?? 'DE'}
                  onValueChange={(value) => setPrefs({ ...prefs, country: value, subdivision: undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Land wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DE">Deutschland</SelectItem>
                    <SelectItem value="AT">Österreich</SelectItem>
                    <SelectItem value="CH">Schweiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Bundesland / Region</label>
                <Select
                  value={prefs.subdivision ?? ''}
                  onValueChange={(value) => setPrefs({ ...prefs, subdivision: value })}
                  disabled={subdivisionsLoading || subdivisions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={subdivisionsLoading ? 'Lädt...' : 'Region wählen'} />
                  </SelectTrigger>
                  <SelectContent>
                    {subdivisions.map((sub: Subdivision) => (
                      <SelectItem key={sub.code} value={sub.code}>
                        {sub.name?.find((n: { language: string }) => n.language === 'DE')?.text ?? sub.shortName ?? sub.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Urlaubstage pro Jahr</label>
                <Select
                  value={String(prefs.vacationDays ?? 30)}
                  onValueChange={(value) => setPrefs({ ...prefs, vacationDays: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VACATION_DAYS_OPTIONS.map((days) => (
                      <SelectItem key={days} value={String(days)}>{days} Tage</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Ansicht */}
          <section className="bg-card rounded-lg p-6 shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Kalenderansicht</h2>
            <div className="space-y-4">
              {([
                { key: 'showPublicHolidays', label: 'Feiertage anzeigen' },
                { key: 'showSchoolHolidays', label: 'Schulferien anzeigen' },
                { key: 'showHeatmap', label: 'Heatmap anzeigen' },
              ] as const).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{label}</span>
                  <input
                    type="checkbox"
                    checked={prefs[key] ?? false}
                    onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                    className="w-4 h-4"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Kalender-Abo */}
          <section className="bg-card rounded-lg p-6 shadow-sm border">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Kalender abonnieren
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Abonniere deinen Urlaubskalender direkt in Google Calendar, Outlook oder Apple Calendar.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={calendarUrl}
                className="flex-1 text-xs bg-muted px-3 py-2 rounded-md border font-mono truncate"
              />
              <Button variant="outline" size="icon" onClick={handleCopyCalendarUrl} title="URL kopieren">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Download className="w-3 h-3" />
              Diese URL in den Kalender-Apps als "Kalender per URL abonnieren" eintragen.
            </p>
          </section>

          {/* Speichern */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updatePrefs.isPending}>
              {saved ? 'Gespeichert ✓' : updatePrefs.isPending ? 'Speichert...' : 'Einstellungen speichern'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
