export interface PlanUpdateEvent {
  userId?: string
  tokens?: string[]
  timestamp: number
}

type PlanUpdateListener = (event: PlanUpdateEvent) => void

interface RealtimeHubState {
  listeners: Set<PlanUpdateListener>
  versions: Map<string, number>
}

const globalForRealtime = globalThis as unknown as {
  __urlaubsplanerRealtimeHub?: RealtimeHubState
}

function getHub(): RealtimeHubState {
  if (!globalForRealtime.__urlaubsplanerRealtimeHub) {
    globalForRealtime.__urlaubsplanerRealtimeHub = {
      listeners: new Set<PlanUpdateListener>(),
      versions: new Map<string, number>(),
    }
  }
  return globalForRealtime.__urlaubsplanerRealtimeHub
}

export function subscribeToPlanUpdates(listener: PlanUpdateListener): () => void {
  const hub = getHub()
  hub.listeners.add(listener)
  return () => {
    hub.listeners.delete(listener)
  }
}

export function publishPlanUpdate(payload: { userId?: string; tokens?: string[] }): void {
  const hub = getHub()
  const timestamp = Date.now()
  if (payload.userId) {
    hub.versions.set(`user:${payload.userId}`, timestamp)
  }
  if (payload.tokens) {
    for (const token of payload.tokens) {
      if (token) hub.versions.set(`token:${token}`, timestamp)
    }
  }

  const event: PlanUpdateEvent = {
    userId: payload.userId,
    tokens: payload.tokens,
    timestamp,
  }

  for (const listener of hub.listeners) {
    try {
      listener(event)
    } catch {
      // Ignore individual subscriber errors
    }
  }
}

export function getPlanVersion(key: string): number {
  return getHub().versions.get(key) ?? 0
}
