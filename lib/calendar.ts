import type { Holiday, VacationEntry } from '@/types'
import { localizedName } from './holiday-regions'
import { isOffDayKey } from './vacation-accounting'

function escapeText(value: string): string {
  return value
    // RFC 5545 TEXT allows no control characters other than HTAB.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

function foldLine(value: string): string {
  const encoder = new TextEncoder()
  let result = '', bytes = 0
  for (const character of value) {
    const length = encoder.encode(character).length
    if (bytes + length > 75) { result += '\r\n '; bytes = 1 }
    result += character
    bytes += length
  }
  return result
}

function nextDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + 1)
  return day.toISOString().slice(0, 10)
}

function diffDays(startDateKey: string, endDateKey: string): number {
  const start = new Date(`${startDateKey}T00:00:00Z`)
  const end = new Date(`${endDateKey}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

function isNonWorkingCalendarGap(
  startDateKey: string,
  endDateKey: string,
  workDays?: number[],
  holidaySet?: Set<string>
): boolean {
  const gap = diffDays(startDateKey, endDateKey)
  if (gap <= 1) return gap >= 0
  if (gap > 4) return false
  for (let i = 1; i < gap; i++) {
    const d = new Date(`${startDateKey}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    if (!isOffDayKey(key, workDays) && !holidaySet?.has(key)) {
      return false
    }
  }
  return true
}

const MERGEABLE_ENTRY_TYPES = new Set(['vacation', 'gleittag', 'special', 'note'])

function latestTimestamp(a?: string, b?: string): string | undefined {
  if (!a) return b
  if (!b) return a
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  if (!Number.isFinite(ta)) return b
  if (!Number.isFinite(tb)) return a
  return tb > ta ? b : a
}

export function mergeContiguousCalendarEntries(
  entries: CalendarEntry[],
  options?: { workDays?: number[]; holidayDates?: Iterable<string> }
): CalendarEntry[] {
  const holidaySet = options?.holidayDates ? new Set(options.holidayDates) : undefined
  const mergeable: CalendarEntry[] = []
  const passthrough: CalendarEntry[] = []

  for (const entry of entries) {
    const dateKey = entry.date.split('T')[0]
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && Number.isFinite(new Date(`${dateKey}T00:00:00Z`).getTime())
    if (validDate && !entry.endDate && MERGEABLE_ENTRY_TYPES.has(entry.type)) {
      mergeable.push(entry)
    } else {
      passthrough.push(entry)
    }
  }

  mergeable.sort((a, b) =>
    a.type.localeCompare(b.type) ||
    a.date.split('T')[0].localeCompare(b.date.split('T')[0]) ||
    a.id.localeCompare(b.id)
  )

  const merged: CalendarEntry[] = []
  for (const entry of mergeable) {
    const dateKey = entry.date.split('T')[0]
    const normTitle = (entry.title ?? '').trim()
    const last = merged.at(-1)
    if (last && last.type === entry.type && (last.title ?? '').trim() === normTitle) {
      const lastEnd = last.endDate ?? last.date.split('T')[0]
      const gap = diffDays(lastEnd, dateKey)
      const canMerge =
        entry.type === 'note'
          ? (gap === 0 || (gap === 1 && normTitle !== ''))
          : isNonWorkingCalendarGap(lastEnd, dateKey, options?.workDays, holidaySet)
      if (gap >= 0 && canMerge) {
        if (gap > 0) {
          last.endDate = dateKey
        }
        const latestUpdated = latestTimestamp(last.updatedAt ?? last.createdAt, entry.updatedAt ?? entry.createdAt)
        if (latestUpdated) last.updatedAt = latestUpdated
        continue
      }
    }
    merged.push({
      ...entry,
      date: dateKey,
      endDate: dateKey,
    })
  }

  return [...merged, ...passthrough]
}

export type CalendarEntry = Omit<VacationEntry, 'type'> & {
  type: string
  /** Inclusive last day for multi-day events such as school holidays. */
  endDate?: string
  /** Optional prefix in SUMMARY, e.g. shared plan label. */
  summaryPrefix?: string
  /** Optional RFC 5545 CATEGORIES value. */
  category?: string
  /** Optional hex color (#RRGGBB) mapped to RFC 7986 COLOR on VEVENT. */
  color?: string
  /** Optional UID scope so shared events never collide with own events on the same date. */
  uidScope?: string
}

export interface CalendarOptions {
  name?: string
  /** Suggested refresh interval for subscriptions, e.g. PT6H. */
  refreshInterval?: string
  workDays?: number[]
  holidayDates?: Iterable<string>
  /** Optional hex color (#RRGGBB) for calendar-level color hints (Apple / RFC 7986). */
  color?: string | null
}

const CSS3_COLORS: Array<[string, number, number, number]> = [
  ['crimson', 220, 20, 60],
  ['red', 255, 0, 0],
  ['orangered', 255, 69, 0],
  ['darkorange', 255, 140, 0],
  ['gold', 255, 215, 0],
  ['yellowgreen', 154, 205, 50],
  ['mediumseagreen', 60, 179, 113],
  ['emerald', 16, 185, 129],
  ['teal', 0, 128, 128],
  ['darkturquoise', 0, 206, 209],
  ['dodgerblue', 30, 144, 255],
  ['royalblue', 65, 105, 225],
  ['indigo', 75, 0, 130],
  ['blueviolet', 138, 43, 226],
  ['mediumorchid', 186, 85, 211],
  ['deeppink', 255, 20, 147],
  ['hotpink', 255, 105, 180],
  ['slategray', 112, 128, 144],
]

