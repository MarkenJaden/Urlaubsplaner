'use client'

import { useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Sparkles, Download, Upload, Printer,
  Settings2, MoreHorizontal, Clipboard, FileJson, CalendarDays,
  Trash2, Undo2, Share2, Trophy, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { EntryType, VacationEntry, LocalConfig } from '@/types'
import {
  exportToCSV, downloadFile,
  exportToJSON, exportToICS, parseImportFile,
  exportConfigJSON, parseConfigJSON,
} from '@/lib/export'
import { formatDays, type FlexSummary } from '@/lib/vacation-accounting'

export interface SharedPlanStatSummary {
  id: string
  label: string
  color: string
  used: number
  total: number
  remaining: number
  workDaysLabel?: string
  isDifferentWorkWeek?: boolean
  isLive?: boolean
}

interface ToolbarProps {
  year: number
  onYearChange: (year: number) => void
  selectedType: EntryType
  onTypeChange: (type: EntryType) => void
  showHeatmap: boolean
  onToggleHeatmap: (val: boolean) => void
  showPublicHolidays: boolean
  onTogglePublicHolidays: (val: boolean) => void
  showSchoolHolidays: boolean
  onToggleSchoolHolidays: (val: boolean) => void
  showBridgeDays: boolean
  onToggleBridgeDays: (val: boolean) => void
  vacationDaysUsed: number
  vacationDaysTotal: number
  workDays?: number[]
  workDaysLabel?: string
  flex: FlexSummary
  remainingWorkDays: number
  sharedPlanSummaries?: SharedPlanStatSummary[]
  canUndo: boolean
  onUndo: () => void
  entries: VacationEntry[]
  preferences: Record<string, unknown>
  localConfig?: LocalConfig | null
  activeOverlaysCount?: number
  onOpenSuggestions: () => void
  onOpenClipboardExport?: () => void
  onOpenShare?: () => void
  onOpenSubscribe?: () => void
  onOpenScorecard?: () => void
  onPrintCalendar?: () => void
  onPrintRequestSheet?: () => void
  onImport: (data: { vacations: Array<{ date: string; type: string; title?: string }>; preferences?: Record<string, unknown> }) => void
  onImportConfig?: (config: Record<string, unknown>) => void
  onReset: () => void
}

export function Toolbar({
  year, onYearChange, selectedType, onTypeChange,
  showHeatmap, onToggleHeatmap,
  showPublicHolidays, onTogglePublicHolidays,
  showSchoolHolidays, onToggleSchoolHolidays,
  showBridgeDays, onToggleBridgeDays,
  vacationDaysUsed, vacationDaysTotal, workDays, workDaysLabel,
  flex, remainingWorkDays, sharedPlanSummaries = [],
  canUndo, onUndo,
  entries, preferences, localConfig,
  activeOverlaysCount = 0,
  onOpenSuggestions, onOpenClipboardExport, onOpenShare, onOpenSubscribe,
  onOpenScorecard, onPrintCalendar, onPrintRequestSheet,
  onImport, onImportConfig, onReset,
}: ToolbarProps) {
  const remaining = vacationDaysTotal - vacationDaysUsed
  const fileInputRef = useRef<HTMLInputElement>(null)
  const configInputRef = useRef<HTMLInputElement>(null)

  const handleExportCSV = () => {
    const activeWorkDays = workDays ?? localConfig?.workDays ?? (preferences?.workDays as number[] | undefined)
    downloadFile(exportToCSV(entries, { onlyWorkdays: true, workDays: activeWorkDays }), `urlaubsplaner-${year}.csv`)
  }

  const handleExportJSON = () => {
    downloadFile(exportToJSON(entries, preferences), `urlaubsplaner-${year}.json`, 'application/json')
  }

  const handleExportICS = () => {
    downloadFile(exportToICS(entries), `urlaubsplaner-${year}.ics`, 'text/calendar')
  }

  const handleExportConfig = () => {
    const configData = localConfig ?? preferences
    downloadFile(exportConfigJSON(configData as Record<string, unknown>), 'urlaubsplaner_config.json', 'application/json')
  }

  const handlePrint = () => window.print()

  const handleReset = () => {
    if (confirm('Möchtest du wirklich alle Planungen aller Jahre löschen?')) onReset()
  }

  const handleImportClick = () => fileInputRef.current?.click()
  const handleConfigImportClick = () => configInputRef.current?.click()

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      const data = parseImportFile(content)
      if (data) onImport(data)
      else alert('Die Datei enthält keine gültigen Urlaubsplaner-Daten.')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleConfigImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      const data = parseConfigJSON(content)
      if (data && onImportConfig) onImportConfig(data)
      else if (!data) alert('Die Datei enthält keine gültige Konfiguration.')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm print:hidden">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-2.5">
        {/* Year Navigation */}
        <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-1 md:flex md:w-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onYearChange(year - 1)} aria-label="Vorheriges Jahr">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-center text-lg font-bold md:w-14">{year}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onYearChange(year + 1)} aria-label="Nächstes Jahr">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="hidden h-5 w-px bg-border md:block" />

        {/* Entry Type Selector with Hotkey Hints & Matching Calendar Colors */}
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:flex" role="group" aria-label="Eintragstyp auswählen">
          <Button
            size="sm"
            variant={selectedType === 'vacation' ? 'default' : 'outline'}
            onClick={() => onTypeChange('vacation')}
            aria-pressed={selectedType === 'vacation'}
            title="Urlaub eintragen (Tastenkürzel: U oder 1)"
            className={`h-8 px-2.5 ${selectedType === 'vacation' ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent' : ''}`}
          >
            Urlaub <span className="hidden sm:inline text-[11px] opacity-80">(U)</span>
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'gleittag' ? 'default' : 'outline'}
            onClick={() => onTypeChange('gleittag')}
            aria-pressed={selectedType === 'gleittag'}
            title="Gleittag eintragen (Tastenkürzel: G oder 2)"
            className={`h-8 px-2.5 ${selectedType === 'gleittag' ? 'bg-purple-600 hover:bg-purple-700 text-white border-transparent' : ''}`}
          >
            Gleittag <span className="hidden sm:inline text-[11px] opacity-80">(G)</span>
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'special' ? 'default' : 'outline'}
            onClick={() => onTypeChange('special')}
            aria-pressed={selectedType === 'special'}
            title="Sonderurlaub / Frei / Schichtfrei eintragen (Tastenkürzel: S oder 3)"
            className={`h-8 px-2.5 ${selectedType === 'special' ? 'bg-cyan-600 hover:bg-cyan-700 text-white border-transparent' : ''}`}
          >
            Sonderurlaub <span className="hidden sm:inline text-[11px] opacity-80">(S)</span>
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'note' ? 'default' : 'outline'}
            onClick={() => onTypeChange('note')}
            aria-pressed={selectedType === 'note'}
            title="Notiz eintragen (Tastenkürzel: N oder 4)"
            className={`h-8 px-2.5 ${selectedType === 'note' ? 'bg-slate-500 hover:bg-slate-600 text-white dark:bg-slate-600 dark:hover:bg-slate-500 border-transparent' : ''}`}
          >
            Notiz <span className="hidden sm:inline text-[11px] opacity-80">(N)</span>
          </Button>
        </div>

        <div className="hidden h-5 w-px bg-border md:block" />

        {/* Actions */}
        <TooltipProvider delayDuration={0}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={onUndo} disabled={!canUndo} aria-label="Rückgängig" title="Letzte Änderung rückgängig machen (Strg+Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="default" onClick={onOpenSuggestions} className="h-8 gap-1.5 px-2.5">
              <Sparkles className="h-3.5 w-3.5" />
              Planen
            </Button>
            {onOpenShare && (
              <Button size="sm" variant="outline" onClick={onOpenShare} className="h-8 gap-1.5 px-2.5">
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Teilen</span>
                {activeOverlaysCount > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {activeOverlaysCount}
                  </Badge>
                )}
              </Button>
            )}
            {onOpenSubscribe && (
              <Button size="sm" variant="outline" onClick={onOpenSubscribe} className="h-8 gap-1.5 px-2.5" title="Mit Google Kalender, Apple oder Outlook verbinden">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Kalender-Abo</span>
              </Button>
            )}
            {onPrintRequestSheet && (
              <Button
                size="sm"
                variant="outline"
                onClick={onPrintRequestSheet}
                className="h-8 gap-1.5 px-2.5 font-medium"
                title="Urlaubsantrag (A4) konfigurieren, digital signieren & drucken"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Urlaubsantrag (A4)</span>
              </Button>
            )}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Weitere Aktionen">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Weitergeben & Kopieren
                </div>
                <DropdownMenuItem onClick={onOpenClipboardExport}>
                  <Clipboard className="h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span>Text kopieren / Vorlagen…</span>
                    <span className="text-[11px] text-muted-foreground">Mit Vorschau & Filter (E-Mail, Chat, Tabelle)</span>
                  </div>
                </DropdownMenuItem>
                {onOpenShare && (
                  <DropdownMenuItem onClick={onOpenShare}>
                    <Share2 className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span>Urlaub teilen & einblenden…</span>
                      <span className="text-[11px] text-muted-foreground">Link für Partner, Team oder Mitbearbeitung</span>
                    </div>
                  </DropdownMenuItem>
                )}
                {onOpenSubscribe && (
                  <DropdownMenuItem onClick={onOpenSubscribe}>
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span>Kalender abonnieren…</span>
                      <span className="text-[11px] text-muted-foreground">Google Kalender, Apple & Outlook</span>
                    </div>
                  </DropdownMenuItem>
                )}
                {onOpenScorecard && (
                  <DropdownMenuItem onClick={onOpenScorecard}>
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <div className="flex flex-col">
                      <span>Urlaubs-Score teilen (Story-Bild)…</span>
                      <span className="text-[11px] text-muted-foreground">X Tage Urlaub → Y Tage frei als Grafik</span>
                    </div>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onPrintCalendar ?? handlePrint}>
                  <Printer className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Jahreskalender drucken / PDF (A4)</span>
                    <span className="text-[11px] text-muted-foreground">Alle 12 Monate + Urlaubsblöcke auf 1 Seite</span>
                  </div>
                </DropdownMenuItem>
                {onPrintRequestSheet && (
                  <DropdownMenuItem onClick={onPrintRequestSheet}>
                    <FileText className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span>Urlaubsantrag für Vorgesetzte (A4)…</span>
                      <span className="text-[11px] text-muted-foreground">Formblatt mit KW, Netto-Tagen &amp; Unterschrift</span>
                    </div>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Datei-Export ({year})
                </div>
                <DropdownMenuItem onClick={handleExportCSV}>
                  <Download className="h-4 w-4" />
                  <span>CSV-Tabelle (Excel)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportICS}>
                  <CalendarDays className="h-4 w-4" />
                  <span>ICS-Kalenderdatei (.ics)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJSON}>
                  <FileJson className="h-4 w-4" />
                  <span>Komplett-Backup (.json)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportConfig}>
                  <Settings2 className="h-4 w-4" />
                  <span>Einstellungen exportieren</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Datei-Import
                </div>
                <DropdownMenuItem onClick={handleImportClick}>
                  <Upload className="h-4 w-4" />
                  <span>Planung importieren (.json)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleConfigImportClick}>
                  <Settings2 className="h-4 w-4" />
                  <span>Einstellungen importieren (.json)</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleReset} className="text-red-500 focus:text-red-600">
                  <Trash2 className="h-4 w-4" />
                  <span>Planung zurücksetzen</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <input ref={configInputRef} type="file" accept=".json" className="hidden" onChange={handleConfigImportFile} />
        </TooltipProvider>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4 md:ml-auto md:flex md:flex-wrap md:items-center md:gap-2.5">
          <label className="flex min-h-9 md:min-h-0 cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5">
            <Switch checked={showHeatmap} onCheckedChange={onToggleHeatmap} />
            <span className="min-w-0 truncate text-muted-foreground">Heatmap</span>
          </label>
          <label className="flex min-h-9 md:min-h-0 cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5">
            <Switch checked={showPublicHolidays} onCheckedChange={onTogglePublicHolidays} />
            <span className="min-w-0 truncate text-muted-foreground">Feiertage</span>
          </label>
          <label className="flex min-h-9 md:min-h-0 cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5">
            <Switch checked={showSchoolHolidays} onCheckedChange={onToggleSchoolHolidays} />
            <span className="min-w-0 truncate text-muted-foreground">Schulferien</span>
          </label>
          <label className="flex min-h-9 md:min-h-0 cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5">
            <Switch checked={showBridgeDays} onCheckedChange={onToggleBridgeDays} />
            <span className="min-w-0 truncate text-muted-foreground">Brückentage</span>
          </label>
        </div>
      </div>

      {/* Prominent Stats & Vacation Budget Progress Bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-2 text-xs">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">Urlaubsbudget:</span>
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-24 sm:w-36 overflow-hidden rounded-full bg-muted border border-border/60"
              role="progressbar"
              aria-valuenow={Math.round(vacationDaysUsed)}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, Math.round(vacationDaysTotal))}
              aria-label="Verplantes Urlaubsbudget"
            >
              <div
                className={`h-full transition-all ${
                  remaining < 0
                    ? 'bg-red-500'
                    : remaining <= 3
                      ? 'bg-emerald-500'
                      : 'bg-blue-600'
                }`}
                style={{
                  width: `${
                    vacationDaysTotal > 0
                      ? Math.min(100, Math.max(0, Math.round((vacationDaysUsed / vacationDaysTotal) * 100)))
                      : 0
                  }%`,
                }}
              />
            </div>
            <Badge
              variant={remaining < 0 ? 'destructive' : 'default'}
              className="px-1.5 py-0 text-[11px] bg-blue-600 hover:bg-blue-600 text-white"
            >
              {formatDays(vacationDaysUsed)} / {formatDays(vacationDaysTotal)} verplant
            </Badge>
            <Badge
              variant={remaining < 0 ? 'destructive' : 'secondary'}
              className={`px-1.5 py-0 text-[11px] font-semibold ${
                remaining >= 0
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                  : ''
              }`}
            >
              {remaining >= 0 ? `${formatDays(remaining)} noch frei` : `${formatDays(Math.abs(remaining))} über Budget`}
            </Badge>
          </div>
          {workDaysLabel && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
              {workDaysLabel}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{flex.unit === 'hours' ? 'Gleitstunden:' : 'Gleittage:'}</span>
          <Badge variant={flex.total !== undefined && flex.used > flex.total ? 'destructive' : 'secondary'} className="px-1.5 py-0 text-[11px]">
            {formatDays(flex.used)}{flex.total !== undefined && `/${formatDays(flex.total)}`}{flex.unit === 'hours' && ' h'}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Verbleibende Arbeitstage:</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">{remainingWorkDays}</Badge>
        </div>

        {/* Partner / Shared Plan Remaining Vacation Claim directly in the Year View stats bar */}
        {sharedPlanSummaries.map(sp => (
          <div key={sp.id} className="flex items-center gap-1.5 border-l border-border/70 pl-3">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: sp.color }}
              aria-hidden="true"
            />
            {sp.isLive && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"
                title="Echtzeit-Synchronisierung aktiv"
                aria-hidden="true"
              />
            )}
            <span className="font-medium truncate max-w-36">{sp.label}:</span>
            <Badge
              variant={sp.remaining < 0 ? 'destructive' : 'outline'}
              className="px-1.5 py-0 text-[11px]"
              style={{ borderColor: `${sp.color}66` }}
            >
              {formatDays(sp.used)}/{formatDays(sp.total)}
            </Badge>
            <span className="text-muted-foreground">({formatDays(sp.remaining)} übrig)</span>
            {sp.workDaysLabel && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                {sp.workDaysLabel}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
