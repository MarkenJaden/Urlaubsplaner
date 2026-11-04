'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export interface AnalyticsContextPayload {
  country?: string | null
  subdivision?: string | null
  plannedDaysCount?: number
}

const HEARTBEAT_INTERVAL_MS = 45_000
const VISITOR_STORAGE_KEY = 'urlaubsplaner_visitor_id'

let latestContext: AnalyticsContextPayload = {}
let metadataTimer: ReturnType<typeof setTimeout> | null = null

export function updateAnalyticsContext(next: AnalyticsContextPayload) {
  const changed =
    next.country !== latestContext.country ||
    next.subdivision !== latestContext.subdivision ||
    next.plannedDaysCount !== latestContext.plannedDaysCount
  latestContext = { ...latestContext, ...next }

  if (!changed || typeof window === 'undefined' || process.env.NODE_ENV === 'test') return
  if (metadataTimer) clearTimeout(metadataTimer)
  metadataTimer = setTimeout(() => {
    const visitorId = getOrCreateVisitorId()
    if (!visitorId) return
    void fetch('/api/analytics/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        path: window.location.pathname || '/',
        deviceType: detectDeviceType(),
        heartbeat: true,
        ...latestContext,
      }),
      keepalive: true,
    }).catch(() => undefined)
  }, 1500)
}

function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

function getOrCreateVisitorId(): string | null {
  try {
    let visitorId = localStorage.getItem(VISITOR_STORAGE_KEY)
    if (!visitorId) {
      visitorId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(VISITOR_STORAGE_KEY, visitorId)
    }
    return visitorId
  } catch {
    return null
  }
}

export function AnalyticsHeartbeat() {
  const pathname = usePathname() || '/'
  const lastPingAtRef = useRef<number>(0)

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return

    const sendPing = (heartbeat: boolean) => {
      if (heartbeat && document.visibilityState !== 'visible') return
      const visitorId = getOrCreateVisitorId()
      if (!visitorId) return

      lastPingAtRef.current = Date.now()

      const payload: Record<string, unknown> = {
        visitorId,
        path: pathname,
        deviceType: detectDeviceType(),
        heartbeat,
      }
      if (latestContext.country) payload.country = latestContext.country
      if (latestContext.subdivision) payload.subdivision = latestContext.subdivision
      if (typeof latestContext.plannedDaysCount === 'number') {
        payload.plannedDaysCount = latestContext.plannedDaysCount
      }

      void fetch('/api/analytics/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => undefined)
    }

    // Immediate pageview ping on route enter
    sendPing(false)

    // Keep-alive heartbeat while tab remains open and visible
    const interval = window.setInterval(() => {
      sendPing(true)
    }, HEARTBEAT_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastPingAtRef.current > 25_000) {
        sendPing(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [pathname])

  return null
}
