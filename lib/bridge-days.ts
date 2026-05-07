import type { Holiday } from '@/types'
import { parseISO, eachDayOfInterval, isWeekend, isSaturday, isSunday, format } from 'date-fns'

export interface BridgeDay {
  date: string
  connectsBefore: string
  connectsAfter: string
  connectsBeforeName: string
  connectsAfterName: string
  freeDaysGained: number
}

function buildNonWorkDaySet(year: number, publicHolidays: Holiday[]): Set<string> {
  const set = new Set<string>()
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)
  const allDays = eachDayOfInterval({ start, end })
  for (const d of allDays) {
    if (isWeekend(d)) set.add(format(d, 'yyyy-MM-dd'))
  }
  for (const h of publicHolidays) {
    const hStart = parseISO(h.startDate)
    const hEnd = parseISO(h.endDate)
    const days = eachDayOfInterval({ start: hStart, end: hEnd })
    for (const d of days) set.add(format(d, 'yyyy-MM-dd'))
  }
  return set
}

function buildHolidayNameMap(publicHolidays: Holiday[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const h of publicHolidays) {
    const name = h.name.find(n => n.language === 'DE')?.text ?? h.name[0]?.text ?? ''
    const hStart = parseISO(h.startDate)
    const hEnd = parseISO(h.endDate)
    const days = eachDayOfInterval({ start: hStart, end: hEnd })
    for (const d of days) {
      map.set(format(d, 'yyyy-MM-dd'), name)
    }
  }
  return map
}

function getOffDayName(dateStr: string, holidayNames: Map<string, string>): string {
  if (holidayNames.has(dateStr)) return holidayNames.get(dateStr)!
  const d = parseISO(dateStr)
  if (isSaturday(d)) return 'Samstag'
  if (isSunday(d)) return 'Sonntag'
  return 'Wochenende'
}

export function detectBridgeDays(year: number, publicHolidays: Holiday[]): BridgeDay[] {
  const nonWorkDays = buildNonWorkDaySet(year, publicHolidays)
  const holidayNames = buildHolidayNameMap(publicHolidays)
  const result: BridgeDay[] = []

  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)
  const allDays = eachDayOfInterval({ start, end })

  for (const day of allDays) {
    const key = format(day, 'yyyy-MM-dd')
    if (nonWorkDays.has(key)) continue

    const prev = format(new Date(day.getTime() - 86400000), 'yyyy-MM-dd')
    const next = format(new Date(day.getTime() + 86400000), 'yyyy-MM-dd')

    const prevIsNonWork = nonWorkDays.has(prev)
    const nextIsNonWork = nonWorkDays.has(next)

    if (prevIsNonWork && nextIsNonWork) {
      let before = 0
      let firstBefore = prev
      let cur = new Date(day.getTime() - 86400000)
      while (nonWorkDays.has(format(cur, 'yyyy-MM-dd')) && cur >= start) {
        before++
        firstBefore = format(cur, 'yyyy-MM-dd')
        cur = new Date(cur.getTime() - 86400000)
      }
      let after = 0
      let firstAfter = next
      cur = new Date(day.getTime() + 86400000)
      while (nonWorkDays.has(format(cur, 'yyyy-MM-dd')) && cur <= end) {
        after++
        firstAfter = format(cur, 'yyyy-MM-dd')
        cur = new Date(cur.getTime() + 86400000)
      }

      result.push({
        date: key,
        connectsBefore: prev,
        connectsAfter: next,
        connectsBeforeName: getOffDayName(prev, holidayNames),
        connectsAfterName: getOffDayName(next, holidayNames),
        freeDaysGained: before + 1 + after,
      })
    }
  }

  return result
}
