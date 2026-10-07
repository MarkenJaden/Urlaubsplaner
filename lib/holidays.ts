import type { Holiday } from '@/types'

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
    result.set(item.id, { ...item, startDate: item.startDate < from ? from : item.startDate, endDate: item.endDate > to ? to : item.endDate })
  }
  return [...result.values()]
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
