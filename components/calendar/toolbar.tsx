'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Sparkles, Download, Upload, Printer, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card">
      {/* Year Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onYearChange(year - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xl font-bold w-16 text-center">{year}</span>
        <Button variant="ghost" size="icon" onClick={() => onYearChange(year + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Entry Type Selector */}
      <div className="flex gap-1">
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
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch checked={showHeatmap} onCheckedChange={onToggleHeatmap} />
          <span className="text-muted-foreground">Heatmap</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch checked={showPublicHolidays} onCheckedChange={onTogglePublicHolidays} />
          <span className="text-muted-foreground">Feiertage</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch checked={showSchoolHolidays} onCheckedChange={onToggleSchoolHolidays} />
          <span className="text-muted-foreground">Schulferien</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch checked={showBridgeDays} onCheckedChange={onToggleBridgeDays} />
          <span className="text-muted-foreground">Brückentage</span>
        </label>
      </div>

      {/* Actions */}
      <TooltipProvider delayDuration={0}>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={onOpenSuggestions}>
          <Sparkles className="h-4 w-4 mr-1" />
          Planen
        </Button>
        <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleExportCSV}>
          <Download className="h-4 w-4" />
        </Button></TooltipTrigger><TooltipContent>CSV Export</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleExportClipboard}>
          \ud83d\udccb
        </Button></TooltipTrigger><TooltipContent>In Zwischenablage</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleExportJSON}>
          {'\u007b\u007d'}
        </Button></TooltipTrigger><TooltipContent>JSON Export</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleExportICS}>
          \ud83d\udcc5
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
          \u2699\ufe0f
        </Button></TooltipTrigger><TooltipContent>Konfiguration importieren</TooltipContent></Tooltip>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        <input ref={configInputRef} type="file" accept=".json" className="hidden" onChange={handleConfigImportFile} />
        <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" onClick={handleReset} className="text-red-500 hover:text-red-600">
          \ud83d\uddd1\ufe0f
        </Button></TooltipTrigger><TooltipContent>Planung zurücksetzen</TooltipContent></Tooltip>
      </div>

      </TooltipProvider>

      {/* Stats */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
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
