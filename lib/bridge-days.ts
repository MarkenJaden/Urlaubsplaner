import type { Holiday } from '@/types'
import { parseISO, eachDayOfInterval, isWeekend, format } from 'date-fns'

export interface BridgeDay {
  date: string // yyyy-MM-dd
  connectsBefore: string // label of holiday/weekend before
  connectsAfter: string // label of holiday/weekend after
  freeDaysGained: number
}

function buildNonWorkDaySet(year: number, publicHolidays: Holiday[]): Set<string> {
  const set = new Set<string>()
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)

  // Add weekends
  const allDays = eachDayOfInterval({ start, end })
  for (const d of allDays) {
    if (isWeekend(d)) set.add(format(d, 'yyyy-MM-dd'))
  }

  // Add public holidays
  for (const h of publicHolidays) {
    const hStart = parseISO(h.startDate)
    const hEnd = parseISO(h.endDate)
    const days = eachDayOfInterval({ start: hStart, end: hEnd })
    for (const d of days) set.add(format(d, 'yyyy-MM-dd'))
  }

  return set
}

export function detectBridgeDays(year: number, publicHolidays: Holiday[]): BridgeDay[] {
  const nonWorkDays = buildNonWorkDaySet(year, publicHolidays)
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
      // Count free days gained: stretch before + 1 (this day) + stretch after
      let before = 0
      let cur = new Date(day.getTime() - 86400000)
      while (nonWorkDays.has(format(cur, 'yyyy-MM-dd')) && cur >= start) {
        before++
        cur = new Date(cur.getTime() - 86400000)
      }
      let after = 0
      cur = new Date(day.getTime() + 86400000)
      while (nonWorkDays.has(format(cur, 'yyyy-MM-dd')) && cur <= end) {
        after++
        cur = new Date(cur.getTime() + 86400000)
      }

      result.push({
        date: key,
        connectsBefore: prev,
        connectsAfter: next,
        freeDaysGained: before + 1 + after,
      })
    }
  }

  return result
}