/** Maps a #RRGGBB hex string to the nearest RFC 7986 CSS3 color name (avoiding non-standard 'emerald' if needed). */
function hexToCss3ColorName(hex?: string | null): string | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  let bestName = 'dodgerblue'
  let bestDist = Infinity
  for (const [name, cr, cg, cb] of CSS3_COLORS) {
    if (name === 'emerald') continue
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
    if (dist < bestDist) {
      bestDist = dist
      bestName = name
    }
  }
  return bestName
}

export function createCalendar(entries: CalendarEntry[], options: CalendarOptions | string = {}): string {
  const { name = 'Urlaubsplaner', refreshInterval, workDays, holidayDates, color } =
    typeof options === 'string' ? { name: options } : options
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Urlaubsplaner//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`]
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
    lines.push(`X-APPLE-CALENDAR-COLOR:${color.toUpperCase()}`)
    const cssColor = hexToCss3ColorName(color)
    if (cssColor) lines.push(`COLOR:${cssColor}`)
  }
  if (refreshInterval) lines.push(`REFRESH-INTERVAL;VALUE=DURATION:${refreshInterval}`, `X-PUBLISHED-TTL:${refreshInterval}`)
  const labels: Record<string, string> = { vacation: 'Urlaub', gleittag: 'Gleittag', special: 'Sonderurlaub / Frei', note: 'Notiz', public: 'Feiertag', school: 'Schulferien' }
  const normalizedEntries = mergeContiguousCalendarEntries(entries, { workDays, holidayDates })
  for (const entry of normalizedEntries.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id))) {
    const date = entry.date.split('T')[0]
    const start = new Date(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start.getTime())) continue
    const last = entry.endDate && entry.endDate > date ? entry.endDate : date
    const stamp = new Date(entry.updatedAt ?? entry.createdAt)
    const timestamp = (Number.isFinite(stamp.getTime()) ? stamp.toISOString() : `${date}T00:00:00.000Z`).replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const label = labels[entry.type] ?? entry.type
    const baseSummary = entry.title ? `${label}: ${entry.title}` : label
    const summary = entry.summaryPrefix ? `${entry.summaryPrefix}: ${baseSummary}` : baseSummary
    const uidSuffix = entry.uidScope
      ? encodeURIComponent(entry.uidScope)
      : `${encodeURIComponent(entry.type)}${['vacation', 'gleittag', 'special', 'note'].includes(entry.type) ? '' : `-${encodeURIComponent(entry.id)}`}`
    const eventColor = hexToCss3ColorName(entry.color)
    lines.push('BEGIN:VEVENT',
      `UID:${encodeURIComponent(entry.userId)}-${date}-${uidSuffix}@urlaubsplaner`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`,
      // DTEND is exclusive for all-day events: the day after the last day.
      `DTEND;VALUE=DATE:${nextDay(last).replace(/-/g, '')}`,
      `SUMMARY:${escapeText(summary)}`,
      ...(entry.title ? [`DESCRIPTION:${escapeText(entry.title)}`] : []),
      ...(entry.category ? [`CATEGORIES:${escapeText(entry.category)}`] : []),
      ...(eventColor ? [`COLOR:${eventColor}`] : []),
      'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export function sharedOverlayEvents(
  userId: string,
  overlay: {
    id: string
    label: string
    color?: string
    workDays?: number[]
    entries: Array<{ date: string; type: string; title?: string | null }>
  },
  options?: { holidayDates?: Iterable<string> }
): CalendarEntry[] {
  const raw: CalendarEntry[] = overlay.entries.map((item, idx) => {
    const dateKey = item.date.slice(0, 10)
    return {
      id: `shared-${overlay.id}-${idx}-${dateKey}`,
      userId,
      date: dateKey,
      type: item.type,
      title: item.title ?? null,
      year: Number(dateKey.slice(0, 4)),
      createdAt: `${dateKey}T00:00:00Z`,
      updatedAt: `${dateKey}T00:00:00Z`,
    }
  })
  const merged = mergeContiguousCalendarEntries(raw, {
    workDays: overlay.workDays,
    holidayDates: options?.holidayDates,
  })
  return merged.map(entry => ({
    ...entry,
    summaryPrefix: overlay.label,
    category: overlay.label,
    color: overlay.color,
    uidScope: `shared-${overlay.id}-${entry.type}`,
  }))
}

/** One event per holiday; intervals split at year boundaries are joined again. */
export function holidayEvents(userId: string, type: 'public' | 'school', holidays: Holiday[]): CalendarEntry[] {
  const byId = new Map<string, Holiday>()
  for (const holiday of holidays) {
    const known = byId.get(holiday.id)
    byId.set(holiday.id, known
      ? { ...known, startDate: known.startDate < holiday.startDate ? known.startDate : holiday.startDate, endDate: known.endDate > holiday.endDate ? known.endDate : holiday.endDate }
      : holiday)
  }
  return [...byId.values()].map(holiday => ({
    id: holiday.id, userId, type, date: holiday.startDate, endDate: holiday.endDate,
    title: localizedName(holiday.name), year: Number(holiday.startDate.slice(0, 4)),
    createdAt: `${holiday.startDate}T00:00:00Z`, updatedAt: `${holiday.startDate}T00:00:00Z`,
  }))
}
