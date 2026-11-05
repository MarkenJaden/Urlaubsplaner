import type { VacationEntry, EntryType } from '@/types'
import { format, parseISO, getISOWeek, differenceInCalendarDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { createCalendar } from './calendar'
import { formatDays, isOffDayKey } from './vacation-accounting'

const TYPE_LABELS: Record<string, string> = {
  vacation: 'Urlaub',
  gleittag: 'Gleittag',
  note: 'Notiz',
}

export function isNonWorkingGap(startDateKey: string, endDateKey: string, workDays?: number[]): boolean {
  const gap = differenceInCalendarDays(parseISO(endDateKey), parseISO(startDateKey))
  if (gap <= 1) return true
  if (gap > 4) return false
  for (let i = 1; i < gap; i++) {
    const d = new Date(`${startDateKey}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    if (!isOffDayKey(key, workDays)) {
      return false
    }
  }
  return true
}

export function exportToCSV(
  entries: VacationEntry[],
  options?: { onlyWorkdays?: boolean; workDays?: number[] }
): string {
  const header = 'Datum;Typ;Titel'
  const filtered = options?.onlyWorkdays
    ? entries.filter(e => e.type === 'note' || !isOffDayKey(e.date.slice(0, 10), options.workDays))
    : entries
  const rows = [...filtered]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const dateStr = format(parseISO(e.date.slice(0, 10)), 'dd.MM.yyyy', { locale: de })
      const type = TYPE_LABELS[e.type] ?? e.type
      const title = e.title ?? ''
      return `${dateStr};${type};${title}`
    })
  return [header, ...rows].join('\n')
}

export function exportToClipboardText(
  entries: VacationEntry[],
  options?: { onlyWorkdays?: boolean; workDays?: number[] }
): string {
  const filtered = options?.onlyWorkdays
    ? entries.filter(e => e.type === 'note' || !isOffDayKey(e.date.slice(0, 10), options.workDays))
    : entries
  return [...filtered]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const dateStr = format(parseISO(e.date.slice(0, 10)), 'dd.MM.yyyy (EEEE)', { locale: de })
      const type = TYPE_LABELS[e.type] ?? e.type
      const title = e.title ? ` — ${e.title}` : ''
      return `${dateStr}: ${type}${title}`
    })
    .join('\n')
}

export type ClipboardFormat =
  | 'compact_periods'
  | 'single_days'
  | 'email_boss'
  | 'markdown_table'
  | 'chat_short'
  | 'excel_tsv'

export interface ClipboardExportOptions {
  format: ClipboardFormat
  includeVacations: boolean
  includeGleittage: boolean
  includeNotes: boolean
  includeTitles: boolean
  includeWeekNumbers: boolean
  includeWeekdays: boolean
  includeSummary: boolean
  onlyFuture: boolean
  onlyWorkdays?: boolean
  workDays?: number[]
  year?: number
  vacationDaysUsed?: number
  vacationDaysTotal?: number
  recipientName?: string
  senderName?: string
}

export interface GroupedEntryBlock {
  type: EntryType
  startDate: string
  endDate: string
  daysCount: number
  dates: string[]
  titles: string[]
}

export function groupEntriesIntoBlocks(
  entries: VacationEntry[],
  options?: { workDays?: number[] }
): GroupedEntryBlock[] {
  const sorted = [...entries].sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) || a.type.localeCompare(b.type))
  const blocks: GroupedEntryBlock[] = []

  for (const entry of sorted) {
    const dKey = entry.date.slice(0, 10)
    const last = blocks.at(-1)
    if (last && last.type === entry.type) {
      const gap = differenceInCalendarDays(parseISO(dKey), parseISO(last.endDate))
      const canMerge =
        entry.type === 'vacation' || entry.type === 'gleittag'
          ? isNonWorkingGap(last.endDate, dKey, options?.workDays)
          : gap <= 1
      if (gap >= 0 && canMerge) {
        if (gap > 0) {
          last.endDate = dKey
          last.daysCount += 1
          last.dates.push(dKey)
        }
        if (entry.title && !last.titles.includes(entry.title)) {
          last.titles.push(entry.title)
        }
        continue
      }
    }
    blocks.push({
      type: entry.type,
      startDate: dKey,
      endDate: dKey,
      daysCount: 1,
      dates: [dKey],
      titles: entry.title ? [entry.title] : [],
    })
  }
  return blocks
}

function formatWeekSpan(startDate: string, endDate: string): string {
  const w1 = getISOWeek(parseISO(startDate))
  const w2 = getISOWeek(parseISO(endDate))
  return w1 === w2 ? `KW ${w1}` : `KW ${w1}–${w2}`
}

export function formatCustomClipboardExport(
  entries: VacationEntry[],
  options: ClipboardExportOptions,
): string {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const onlyWorkdays = options.onlyWorkdays ?? true
  const filtered = [...entries]
    .filter(e => {
      if (e.type === 'vacation' && !options.includeVacations) return false
      if (e.type === 'gleittag' && !options.includeGleittage) return false
      if (e.type === 'note' && !options.includeNotes) return false
      if (options.onlyFuture && e.date.slice(0, 10) < todayStr) return false
      if (onlyWorkdays && (e.type === 'vacation' || e.type === 'gleittag') && isOffDayKey(e.date.slice(0, 10), options.workDays)) {
        return false
      }
      return true
    })
    .sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)))

  if (filtered.length === 0) {
    return 'Keine Einträge für die gewählten Filter vorhanden.'
  }

  const fmtDate = (dKey: string) => {
    const d = parseISO(dKey)
    return options.includeWeekdays
      ? format(d, 'dd.MM.yyyy (EE)', { locale: de })
      : format(d, 'dd.MM.yyyy', { locale: de })
  }

  const summaryLine =
    options.includeSummary && options.vacationDaysUsed !== undefined && options.vacationDaysTotal !== undefined
      ? `Gesamt ${options.year ?? ''}: ${formatDays(options.vacationDaysUsed)} von ${formatDays(options.vacationDaysTotal)} Urlaubstagen verplant (${formatDays(options.vacationDaysTotal - options.vacationDaysUsed)} übrig).`.replace('  ', ' ')
      : ''

  if (options.format === 'single_days') {
    const lines = filtered.map(e => {
      const dKey = e.date.slice(0, 10)
      const d = parseISO(dKey)
      const dateStr = options.includeWeekdays
        ? format(d, 'dd.MM.yyyy (EEEE)', { locale: de })
        : format(d, 'dd.MM.yyyy', { locale: de })
      const kw = options.includeWeekNumbers ? ` · KW ${getISOWeek(d)}` : ''
      const type = TYPE_LABELS[e.type] ?? e.type
      const title = options.includeTitles && e.title ? ` — ${e.title}` : ''
      return `${dateStr}${kw}: ${type}${title}`
    })
    if (summaryLine) lines.push('', summaryLine)
    return lines.join('\n')
  }

  const blocks = groupEntriesIntoBlocks(filtered, { workDays: options.workDays })

  if (options.format === 'excel_tsv') {
    const dayHeader = onlyWorkdays ? 'Arbeitstage' : 'Tage'
    const header = ['Von', 'Bis', 'Typ', dayHeader, ...(options.includeWeekNumbers ? ['KW'] : []), ...(options.includeTitles ? ['Notiz / Hinweis'] : [])].join('\t')
    const rows = blocks.map(b => {
      const start = format(parseISO(b.startDate), 'dd.MM.yyyy', { locale: de })
      const end = format(parseISO(b.endDate), 'dd.MM.yyyy', { locale: de })
      const type = TYPE_LABELS[b.type] ?? b.type
      const cols = [start, end, type, String(b.daysCount)]
      if (options.includeWeekNumbers) cols.push(formatWeekSpan(b.startDate, b.endDate))
      if (options.includeTitles) cols.push(b.titles.join(', '))
      return cols.join('\t')
    })
    return [header, ...rows].join('\n')
  }

  if (options.format === 'markdown_table') {
    const dayHeader = onlyWorkdays ? 'Arbeitstage' : 'Tage'
    const headers = ['Zeitraum', 'Typ', dayHeader, ...(options.includeWeekNumbers ? ['KW'] : []), ...(options.includeTitles ? ['Hinweis'] : [])]
    const sep = headers.map(() => '---')
    const rows = blocks.map(b => {
      const span = b.startDate === b.endDate ? fmtDate(b.startDate) : `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}`
      const type = TYPE_LABELS[b.type] ?? b.type
      const cols = [span, type, String(b.daysCount)]
      if (options.includeWeekNumbers) cols.push(formatWeekSpan(b.startDate, b.endDate))
      if (options.includeTitles) cols.push(b.titles.join(', ') || '—')
      return `| ${cols.join(' | ')} |`
    })
    const out = [`| ${headers.join(' | ')} |`, `| ${sep.join(' | ')} |`, ...rows]
    if (summaryLine) out.push('', `> ${summaryLine}`)
    return out.join('\n')
  }

  const blockLines = blocks.map(b => {
    const span = b.startDate === b.endDate ? fmtDate(b.startDate) : `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}`
    const kw = options.includeWeekNumbers ? ` (${formatWeekSpan(b.startDate, b.endDate)})` : ''
    const type = TYPE_LABELS[b.type] ?? b.type
    const dayLabel = onlyWorkdays ? (b.daysCount === 1 ? 'Arbeitstag' : 'Arbeitstage') : (b.daysCount === 1 ? 'Tag' : 'Tage')
    const count = b.type === 'note' ? '' : ` · ${b.daysCount} ${dayLabel}`
    const title = options.includeTitles && b.titles.length > 0 ? ` — ${b.titles.join(', ')}` : ''
    const icon = options.format === 'chat_short' ? (b.type === 'vacation' ? '🌴 ' : b.type === 'gleittag' ? '⏰ ' : '📝 ') : '• '
    return `${icon}${span}${kw}: ${type}${count}${title}`
  })

  if (options.format === 'email_boss') {
    const greeting = options.recipientName?.trim() ? `Hallo ${options.recipientName.trim()},` : 'Hallo zusammen,'
    const signOff = options.senderName?.trim() ? `Viele Grüße\n${options.senderName.trim()}` : 'Viele Grüße'
    return [
      greeting,
      '',
      `hier ist meine Urlaubsplanung${options.year ? ` für ${options.year}` : ''}:`,
      '',
      ...blockLines,
      ...(summaryLine ? ['', summaryLine] : []),
      '',
      'Ich bitte um kurze Rückmeldung bzw. Freigabe. Vielen Dank!',
      '',
      signOff,
    ].join('\n')
  }

  if (options.format === 'chat_short') {
    const header = `📅 *Urlaubsplanung${options.year ? ` ${options.year}` : ''}*`
    return [header, ...blockLines, ...(summaryLine ? ['', summaryLine] : [])].join('\n')
  }

  // Default: compact_periods
  return [...blockLines, ...(summaryLine ? ['', summaryLine] : [])].join('\n')
}

export interface ShareSnapshotPayload {
  label: string
  color?: string
  country?: string
  subdivision?: string
  workDays?: number[]
  vacationDays?: number
  entries: Array<{ date: string; type: EntryType; title?: string }>
}

export function encodeSharePayload(payload: ShareSnapshotPayload): string {
  const compact = {
    l: payload.label.slice(0, 60),
    c: payload.color ?? '#10b981',
    co: payload.country,
    s: payload.subdivision,
    w: payload.workDays,
    vd: payload.vacationDays,
    e: payload.entries.map(item => [
      item.date.slice(0, 10),
      item.type === 'vacation' ? 'v' : item.type === 'gleittag' ? 'g' : 'n',
      ...(item.title ? [item.title.slice(0, 100)] : []),
    ]),
  }
  const json = JSON.stringify(compact)
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    const bytes = new TextEncoder().encode(json)
    let bin = ''
    bytes.forEach(b => { bin += String.fromCharCode(b) })
    return window.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  return Buffer.from(json, 'utf8').toString('base64url')
}

export function decodeSharePayload(encoded: string): ShareSnapshotPayload | null {
  try {
    let json = ''
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
      const bin = window.atob(base64)
      const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0))
      json = new TextDecoder().decode(bytes)
    } else {
      json = Buffer.from(encoded, 'base64url').toString('utf8')
    }
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.e)) return null
    const entries: Array<{ date: string; type: EntryType; title?: string }> = []
    for (const item of parsed.e) {
      if (!Array.isArray(item) || typeof item[0] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item[0])) continue
      const type: EntryType = item[1] === 'g' ? 'gleittag' : item[1] === 'n' ? 'note' : 'vacation'
      entries.push({ date: item[0], type, ...(typeof item[2] === 'string' && item[2] ? { title: item[2] } : {}) })
    }
    const workDays = Array.isArray(parsed.w)
      ? parsed.w.filter((d: unknown): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6)
      : undefined
    return {
      label: typeof parsed.l === 'string' && parsed.l.trim() ? parsed.l.trim() : 'Geteilter Plan',
      color: typeof parsed.c === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.c) ? parsed.c : '#10b981',
      country: typeof parsed.co === 'string' ? parsed.co : undefined,
      subdivision: typeof parsed.s === 'string' ? parsed.s : undefined,
      ...(workDays && workDays.length > 0 ? { workDays } : {}),
      ...(typeof parsed.vd === 'number' && parsed.vd >= 0 && parsed.vd <= 366 ? { vacationDays: parsed.vd } : {}),
      entries,
    }
  } catch {
    return null
  }
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

export function exportToICS(entries: VacationEntry[]): string {
  return createCalendar(entries)
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

export function exportConfigJSON(config: Record<string, unknown>): string {
  return JSON.stringify(config, null, 2)
}

export function parseConfigJSON(content: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(content)
    if (typeof data !== 'object' || data === null) return null
    return data as Record<string, unknown>
  } catch {
    return null
  }
}
