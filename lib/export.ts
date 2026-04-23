import type { VacationEntry } from '@/types'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

const TYPE_LABELS: Record<string, string> = {
  vacation: 'Urlaub',
  gleittag: 'Gleittag',
  note: 'Notiz',
}

export function exportToCSV(entries: VacationEntry[]): string {
  const header = 'Datum;Typ;Titel'
  const rows = entries
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const dateStr = format(parseISO(e.date), 'dd.MM.yyyy', { locale: de })
      const type = TYPE_LABELS[e.type] ?? e.type
      const title = e.title ?? ''
      return `${dateStr};${type};${title}`
    })
  return [header, ...rows].join('\n')
}

export function exportToClipboardText(entries: VacationEntry[]): string {
  return entries
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const dateStr = format(parseISO(e.date), 'dd.MM.yyyy (EEEE)', { locale: de })
      const type = TYPE_LABELS[e.type] ?? e.type
      const title = e.title ? ` — ${e.title}` : ''
      return `${dateStr}: ${type}${title}`
    })
    .join('\n')
}

export function downloadFile(content: string, filename: string, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportToJSON(entries: VacationEntry[], preferences: Record<string, unknown>): string {
  return JSON.stringify({
    vacations: entries.map(e => ({ date: e.date.split('T')[0], type: e.type, title: e.title })),
    preferences,
  }, null, 2)
}

export interface ImportData {
  vacations: Array<{ date: string; type: string; title?: string }>
  preferences?: Record<string, unknown>
}

export function parseImportFile(content: string): ImportData | null {
  try {
    const data = JSON.parse(content)
    if (!data.vacations || !Array.isArray(data.vacations)) return null
    return data as ImportData
  } catch {
    return null
  }
}
