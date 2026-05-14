'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Sparkles, Download, Upload, Printer, Settings2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { EntryType, VacationEntry, LocalConfig } from '@/types'
import {
  exportToCSV, exportToClipboardText, downloadFile,
  exportToJSON, exportToICS, parseImportFile,
  exportConfigJSON, parseConfigJSON,
} from '@/lib/export'

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
  gleittageCount: number
  remainingWorkDays: number
  entries: VacationEntry[]
  preferences: Record<string, unknown>
  localConfig?: LocalConfig | null
  onOpenSuggestions: () => void
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
  gleittageCount, remainingWorkDays,
  entries, preferences, localConfig,
  onOpenSuggestions, onImport, onImportConfig, onReset,
}: ToolbarProps) {
  const remaining = vacationDaysTotal - vacationDaysUsed
  const fileInputRef = useRef<HTMLInputElement>(null)
  const configInputRef = useRef<HTMLInputElement>(null)

  const handleExportCSV = () => {
    downloadFile(exportToCSV(entries), `urlaubsplaner-${year}.csv`)
  }

  const handleExportClipboard = async () => {
    await navigator.clipboard.writeText(exportToClipboardText(entries))
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
    if (confirm('Möchtest du wirklich alle Planungen löschen?')) onReset()
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
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      {/* Year Navigation */}
      <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 md:flex md:w-auto">
        <Button variant="ghost" size="icon" onClick={() => onYearChange(year - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-center text-xl font-bold md:w-16">{year}</span>
        <Button variant="ghost" size="icon" onClick={() => onYearChange(year + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Entry Type Selector */}
      <div className="grid grid-cols-3 gap-1 md:flex">
        <Button size="sm" variant={selectedType === 'vacation' ? 'default' : 'outline'}
          onClick={() => onTypeChange('vacation')}
          className={selectedType === 'vacation' ? 'bg-blue-500 hover:bg-blue-600' : ''}>
          Urlaub
        </Button>
        <Button size="sm" variant={selectedType === 'gleittag' ? 'default' : 'outline'}
          onClick={() => onTypeChange('gleittag')}
          className={selectedType === 'gleittag' ? 'bg-purple-500 hover:bg-purple-600' : ''}>
          Gleittag
        </Button>
        <Button size="sm" variant={selectedType === 'note' ? 'default' : 'outline'}
          onClick={() => onTypeChange('note')}>
          Notiz
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
        <div className="grid grid-cols-[1fr_2.75rem] gap-2 md:hidden">
          <Button size="sm" variant="outline" onClick={onOpenSuggestions}>
            <Sparkles className="h-4 w-4" />
            Planen
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Weitere Aktionen">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <Download className="h-4 w-4" />
                CSV Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportClipboard}>
                <span className="w-4 text-center">📋</span>
                In Zwischenablage
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON}>
                <span className="w-4 text-center">{'{}'}</span>
                JSON Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportICS}>
                <span className="w-4 text-center">📅</span>
                ICS Kalender Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportConfig}>
                <Settings2 className="h-4 w-4" />
                Konfiguration exportieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Drucken / PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImportClick}>
                <Upload className="h-4 w-4" />
                Daten importieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleConfigImportClick}>
                <span className="w-4 text-center">⚙️</span>
                Konfiguration importieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReset} className="text-red-500 focus:text-red-600">
                <span className="w-4 text-center">🗑️</span>
                Planung zurücksetzen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="hidden items-center gap-1 md:flex">
          <Button size="sm" variant="outline" onClick={onOpenSuggestions}>
            <Sparkles className="h-4 w-4" />
            Planen
          </Button>
          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
          </Button></TooltipTrigger><TooltipContent>CSV Export</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleExportClipboard}>
            📋
          </Button></TooltipTrigger><TooltipContent>In Zwischenablage</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleExportJSON}>
            {'{}'}
          </Button></TooltipTrigger><TooltipContent>JSON Export</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleExportICS}>
            📅
          </Button></TooltipTrigger><TooltipContent>ICS Kalender Export</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleExportConfig}>
            <Settings2 className="h-4 w-4" />
          </Button></TooltipTrigger><TooltipContent>Konfiguration exportieren</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
          </Button></TooltipTrigger><TooltipContent>Drucken / PDF</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleImportClick}>
            <Upload className="h-4 w-4" />
          </Button></TooltipTrigger><TooltipContent>Daten importieren</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleConfigImportClick}>
            ⚙️
          </Button></TooltipTrigger><TooltipContent>Konfiguration importieren</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleReset} className="text-red-500 hover:text-red-600">
            🗑️
          </Button></TooltipTrigger><TooltipContent>Planung zurücksetzen</TooltipContent></Tooltip>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        <input ref={configInputRef} type="file" accept=".json" className="hidden" onChange={handleConfigImportFile} />

      </TooltipProvider>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-muted-foreground">Urlaub:</span>
          <Badge variant={remaining < 5 ? 'destructive' : 'default'}>
            {vacationDaysUsed}/{vacationDaysTotal}
          </Badge>
          <span className="text-xs text-muted-foreground">({remaining} übrig)</span>
        </div>
        {gleittageCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Gleittage:</span>
            <Badge variant="secondary">{gleittageCount}</Badge>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Arbeitstage:</span>
          <Badge variant="secondary">{remainingWorkDays}</Badge>
        </div>
      </div>
    </div>
  )
}
