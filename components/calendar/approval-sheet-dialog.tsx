'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ApprovalSheetDocument } from './print-summary'
import {
  DEFAULT_APPROVAL_SHEET_CONFIG,
  type ApprovalSheetConfig,
  type VacationEntry,
} from '@/types'
import type { PlanScorecard } from '@/lib/vacation-scorecard'
import {
  FileText,
  Printer,
  PenTool,
  Trash2,
  SlidersHorizontal,
  UserCheck,
  CheckCircle2,
} from 'lucide-react'

interface ApprovalSheetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  regionLabel: string
  workDaysLabel: string
  scorecard: PlanScorecard
  carryoverDays: number
  entries: VacationEntry[]
  config?: ApprovalSheetConfig
  isLoggedIn: boolean
  onSaveConfig: (next: ApprovalSheetConfig) => void
  onTriggerPrint: () => void
}

export function ApprovalSheetDialog({
  open,
  onOpenChange,
  year,
  regionLabel,
  workDaysLabel,
  scorecard,
  carryoverDays,
  entries,
  config: externalConfig,
  isLoggedIn,
  onSaveConfig,
  onTriggerPrint,
}: ApprovalSheetDialogProps) {
  const [draft, setDraft] = useState<Required<ApprovalSheetConfig>>(() => ({
    ...DEFAULT_APPROVAL_SHEET_CONFIG,
    ...externalConfig,
  }))
  const [activeTab, setActiveTab] = useState<'data' | 'layout' | 'signature'>('data')
  const [savedNotice, setSavedNotice] = useState(false)

  // Signature canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (open) {
      setDraft({
        ...DEFAULT_APPROVAL_SHEET_CONFIG,
        ...externalConfig,
      })
    }
  }, [open, externalConfig])

  const updateField = <K extends keyof ApprovalSheetConfig>(
    key: K,
    value: Required<ApprovalSheetConfig>[K],
  ) => {
    setDraft(prev => {
      const next = { ...prev, [key]: value }
      onSaveConfig(next)
      setSavedNotice(true)
      return next
    })
  }

  useEffect(() => {
    if (!savedNotice) return
    const timer = window.setTimeout(() => setSavedNotice(false), 1800)
    return () => window.clearTimeout(timer)
  }, [savedNotice])

  // Draw existing signature on canvas when switching to draw tab
  useEffect(() => {
    if (activeTab !== 'signature' || draft.signatureMode !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (draft.signatureDataUrl) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
      img.src = draft.signatureDataUrl
    }
  }, [activeTab, draft.signatureMode, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    lastPosRef.current = getCanvasPoint(e)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx || !lastPosRef.current) return
    const pt = getCanvasPoint(e)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    lastPosRef.current = pt
  }

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    lastPosRef.current = null
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const dataUrl = canvas.toDataURL('image/png')
      updateField('signatureDataUrl', dataUrl)
    } catch {
      // ignore
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
    updateField('signatureDataUrl', '')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Urlaubsantrag für Vorgesetzte &amp; HR konfigurieren ({year})
            </DialogTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {savedNotice && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isLoggedIn ? 'Im Profil synchronisiert' : 'Lokal gespeichert'}
                </span>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs">
            Passe Titel, Personaldaten, sichtbare Spalten und deine digitale Unterschrift individuell an. Alle Einstellungen werden automatisch {isLoggedIn ? 'mit deinem Konto auf allen Geräten synchronisiert' : 'im Browser gespeichert'}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 pt-1">
          {/* Left Column: Configurator */}
          <div className="lg:col-span-5 space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('data')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
                  activeTab === 'data'
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Angaben
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('layout')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
                  activeTab === 'layout'
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Inhalt &amp; Layout
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('signature')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
                  activeTab === 'signature'
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PenTool className="h-3.5 w-3.5" />
                Signatur
              </button>
            </div>

            {activeTab === 'data' && (
              <div className="space-y-3 rounded-xl border bg-card p-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">Dokument-Titel</span>
                    <input
                      type="text"
                      maxLength={160}
                      value={draft.title}
                      onChange={e => updateField('title', e.target.value)}
                      placeholder="Urlaubsantrag / Jahresurlaubsplanung"
                      className="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">Untertitel / Firma (optional)</span>
                    <input
                      type="text"
                      maxLength={240}
                      value={draft.subtitle}
                      onChange={e => updateField('subtitle', e.target.value)}
                      placeholder="z.B. Muster GmbH · Personalabteilung"
                      className="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">Mitarbeiter/in (Vor- &amp; Nachname)</span>
                    <input
                      type="text"
                      maxLength={120}
                      value={draft.employeeName}
                      onChange={e => updateField('employeeName', e.target.value)}
                      placeholder="z.B. Max Mustermann"
                      className="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">Personalnummer (optional)</span>
                    <input
                      type="text"
                      maxLength={80}
                      value={draft.employeeId}
                      onChange={e => updateField('employeeId', e.target.value)}
                      placeholder="z.B. 10492"
                      className="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">Abteilung / Team / Kostenstelle</span>
                    <input
                      type="text"
                      maxLength={120}
                      value={draft.department}
                      onChange={e => updateField('department', e.target.value)}
                      placeholder="z.B. IT / Produktentwicklung"
                      className="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">Vorgesetzte/r (optional)</span>
                    <input
                      type="text"
                      maxLength={120}
                      value={draft.supervisorName}
                      onChange={e => updateField('supervisorName', e.target.value)}
                      placeholder="z.B. Dr. Anna Beispiel"
                      className="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">Standard-Vertretung (optional)</span>
                    <input
                      type="text"
                      maxLength={160}
                      value={draft.substituteName}
                      onChange={e => updateField('substituteName', e.target.value)}
                      placeholder="z.B. Lisa Müller"
                      className="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-foreground">Ort &amp; Datum</span>
                    <input
                      type="text"
                      maxLength={120}
                      value={draft.locationDate}
                      onChange={e => updateField('locationDate', e.target.value)}
                      placeholder="z.B. Berlin, 12.11.2026"
                      className="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="font-medium text-foreground">Freitext / Bemerkung auf dem Antrag</span>
                  <textarea
                    rows={2}
                    maxLength={800}
                    value={draft.customNote}
                    onChange={e => updateField('customNote', e.target.value)}
                    placeholder="z.B. Bitte um Genehmigung meiner Jahresurlaubsplanung. Vertretung ist im Team abgestimmt."
                    className="w-full rounded-md border bg-background p-2 text-xs"
                  />
                </label>
              </div>
            )}

            {activeTab === 'layout' && (
              <div className="space-y-3 rounded-xl border bg-card p-3.5">
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground block">Kopfzeilen-Design</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: 'classic', label: 'Klassisch (HR)' },
                      { id: 'modern', label: 'Modern (Dunkel)' },
                      { id: 'minimal', label: 'Minimal' },
                    ] as const).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateField('headerLayout', opt.id)}
                        className={`rounded-lg border py-1.5 px-2 font-medium transition-colors ${
                          draft.headerLayout === opt.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'bg-background hover:bg-muted'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-t pt-2.5">
                  <span className="font-semibold text-foreground block">Sichtbare Bereiche &amp; Spalten</span>
                  <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>Urlaubskonto-Zusammenfassung im Kopfbereich</span>
                    <Switch
                      checked={draft.showSummaryBox}
                      onCheckedChange={v => updateField('showSummaryBox', v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>Bundesland &amp; Arbeitszeitmodell im Kopfbereich</span>
                    <Switch
                      checked={draft.showRegionAndWorkDays}
                      onCheckedChange={v => updateField('showRegionAndWorkDays', v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>Resturlaub aus Vorjahr ausweisen (falls vorhanden)</span>
                    <Switch
                      checked={draft.showCarryoverInSummary}
                      onCheckedChange={v => updateField('showCarryoverInSummary', v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>Spalte „Kalenderwoche (KW)“</span>
                    <Switch
                      checked={draft.showCalendarWeek}
                      onCheckedChange={v => updateField('showCalendarWeek', v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>Spalte „Gleittage“</span>
                    <Switch
                      checked={draft.showGleittage}
                      onCheckedChange={v => updateField('showGleittage', v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>Spalte „Vertretung / Bemerkung“</span>
                    <Switch
                      checked={draft.showSubstituteColumn}
                      onCheckedChange={v => updateField('showSubstituteColumn', v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>Spalte „Kalendertage inkl. WE/Feiertage“</span>
                    <Switch
                      checked={draft.showCalendarDays}
                      onCheckedChange={v => updateField('showCalendarDays', v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>12-Monats-Minikalender unter der Tabelle einblenden</span>
                    <Switch
                      checked={draft.showMiniCalendar}
                      onCheckedChange={v => updateField('showMiniCalendar', v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>Unterschriftsfeld für Vorgesetzte/n</span>
                    <Switch
                      checked={draft.showSupervisorSignature}
                      onCheckedChange={v => updateField('showSupervisorSignature', v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>3. Unterschriftsfeld für Personalabteilung (HR)</span>
                    <Switch
                      checked={draft.showHrSignature}
                      onCheckedChange={v => updateField('showHrSignature', v)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 py-0.5 text-muted-foreground">
                    <span>Brückentage-Effizienz im Kopfbereich zeigen (für HR meist aus)</span>
                    <Switch
                      checked={draft.showEfficiency}
                      onCheckedChange={v => updateField('showEfficiency', v)}
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'signature' && (
              <div className="space-y-3 rounded-xl border bg-card p-3.5">
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground block">
                    Digitale Unterschrift auf dem Antrag
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: 'none', label: 'Handschriftlich (leer)' },
                      { id: 'draw', label: 'Auf Pad zeichnen' },
                      { id: 'type', label: 'Schreibschrift' },
                    ] as const).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateField('signatureMode', opt.id)}
                        className={`rounded-lg border py-1.5 px-2 font-medium transition-colors ${
                          draft.signatureMode === opt.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'bg-background hover:bg-muted'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.signatureMode === 'draw' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Mit Maus, Touchpad oder Finger unterschreiben:
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={clearCanvas}
                        className="h-7 px-2 text-xs text-destructive"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Löschen
                      </Button>
                    </div>
                    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-1">
                      <canvas
                        ref={canvasRef}
                        width={420}
                        height={130}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        className="h-28 w-full cursor-crosshair touch-none"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Deine gezeichnete Signatur wird verschlüsselt mit deinen Einstellungen synchronisiert, sodass du auf jedem Gerät sofort unterschriebene PDFs erzeugen kannst.
                    </p>
                  </div>
                )}

                {draft.signatureMode === 'type' && (
                  <div className="space-y-2">
                    <label className="block space-y-1">
                      <span className="font-medium text-foreground">Gezeichneter Name (Schreibschrift)</span>
                      <input
                        type="text"
                        maxLength={120}
                        value={draft.signatureTypedText}
                        onChange={e => updateField('signatureTypedText', e.target.value)}
                        placeholder={draft.employeeName || 'Max Mustermann'}
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      />
                    </label>
                    <div className="rounded-lg border bg-white p-3 text-center text-slate-900">
                      <span
                        className="text-xl italic font-serif"
                        style={{ fontFamily: 'Georgia, "Times New Roman", cursive, serif' }}
                      >
                        {draft.signatureTypedText.trim() || draft.employeeName.trim() || 'Max Mustermann'}
                      </span>
                    </div>
                  </div>
                )}

                {draft.signatureMode === 'none' && (
                  <p className="text-muted-foreground leading-relaxed">
                    Das Unterschriftsfeld bleibt frei, damit du das ausgedruckte Formular klassisch per Stift unterschreiben kannst.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(DEFAULT_APPROVAL_SHEET_CONFIG)
                  onSaveConfig(DEFAULT_APPROVAL_SHEET_CONFIG)
                }}
              >
                Auf Standard zurücksetzen
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  window.setTimeout(() => onTriggerPrint(), 120)
                }}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Jetzt drucken / Als PDF speichern
              </Button>
            </div>
          </div>

          {/* Right Column: Live A4 Preview */}
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider">Live-Druckvorschau (DIN A4)</span>
              <span>Genau so erscheint das Dokument im Druck &amp; PDF</span>
            </div>
            <div className="max-h-[68vh] overflow-y-auto rounded-xl bg-slate-200/70 dark:bg-slate-900/70 p-3 sm:p-5">
              <ApprovalSheetDocument
                year={year}
                regionLabel={regionLabel}
                workDaysLabel={workDaysLabel}
                scorecard={scorecard}
                carryoverDays={carryoverDays}
                entries={entries}
                config={draft}
                isPreview
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
