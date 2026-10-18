import type { Holiday, VacationEntry } from '@/types'
import { localizedName } from './holiday-regions'

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

export type CalendarEntry = Omit<VacationEntry, 'type'> & {
  type: string
  /** Inclusive last day for multi-day events such as school holidays. */
  endDate?: string
}

export interface CalendarOptions {
  name?: string
  /** Suggested refresh interval for subscriptions, e.g. PT6H. */
  refreshInterval?: string
}

export function createCalendar(entries: CalendarEntry[], options: CalendarOptions | string = {}): string {
  const { name = 'Urlaubsplaner', refreshInterval } = typeof options === 'string' ? { name: options } : options
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Urlaubsplaner//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`]
  if (refreshInterval) lines.push(`REFRESH-INTERVAL;VALUE=DURATION:${refreshInterval}`, `X-PUBLISHED-TTL:${refreshInterval}`)
  const labels: Record<string, string> = { vacation: 'Urlaub', gleittag: 'Gleittag', note: 'Notiz', public: 'Feiertag', school: 'Schulferien' }
  for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id))) {
    const date = entry.date.split('T')[0]
    const start = new Date(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start.getTime())) continue
    const last = entry.endDate && entry.endDate > date ? entry.endDate : date
    const stamp = new Date(entry.updatedAt ?? entry.createdAt)
    const timestamp = (Number.isFinite(stamp.getTime()) ? stamp.toISOString() : `${date}T00:00:00.000Z`).replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const label = labels[entry.type] ?? entry.type
    lines.push('BEGIN:VEVENT',
      `UID:${encodeURIComponent(entry.userId)}-${date}-${encodeURIComponent(entry.type)}${['vacation', 'gleittag', 'note'].includes(entry.type) ? '' : `-${encodeURIComponent(entry.id)}`}@urlaubsplaner`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`,
      // DTEND is exclusive for all-day events: the day after the last day.
      `DTEND;VALUE=DATE:${nextDay(last).replace(/-/g, '')}`,
      `SUMMARY:${escapeText(entry.title ? `${label}: ${entry.title}` : label)}`,
      ...(entry.title ? [`DESCRIPTION:${escapeText(entry.title)}`] : []),
      'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
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
