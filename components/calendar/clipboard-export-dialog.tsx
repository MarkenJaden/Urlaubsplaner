'use client'

import { useState, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Clipboard, Check, Download, Mail, List, Table, MessageSquare, FileSpreadsheet, Calendar } from 'lucide-react'
import { formatCustomClipboardExport, downloadFile, type ClipboardFormat } from '@/lib/export'
import type { VacationEntry } from '@/types'

interface ClipboardExportDialogProps {
  open: boolean
  onClose: () => void
  entries: VacationEntry[]
  year: number
  vacationDaysUsed: number
  vacationDaysTotal: number
}

export function ClipboardExportDialog({
  open,
  onClose,
  entries,
  year,
  vacationDaysUsed,
  vacationDaysTotal,
}: ClipboardExportDialogProps) {
  const [formatType, setFormatType] = useState<ClipboardFormat>('compact_periods')
  const [includeVacations, setIncludeVacations] = useState(true)
  const [includeGleittage, setIncludeGleittage] = useState(true)
  const [includeNotes, setIncludeNotes] = useState(false)
  const [includeTitles, setIncludeTitles] = useState(true)
  const [includeWeekNumbers, setIncludeWeekNumbers] = useState(true)
  const [includeWeekdays, setIncludeWeekdays] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [onlyFuture, setOnlyFuture] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [senderName, setSenderName] = useState('')
  const [customPreview, setCustomPreview] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generatedText = useMemo(
    () =>
      formatCustomClipboardExport(entries, {
        format: formatType,
        includeVacations,
        includeGleittage,
        includeNotes,
        includeTitles,
        includeWeekNumbers,
        includeWeekdays,
        includeSummary,
        onlyFuture,
        year,
        vacationDaysUsed,
        vacationDaysTotal,
        recipientName,
        senderName,
      }),
    [
      entries,
      formatType,
      includeVacations,
      includeGleittage,
      includeNotes,
      includeTitles,
      includeWeekNumbers,
      includeWeekdays,
      includeSummary,
      onlyFuture,
      year,
      vacationDaysUsed,
      vacationDaysTotal,
      recipientName,
      senderName,
    ],
  )

  useEffect(() => {
    setCustomPreview(null)
  }, [generatedText])

  const finalText = customPreview ?? generatedText

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(finalText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      void fetch('/api/analytics/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'export' }),
      }).catch(() => {})
    } catch {
      // Fallback
    }
  }

  const handleDownloadTxt = () => {
    downloadFile(finalText, `urlaubsplanung-${year}.txt`, 'text/plain;charset=utf-8')
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <Clipboard className="h-5 w-5 text-primary" /> Text-Export & Zwischenablage ({year})
        </DialogTitle>
        <p className="text-sm text-muted-foreground mb-3">
          Stelle genau ein, welche Einträge in welchem Format kopiert werden sollen – ideal für Vorgesetzte, HR, E-Mail oder Chat.
        </p>

        {/* Format-Auswahl */}
        <div className="mb-4 space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">1. Format & Vorlage wählen</span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {([
              { id: 'compact_periods', icon: Calendar, label: 'Zeiträume (Kompakt)', desc: '04.05. – 08.05. (5 Tage)' },
              { id: 'email_boss', icon: Mail, label: 'E-Mail an Vorgesetzte', desc: 'Fertiges Anschreiben' },
              { id: 'markdown_table', icon: Table, label: 'Markdown-Tabelle', desc: 'Für Teams, Notion, GitHub' },
              { id: 'chat_short', icon: MessageSquare, label: 'Chat / WhatsApp', desc: 'Kurzformat mit Emojis' },
              { id: 'single_days', icon: List, label: 'Einzelne Tage', desc: 'Jeder Tag als eigene Zeile' },
              { id: 'excel_tsv', icon: FileSpreadsheet, label: 'Excel (Direkt einfügen)', desc: 'Tab-getrennt für Strg+V' },
            ] as const).map(item => {
              const Icon = item.icon
              const active = formatType === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFormatType(item.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors ${
                    active ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className="h-3.5 w-3.5 text-primary" /> {item.label}
                  </span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">{item.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* E-Mail Zusatzfelder */}
        {formatType === 'email_boss' && (
          <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 text-xs">
            <label className="space-y-1">
              <span className="text-muted-foreground block">Empfänger / Anrede (optional)</span>
              <input
                type="text"
                placeholder="z.B. Frau Müller / liebes Team"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                className="w-full rounded border bg-background px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground block">Dein Name für Grußformel (optional)</span>
              <input
                type="text"
                placeholder="z.B. Jan"
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                className="w-full rounded border bg-background px-2.5 py-1.5 text-xs"
              />
            </label>
          </div>
        )}

        {/* Inhalts-Filter */}
        <div className="mb-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">2. Was soll enthalten sein?</span>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
              <Switch checked={includeVacations} onCheckedChange={setIncludeVacations} />
              <span>🌴 Urlaub</span>
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
              <Switch checked={includeGleittage} onCheckedChange={setIncludeGleittage} />
              <span>⏰ Gleittage</span>
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
              <Switch checked={includeNotes} onCheckedChange={setIncludeNotes} />
              <span>📝 Notizen</span>
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
              <Switch checked={includeTitles} onCheckedChange={setIncludeTitles} />
              <span>Titel / Hinweise</span>
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
              <Switch checked={includeWeekNumbers} onCheckedChange={setIncludeWeekNumbers} />
              <span>Kalenderwochen</span>
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
              <Switch checked={includeWeekdays} onCheckedChange={setIncludeWeekdays} />
              <span>Wochentage</span>
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
              <Switch checked={includeSummary} onCheckedChange={setIncludeSummary} />
              <span>Gesamt-Statistik</span>
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
              <Switch checked={onlyFuture} onCheckedChange={setOnlyFuture} />
              <span>Nur ab heute</span>
            </label>
          </div>
        </div>

        {/* Live-Vorschau */}
        <div className="mb-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="clipboard-preview-textarea" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              3. Live-Vorschau (kann bei Bedarf direkt angepasst werden)
            </label>
            {customPreview !== null && (
              <button
                type="button"
                onClick={() => setCustomPreview(null)}
                className="text-xs text-primary hover:underline"
              >
                Vorschau zurücksetzen
              </button>
            )}
          </div>
          <textarea
            id="clipboard-preview-textarea"
            rows={8}
            value={finalText}
            onChange={e => setCustomPreview(e.target.value)}
            className="w-full rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleDownloadTxt}>
            <Download className="h-4 w-4" /> Als .txt herunterladen
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Schließen
            </Button>
            <Button type="button" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              {copied ? 'In Zwischenablage kopiert!' : 'In Zwischenablage kopieren'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
