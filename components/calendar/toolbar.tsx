'use client'

import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { EntryType, UserPreferences } from '@/types'

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
  vacationDaysUsed: number
  vacationDaysTotal: number
  onOpenSuggestions: () => void
}

export function Toolbar({
  year,
  onYearChange,
  selectedType,
  onTypeChange,
  showHeatmap,
  onToggleHeatmap,
  showPublicHolidays,
  onTogglePublicHolidays,
  showSchoolHolidays,
  onToggleSchoolHolidays,
  vacationDaysUsed,
  vacationDaysTotal,
  onOpenSuggestions,
}: ToolbarProps) {
  const remaining = vacationDaysTotal - vacationDaysUsed

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
        <Button
          size="sm"
          variant={selectedType === 'vacation' ? 'default' : 'outline'}
          onClick={() => onTypeChange('vacation')}
          className={selectedType === 'vacation' ? 'bg-blue-500 hover:bg-blue-600' : ''}
        >
          Urlaub
        </Button>
        <Button
          size="sm"
          variant={selectedType === 'gleittag' ? 'default' : 'outline'}
          onClick={() => onTypeChange('gleittag')}
          className={selectedType === 'gleittag' ? 'bg-purple-500 hover:bg-purple-600' : ''}
        >
          Gleittag
        </Button>
        <Button
          size="sm"
          variant={selectedType === 'note' ? 'default' : 'outline'}
          onClick={() => onTypeChange('note')}
        >
          Notiz
        </Button>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={showHeatmap} onCheckedChange={onToggleHeatmap} />
          <span className="text-muted-foreground">Heatmap</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={showPublicHolidays} onCheckedChange={onTogglePublicHolidays} />
          <span className="text-muted-foreground">Feiertage</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={showSchoolHolidays} onCheckedChange={onToggleSchoolHolidays} />
          <span className="text-muted-foreground">Schulferien</span>
        </label>
      </div>

      {/* Suggestions */}
      <Button size="sm" variant="outline" onClick={onOpenSuggestions}>
        <Sparkles className="h-4 w-4 mr-1" />
        Urlaub planen
      </Button>

      {/* Vacation Counter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Urlaubstage:</span>
        <Badge variant={remaining < 5 ? 'destructive' : 'default'}>
          {vacationDaysUsed} / {vacationDaysTotal}
        </Badge>
        {remaining >= 0 && (
          <span className="text-xs text-muted-foreground">({remaining} übrig)</span>
        )}
      </div>
    </div>
  )
}
