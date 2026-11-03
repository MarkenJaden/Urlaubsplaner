'use client'

import { useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Sparkles, Download, Upload, Printer,
  Settings2, MoreHorizontal, Clipboard, FileJson, CalendarDays,
  Trash2, Undo2, Share2,
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
  flex: FlexSummary
  remainingWorkDays: number
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
  vacationDaysUsed, vacationDaysTotal,
  flex, remainingWorkDays, canUndo, onUndo,
  entries, preferences, localConfig,
  activeOverlaysCount = 0,
  onOpenSuggestions, onOpenClipboardExport, onOpenShare, onOpenSubscribe,
  onImport, onImportConfig, onReset,
}: ToolbarProps) {
  const remaining = vacationDaysTotal - vacationDaysUsed
  const fileInputRef = useRef<HTMLInputElement>(null)
  const configInputRef = useRef<HTMLInputElement>(null)

  const handleExportCSV = () => {
    downloadFile(exportToCSV(entries), `urlaubsplaner-${year}.csv`)
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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:flex-row md:flex-wrap md:items-center md:justify-between">
      {/* Year Navigation */}
      <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 md:flex md:w-auto">
        <Button variant="ghost" size="icon" onClick={() => onYearChange(year - 1)} aria-label="Vorheriges Jahr">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-center text-xl font-bold md:w-16">{year}</span>
        <Button variant="ghost" size="icon" onClick={() => onYearChange(year + 1)} aria-label="Nächstes Jahr">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Entry Type Selector with Hotkey Hints */}
      <div className="grid grid-cols-3 gap-1 md:flex" role="group" aria-label="Eintragstyp auswählen">
        <Button
          size="sm"
          variant={selectedType === 'vacation' ? 'default' : 'outline'}
          onClick={() => onTypeChange('vacation')}
          aria-pressed={selectedType === 'vacation'}
          title="Urlaub eintragen (Tastenkürzel: U)"
          className={selectedType === 'vacation' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
        >
          Urlaub <span className="hidden sm:inline text-[11px] opacity-80">(U)</span>
        </Button>
        <Button
          size="sm"
          variant={selectedType === 'gleittag' ? 'default' : 'outline'}
          onClick={() => onTypeChange('gleittag')}
          aria-pressed={selectedType === 'gleittag'}
          title="Gleittag eintragen (Tastenkürzel: G)"
          className={selectedType === 'gleittag' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
        >
          Gleittag <span className="hidden sm:inline text-[11px] opacity-80">(G)</span>
        </Button>
        <Button
          size="sm"
          variant={selectedType === 'note' ? 'default' : 'outline'}
          onClick={() => onTypeChange('note')}
          aria-pressed={selectedType === 'note'}
          title="Notiz eintragen (Tastenkürzel: N)"
        >
          Notiz <span className="hidden sm:inline text-[11px] opacity-80">(N)</span>
        </Button>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 md:flex md:flex-wrap md:items-center md:gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1">
          <Switch checked={showHeatmap} onCheckedChange={onToggleHeatmap} />
          <span className="min-w-0 truncate text-muted-foreground">Heatmap</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1">
          <Switch checked={showPublicHolidays} onCheckedChange={onTogglePublicHolidays} />
          <span className="min-w-0 truncate text-muted-foreground">Feiertage</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1">
          <Switch checked={showSchoolHolidays} onCheckedChange={onToggleSchoolHolidays} />
          <span className="min-w-0 truncate text-muted-foreground">Schulferien</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1">
          <Switch checked={showBridgeDays} onCheckedChange={onToggleBridgeDays} />
          <span className="min-w-0 truncate text-muted-foreground">Brückentage</span>
        </label>
      </div>

      {/* Actions */}
      <TooltipProvider delayDuration={0}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="icon" variant="outline" onClick={onUndo} disabled={!canUndo} aria-label="Rückgängig" title="Letzte Änderung rückgängig machen (Strg+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="default" onClick={onOpenSuggestions} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Planen
          </Button>
          {onOpenShare && (
            <Button size="sm" variant="outline" onClick={onOpenShare} className="gap-1.5">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Teilen</span>
              {activeOverlaysCount > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {activeOverlaysCount}
                </Badge>
              )}
            </Button>
          )}
          {onOpenSubscribe && (
            <Button size="sm" variant="outline" onClick={onOpenSubscribe} className="gap-1.5" title="Mit Google Kalender, Apple oder Outlook verbinden">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden lg:inline">Kalender-Abo</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Weitere Aktionen">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
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
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                <span>Drucken / Als PDF speichern</span>
              </DropdownMenuItem>

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

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm md:basis-full">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-muted-foreground">Urlaub:</span>
          <Badge variant={remaining < 0 ? 'destructive' : remaining < 5 ? 'secondary' : 'default'}>
            {formatDays(vacationDaysUsed)}/{formatDays(vacationDaysTotal)}
          </Badge>
          <span className="text-xs text-muted-foreground">({formatDays(remaining)} übrig)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{flex.unit === 'hours' ? 'Gleitstunden:' : 'Gleittage:'}</span>
          <Badge variant={flex.total !== undefined && flex.used > flex.total ? 'destructive' : 'secondary'}>
            {formatDays(flex.used)}{flex.total !== undefined && `/${formatDays(flex.total)}`}{flex.unit === 'hours' && ' h'}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Verbleibende Arbeitstage:</span>
          <Badge variant="secondary">{remainingWorkDays}</Badge>
        </div>
      </div>
    </div>
  )
}
