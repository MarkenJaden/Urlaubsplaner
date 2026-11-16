'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Check, Tag, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { groupEntriesIntoBlocks } from '@/lib/export'
import type { EntryType, VacationEntry } from '@/types'

interface VacationNamesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  entries: VacationEntry[]
  workDays?: number[]
  onSaveBlockTitle: (dates: string[], type: EntryType, title: string | null) => void
}

const TYPE_META: Record<'vacation' | 'gleittag' | 'special', { label: string; dotClass: string; badgeClass: string }> = {
  vacation: {
    label: 'Urlaub',
    dotClass: 'bg-blue-600',
    badgeClass: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  gleittag: {
    label: 'Gleittag',
    dotClass: 'bg-purple-600',
    badgeClass: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  },
  special: {
    label: 'Sonderurlaub',
    dotClass: 'bg-cyan-600',
    badgeClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  },
}

export function VacationNamesDialog({
  open,
  onOpenChange,
  year,
  entries,
  workDays,
  onSaveBlockTitle,
}: VacationNamesDialogProps) {
  const blocks = useMemo(() => {
    const yearEntries = entries.filter(
      e =>
        e.date.startsWith(`${year}-`) &&
        (e.type === 'vacation' || e.type === 'gleittag' || e.type === 'special'),
    )
    return groupEntriesIntoBlocks(yearEntries, { workDays, splitByTitle: true })
  }, [entries, year, workDays])

  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const blockKey = (type: EntryType, startDate: string, endDate: string) => `${type}:${startDate}:${endDate}`

  const handleSave = (key: string, dates: string[], type: EntryType, currentTitle: string) => {
    const raw = key in drafts ? drafts[key] : currentTitle
    const trimmed = raw.trim()
    onSaveBlockTitle(dates, type, trimmed || null)
    setDrafts(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleClear = (key: string, dates: string[], type: EntryType) => {
    onSaveBlockTitle(dates, type, null)
    setDrafts(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Urlaub &amp; Zeiträume benennen ({year})
          </DialogTitle>
          <DialogDescription>
            Gib deinen geplanten Zeiträumen eigene Namen (z.&nbsp;B. &bdquo;Urlaub Fuerteventura&ldquo; oder &bdquo;Freizeitparkurlaub&ldquo;). Sie erscheinen im Kalender, im Export und im Kalender-Abo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 py-1">
          {blocks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Noch keine Urlaubs-, Gleittags- oder Sonderurlaubs-Einträge in {year} vorhanden.
            </p>
          ) : (
            blocks.map(block => {
              const key = blockKey(block.type, block.startDate, block.endDate)
              const currentTitle = block.titles[0] ?? ''
              const value = key in drafts ? drafts[key] : currentTitle
              const isDirty = value.trim() !== currentTitle.trim()
              const meta = TYPE_META[block.type as 'vacation' | 'gleittag' | 'special'] ?? TYPE_META.vacation
              const spanLabel =
                block.startDate === block.endDate
                  ? format(parseISO(block.startDate), 'dd.MM.yyyy (EE)', { locale: de })
                  : `${format(parseISO(block.startDate), 'dd.MM.', { locale: de })} – ${format(parseISO(block.endDate), 'dd.MM.yyyy', { locale: de })}`

              return (
                <form
                  key={key}
                  onSubmit={e => {
                    e.preventDefault()
                    handleSave(key, block.dates, block.type, currentTitle)
                  }}
                  className="rounded-lg border border-border bg-card p-2.5 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.dotClass}`} aria-hidden="true" />
                      <span className="font-semibold">{spanLabel}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${meta.badgeClass}`}>
                        {meta.label}
                      </Badge>
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        {block.daysCount} {block.daysCount === 1 ? 'Tag' : 'Tage'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      maxLength={500}
                      value={value}
                      onChange={e => setDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="z.B. Urlaub Fuerteventura, Freizeitparkurlaub…"
                      aria-label={`Bezeichnung für ${spanLabel}`}
                      className="h-8 flex-1 min-w-0 rounded-md border border-input bg-background px-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {currentTitle && !isDirty && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleClear(key, block.dates, block.type)}
                        title="Bezeichnung entfernen"
                        aria-label="Bezeichnung entfernen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="submit"
                      size="sm"
                      variant={isDirty ? 'default' : 'outline'}
                      disabled={!isDirty}
                      className="h-8 px-2.5 gap-1 shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Speichern</span>
                    </Button>
                  </div>
                </form>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
