export type RouteStop = { label: string; query: string; lat: number; lon: number; color?: string }
export type SavedRoute = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  stops: RouteStop[]
  notes?: string
  color?: string
  tags?: string[]
}

const LS_KEY = 'salestrail:routes:v1'

function loadAll(): Record<string, SavedRoute> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
function saveAll(map: Record<string, SavedRoute>) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(map)) } catch {}
}

export function listRoutes(): SavedRoute[] {
  const map = loadAll()
  return Object.values(map).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export function getRoute(id: string): SavedRoute | null {
  const map = loadAll()
  return map[id] || null
}

export function saveRoute(route: SavedRoute) {
  const map = loadAll()
  route.updatedAt = Date.now()
  if (!route.createdAt) route.createdAt = route.updatedAt
  map[route.id] = route
  saveAll(map)
}

export function deleteRoute(id: string) {
  const map = loadAll()
  if (map[id]) { delete map[id]; saveAll(map) }
}

export function newRouteId() {
  return 'rt_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36)
}

export function exportRoutes(): string {
  const map = loadAll()
  return JSON.stringify(map)
}

export function importRoutes(json: string) {
  try {
    const data = JSON.parse(json)
    if (data && typeof data === 'object') {
      const current = loadAll()
      const merged = { ...current, ...data }
      saveAll(merged)
    }
  } catch {}
}
