import type { Holiday, RegionReference } from '@/types'

function isReference(value: unknown): value is RegionReference {
  return Boolean(value) && typeof (value as RegionReference).code === 'string'
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function normalizeHolidays(input: unknown, year: number): Holiday[] {
  if (!Array.isArray(input)) throw new Error('Invalid holiday response')
  const from = `${year}-01-01`, to = `${year}-12-31`
  const result = new Map<string, Holiday>()
  for (const item of input) {
    if (!item || typeof item.id !== 'string' || !validDate(item.startDate) || !validDate(item.endDate) || item.startDate > item.endDate || !Array.isArray(item.name) || item.name.some((name: { language: unknown; text: unknown }) => !name || typeof name.language !== 'string' || typeof name.text !== 'string')) throw new Error('Invalid holiday interval')
    if (item.endDate < from || item.startDate > to) continue
    // Keep the fields the app uses; NL entries list over 100 subdivisions each.
    result.set(item.id, {
      id: item.id, type: item.type, name: item.name, nationwide: Boolean(item.nationwide),
      ...(Array.isArray(item.groups) ? { groups: item.groups.filter(isReference).map(({ code, shortName }: RegionReference) => ({ code, shortName })) } : {}),
      ...(Array.isArray(item.comment) ? { comment: item.comment.filter((c: unknown) => c && typeof (c as { language?: unknown; text?: unknown }).language === 'string' && typeof (c as { language?: unknown; text?: unknown }).text === 'string') } : {}),
      startDate: item.startDate < from ? from : item.startDate, endDate: item.endDate > to ? to : item.endDate,
    })
  }
  return [...result.values()]
}

/** Check if holiday is a localized special exception (e.g. North Sea islands). */
export function isSpecialLocalHoliday(holiday: Holiday): boolean {
  return Boolean(
    holiday.comment?.some(
      c => c.text && (c.text.includes('Inseln') || c.text.includes('Halligen')),
    ),
  )
}

/** Calculates total unique calendar days across holiday periods for a specific year. */
export function countUniqueHolidayDays(holidays: Holiday[], year: number): number {
  const dates = new Set<string>()
  for (const holiday of holidays) {
    const current = new Date(`${holiday.startDate}T00:00:00Z`)
    const end = new Date(`${holiday.endDate}T00:00:00Z`)
    if (!Number.isFinite(current.getTime()) || !Number.isFinite(end.getTime())) continue
    while (current <= end) {
      if (current.getUTCFullYear() === year) {
        dates.add(current.toISOString().slice(0, 10))
      }
      current.setUTCDate(current.getUTCDate() + 1)
    }
  }
  return dates.size
}

export function countHolidayStates(regions: Holiday[][]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const holidays of regions) {
    const dates = new Set<string>()
    for (const holiday of holidays) {
      const current = new Date(`${holiday.startDate}T00:00:00Z`)
      const end = new Date(`${holiday.endDate}T00:00:00Z`)
      if (!Number.isFinite(current.getTime()) || !Number.isFinite(end.getTime())) continue
      while (current <= end) {
        dates.add(current.toISOString().slice(0, 10))
        current.setUTCDate(current.getUTCDate() + 1)
      }
    }
    for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return counts
}
