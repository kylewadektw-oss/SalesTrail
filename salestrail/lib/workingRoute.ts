import type { RouteStop } from './routes'

export type WorkingRoute = {
  stops: RouteStop[]
  selectedIndex?: number | null
}

const LS_KEY = 'salestrail:workingRoute:v1'

export function getWorkingRoute(): WorkingRoute {
  if (typeof window === 'undefined') return { stops: [], selectedIndex: null }
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? { stops: parsed.stops || [], selectedIndex: parsed.selectedIndex ?? null } : { stops: [], selectedIndex: null }
  } catch {
    return { stops: [], selectedIndex: null }
  }
}

export function setWorkingRoute(next: WorkingRoute) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ stops: next.stops || [], selectedIndex: next.selectedIndex ?? null }))
    window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY }))
  } catch {}
}

export function addStopToWorking(stop: RouteStop) {
  const cur = getWorkingRoute()
  setWorkingRoute({ ...cur, stops: [...cur.stops, stop] })
}

export function removeStopFromWorking(index: number) {
  const cur = getWorkingRoute()
  const stops = cur.stops.slice()
  stops.splice(index, 1)
  setWorkingRoute({ ...cur, stops })
}

export function moveStopInWorking(index: number, dir: -1 | 1) {
  const cur = getWorkingRoute()
  const arr = cur.stops.slice()
  const j = index + dir
  if (j < 0 || j >= arr.length) return
  const [x] = arr.splice(index, 1)
  arr.splice(j, 0, x)
  setWorkingRoute({ ...cur, stops: arr })
}

export function setSelectedIndex(i: number | null) {
  const cur = getWorkingRoute()
  setWorkingRoute({ ...cur, selectedIndex: i })
}
