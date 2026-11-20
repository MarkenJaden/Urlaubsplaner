import { prisma } from './prisma'

export type TrackedWidgetType =
  | 'widget'
  | 'brueckentage'
  | 'schulferien'
  | 'heatmap'
  | 'personal'

/**
 * Extracts a strictly GDPR-compliant hostname from the HTTP Referer header.
 * Never returns full URLs, paths, query strings, userinfo, or IP literals.
 */
export function extractEmbedHost(
  referer?: string | null,
  selfHost?: string | null
): string {
  const raw = referer?.trim()
  if (!raw) return 'direct'

  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'other'
    }
    let host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    if (!host) return 'direct'

    // Reject IP literals (v4 or bracketed/hex v6) so IPs are never stored as hosts
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
      return 'ip-redacted'
    }

    const normalizedSelf = selfHost
      ? selfHost.split(':')[0]?.trim().toLowerCase().replace(/^www\./, '')
      : ''
    if (normalizedSelf && host === normalizedSelf) {
      return 'self'
    }

    if (host.length > 120) {
      host = host.slice(0, 120)
    }
    return host
  } catch {
    return 'direct'
  }
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function recordWidgetView(params: {
  widgetType: TrackedWidgetType
  region?: string | null
  referer?: string | null
  host?: string | null
  personalWidgetId?: string | null
}): Promise<void> {
  try {
    const date = getTodayDateString()
    const widgetType = params.widgetType
    const region = (params.region ?? '').trim().toLowerCase().slice(0, 40)
    const embedHost = extractEmbedHost(params.referer, params.host)

    const ops = [
      prisma.analyticsDaily.upsert({
        where: { date },
        update: { widgetViews: { increment: 1 } },
        create: { date, widgetViews: 1 },
      }),
      prisma.widgetViewDaily.upsert({
        where: {
          date_widgetType_region_embedHost: {
            date,
            widgetType,
            region,
            embedHost,
          },
        },
        update: { views: { increment: 1 } },
        create: {
          date,
          widgetType,
          region,
          embedHost,
          views: 1,
        },
      }),
    ]

    if (params.personalWidgetId) {
      ops.push(
        prisma.calendarWidget.update({
          where: { id: params.personalWidgetId },
          data: {
            viewCount: { increment: 1 },
            lastViewedAt: new Date(),
          },
        }) as never
      )
    }

    await prisma.$transaction(ops)
  } catch {
    // Analytics must never break widget rendering
  }
}
