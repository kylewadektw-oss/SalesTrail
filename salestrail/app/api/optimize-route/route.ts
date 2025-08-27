import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

// Simple route optimizer:
// - Optionally uses provided origin (lat/lon)
// - Geocodes stops via a map provider API you plug in (placeholder here)
// - Computes pairwise distances (Haversine) and runs a nearest-neighbor + 2-opt pass
// - Applies a scoring weight depending on strategy (distance/balanced/quality)
// Note: For production, hook into a real Directions API for travel time with traffic.

type UnitPref = 'auto' | 'km' | 'mi'

type Strategy = 'distance' | 'balanced' | 'quality'

interface Payload {
  stops: string[]
  origin?: { lat: number; lon: number } | null
  strategy?: Strategy
  unit?: UnitPref
  weights?: {
    distance?: number
    time?: number
    quality?: number
    weather?: number
    favorites?: number
  }
  constraints?: {
    maxStops?: number
  }
  stopMeta?: Array<{
    startTime?: string // ISO
    endTime?: string   // ISO
    qualityScore?: number // 0..1
    favorite?: boolean
    weatherGoodness?: number // 0..1 (1 good)
  }>
}

interface GeoPoint { lat: number; lon: number }

function toRad(n: number) { return (n * Math.PI) / 180 }
function haversine(a: GeoPoint, b: GeoPoint) {
  const R = 6371 // km
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
  return R * c
}

function withinUSBox(pt?: GeoPoint) {
  if (!pt) return false
  const { lat, lon } = pt
  return lat >= 24 && lat <= 49 && lon <= -66 && lon >= -125
}

function miles(km: number) { return km * 0.621371 }

