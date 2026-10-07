import type { VacationEntry } from '@/types'

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
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

export type CalendarEntry = Omit<VacationEntry, 'type'> & { type: string }

export function createCalendar(entries: CalendarEntry[], name = 'Urlaubsplaner'): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Urlaubsplaner//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`]
  const labels: Record<string, string> = { vacation: 'Urlaub', gleittag: 'Gleittag', note: 'Notiz', public: 'Feiertag', school: 'Schulferien' }
  for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const date = entry.date.split('T')[0]
    const start = new Date(`${date}T00:00:00Z`)
    if (!Number.isFinite(start.getTime())) continue
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)
    const stamp = new Date(entry.updatedAt ?? entry.createdAt)
    const timestamp = (Number.isFinite(stamp.getTime()) ? stamp.toISOString() : `${date}T00:00:00.000Z`).replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const label = labels[entry.type] ?? entry.type
    lines.push('BEGIN:VEVENT',
      `UID:${encodeURIComponent(entry.userId)}-${date}-${encodeURIComponent(entry.type)}${['vacation', 'gleittag', 'note'].includes(entry.type) ? '' : `-${encodeURIComponent(entry.id)}`}@urlaubsplaner`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`,
      `SUMMARY:${escapeText(entry.title ? `${label}: ${entry.title}` : label)}`,
      ...(entry.title ? [`DESCRIPTION:${escapeText(entry.title)}`] : []),
      'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
