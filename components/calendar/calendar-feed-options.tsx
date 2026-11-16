'use client'

import { Switch } from '@/components/ui/switch'
import type { PreferencesPatch, SharedPlanOverlay, UserPreferences } from '@/types'

interface CalendarFeedOptionsProps {
  prefs: UserPreferences
  sharedOverlays: SharedPlanOverlay[]
  locationReady: boolean
  regionLabel: string
  onUpdate: (patch: PreferencesPatch) => void
  compact?: boolean
}

export function CalendarFeedOptions({
  prefs,
  sharedOverlays,
  locationReady,
  regionLabel,
  onUpdate,
  compact = false,
}: CalendarFeedOptionsProps) {
  const includeVacations = prefs.feedIncludeVacations ?? true
  const includeGleittage = prefs.feedIncludeGleittage ?? true
  const includeNotes = Boolean(prefs.feedIncludeNotes)
  const includeNoteTitles = prefs.feedIncludeNoteTitles ?? true
  const includePublic = Boolean(prefs.feedIncludePublicHolidays)
  const includeSchool = Boolean(prefs.feedIncludeSchoolHolidays)
  const includeBridge = Boolean(prefs.feedIncludeBridgeDays)
  const includeSharedOverlays = Boolean(prefs.feedIncludeSharedOverlays)
  const selectedSharedIds = prefs.feedSharedOverlayIds ?? []

  const itemClass = compact
    ? 'flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5'
    : 'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm'

  return (
    <div className="space-y-2">
      <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <label className={itemClass}>
          <span>🌴 Urlaubstage</span>
          <Switch
            checked={includeVacations}
            onCheckedChange={checked => onUpdate({ feedIncludeVacations: checked })}
          />
        </label>
        <label className={itemClass}>
          <span>⏰ Gleittage</span>
          <Switch
            checked={includeGleittage}
            onCheckedChange={checked => onUpdate({ feedIncludeGleittage: checked })}
          />
        </label>
        <label className={itemClass}>
          <span>📝 Meine Notizen</span>
          <Switch
            checked={includeNotes}
            onCheckedChange={checked => onUpdate({ feedIncludeNotes: checked })}
          />
        </label>
        <label className={itemClass}>
          <span>🔒 Notiz-Texte zeigen</span>
          <Switch
            checked={includeNoteTitles}
            disabled={!includeNotes}
            onCheckedChange={checked => onUpdate({ feedIncludeNoteTitles: checked })}
          />
        </label>
        <label className={itemClass}>
          <span>🎉 Feiertage ({regionLabel})</span>
          <Switch
            checked={includePublic}
            disabled={!locationReady}
            onCheckedChange={checked => onUpdate({ feedIncludePublicHolidays: checked })}
          />
        </label>
        <label className={itemClass}>
          <span>🏫 Schulferien ({regionLabel})</span>
          <Switch
            checked={includeSchool}
            disabled={!locationReady}
            onCheckedChange={checked => onUpdate({ feedIncludeSchoolHolidays: checked })}
          />
        </label>
        <label className={`${itemClass} sm:col-span-2`}>
          <span>🌉 Brückentag-Empfehlungen ({regionLabel})</span>
          <Switch
            checked={includeBridge}
            disabled={!locationReady}
            onCheckedChange={checked => onUpdate({ feedIncludeBridgeDays: checked })}
          />
        </label>
        <label className={`${itemClass} sm:col-span-2`}>
          <span>🤝 Geteilte Pläne einbeziehen ({sharedOverlays.length})</span>
          <Switch
            checked={includeSharedOverlays}
            disabled={sharedOverlays.length === 0}
            onCheckedChange={checked => onUpdate({ feedIncludeSharedOverlays: checked })}
          />
        </label>
      </div>

      {includeSharedOverlays && sharedOverlays.length > 0 && (
        <div className="rounded-md border bg-background/70 p-2.5 space-y-1.5 text-xs">
          <span className="font-medium text-muted-foreground block">
            Ausgewählte geteilte Pläne (leer = alle aktivierten):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sharedOverlays.map(ov => {
              const active =
                selectedSharedIds.length === 0
                  ? ov.enabled !== false
                  : selectedSharedIds.includes(ov.id)
              return (
                <button
                  key={ov.id}
                  type="button"
                  onClick={() => {
                    const base =
                      selectedSharedIds.length === 0
                        ? sharedOverlays.filter(o => o.enabled !== false).map(o => o.id)
                        : selectedSharedIds
                    const next = base.includes(ov.id)
                      ? base.filter(id => id !== ov.id)
                      : [...base, ov.id]
                    onUpdate({ feedSharedOverlayIds: next })
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition-colors ${
                    active
                      ? 'border-primary bg-primary/10 text-foreground font-medium'
                      : 'border-border text-muted-foreground opacity-70'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: ov.color }}
                  />
                  {ov.label}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tipp: Für eine eigene Kalenderfarbe in Google Kalender oder Outlook lege unten ein separates Abo nur für den geteilten Plan an.
          </p>
        </div>
      )}
    </div>
  )
}