async function geocodeOneGoogle(address: string): Promise<GeoPoint> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new Error('Google Maps API key not configured')
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Geocoding failed ${res.status}`)
  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.length) throw new Error(`No geocode result for: ${address}`)
  const loc = data.results[0].geometry?.location
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') throw new Error('Invalid geocode response')
  return { lat: loc.lat, lon: loc.lng }
}

async function geocodeBatch(addresses: string[]): Promise<GeoPoint[]> {
  const out: GeoPoint[] = []
  for (const a of addresses) {
    const pt = await geocodeOneGoogle(a)
    out.push(pt)
  }
  return out
}

function twoOptImprove(order: number[], points: GeoPoint[], iterations = 50) {
  function routeLength(ord: number[]) {
    let sum = 0
    for (let i = 0; i < ord.length - 1; i++) sum += haversine(points[ord[i]], points[ord[i + 1]])
    return sum
  }
  let best = order.slice()
  let bestLen = routeLength(best)
  for (let k = 0; k < iterations; k++) {
    let improved = false
    for (let i = 1; i < best.length - 2; i++) {
      for (let j = i + 1; j < best.length - 1; j++) {
        const cand = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1))
        const candLen = routeLength(cand)
        if (candLen < bestLen) {
          best = cand
          bestLen = candLen
          improved = true
        }
      }
    }
    if (!improved) break
  }
  return best
}

function summarize(order: number[], points: GeoPoint[]) {
  let distKm = 0
  for (let i = 0; i < order.length - 1; i++) distKm += haversine(points[order[i]], points[order[i + 1]])
  return { distanceKm: distKm, stops: order.length }
}

function computeSaleScores(n: number, weights: Required<NonNullable<Payload['weights']>>, meta?: Payload['stopMeta']) {
  const scores: number[] = []
  const now = Date.now()
  for (let i = 0; i < n; i++) {
    const m = meta?.[i]
    // Time score
    let timeScore = 0.5
    if (m?.startTime || m?.endTime) {
      const start = m?.startTime ? Date.parse(m.startTime) : undefined
      const end = m?.endTime ? Date.parse(m.endTime) : undefined
      if (end && now > end) timeScore = 0
      else if (start && now < start) {
        // linear decay up to 4h before start
        const hoursAhead = (start - now) / 36e5
        timeScore = Math.max(0, Math.min(1, 1 - hoursAhead / 4))
      } else {
        timeScore = 1
      }
    }
    const quality = typeof m?.qualityScore === 'number' ? Math.max(0, Math.min(1, m.qualityScore)) : 0.5
    const weather = typeof m?.weatherGoodness === 'number' ? Math.max(0, Math.min(1, m.weatherGoodness)) : 0.5
    const favorite = m?.favorite ? 1 : 0

    const saleScore = timeScore * weights.time + quality * weights.quality + weather * weights.weather + favorite * weights.favorites
    scores.push(saleScore)
  }
  return scores
}

function greedyOrder(points: GeoPoint[], origin: GeoPoint | undefined, saleScores: number[], distanceWeight: number) {
  const n = points.length
  const remaining = new Set<number>(Array.from({ length: n }, (_, i) => i))
  const order: number[] = []

  let currentIdx: number
  if (origin) {
    // start at closest to origin
    let best = -1
    let bestD = Infinity
    for (const i of remaining) {
      const d = haversine(origin, points[i])
      if (d < bestD) { bestD = d; best = i }
    }
    currentIdx = best
  } else {
    // start at highest sale score
    let best = -1
    let bestS = -Infinity
    for (const i of remaining) {
      if (saleScores[i] > bestS) { bestS = saleScores[i]; best = i }
    }
    currentIdx = best
  }

  order.push(currentIdx)
  remaining.delete(currentIdx)

  while (remaining.size) {
    let best = -1
    let bestValue = -Infinity
    for (const i of remaining) {
      const dKm = haversine(points[currentIdx], points[i])
      const value = saleScores[i] - distanceWeight * (dKm / 10) // every 10km penalized by distanceWeight
      if (value > bestValue) { bestValue = value; best = i }
    }
    currentIdx = best
    order.push(currentIdx)
    remaining.delete(currentIdx)
  }

  return order
}

export async function POST(req: NextRequest) {
  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const stops = (payload.stops || []).map((s) => String(s)).filter(Boolean)
  if (stops.length < 2) {
    return new Response(JSON.stringify({ error: 'Need at least two stops' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  const origin = payload.origin || undefined
  const strategy: Strategy = (payload.strategy as Strategy) || 'distance'

  const weights = {
    distance: payload.weights?.distance ?? 0.4,
    time: payload.weights?.time ?? 0.2,
    quality: payload.weights?.quality ?? 0.3,
    weather: payload.weights?.weather ?? 0.05,
    favorites: payload.weights?.favorites ?? 0.05,
  }
  const constraints = { maxStops: payload.constraints?.maxStops }

  try {
    // Geocode with Google
    const points = await geocodeBatch(stops)

    // Apply constraints (maxStops): keep top by saleScore preselection
    const saleScoresAll = computeSaleScores(points.length, weights, payload.stopMeta)
    let indices = Array.from({ length: points.length }, (_, i) => i)
    if (constraints.maxStops && constraints.maxStops > 0 && constraints.maxStops < indices.length) {
      indices.sort((a, b) => saleScoresAll[b] - saleScoresAll[a])
      indices = indices.slice(0, constraints.maxStops)
    }

    // Remap points and saleScores to selected indices
    const selPoints = indices.map((i) => points[i])
    const selScores = indices.map((i) => saleScoresAll[i])

    // Build initial order based on strategy
    let order = greedyOrder(selPoints, origin || undefined, selScores, weights.distance)
    if (strategy !== 'quality') {
      order = twoOptImprove(order, selPoints)
    }

    const sum = summarize(order, selPoints)

    // Unit handling
    const unit: UnitPref = payload.unit || 'auto'
    const autoMiles = unit === 'auto' && (withinUSBox(origin || undefined) || (req.headers.get('accept-language') || '').includes('en-US'))
    const useMiles = unit === 'mi' || autoMiles
    const distDisplay = useMiles ? `${miles(sum.distanceKm).toFixed(1)} mi` : `${sum.distanceKm.toFixed(1)} km`

    const summary = `~${distDisplay} across ${sum.stops} stops (strategy: ${strategy})`

    // Map back to original indices so client can reorder their list
    const originalOrder = order.map((idx) => indices[idx])

    return new Response(JSON.stringify({ order: originalOrder, summary }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const status = /geocode/i.test(String(msg)) ? 502 : 500
    return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } })
  }
}
