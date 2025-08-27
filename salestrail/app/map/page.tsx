'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { newRouteId, saveRoute, listRoutes, getRoute, deleteRoute, exportRoutes, importRoutes, type SavedRoute, type RouteStop } from '@/lib/routes'
import { getWorkingRoute, setWorkingRoute, setSelectedIndex } from '@/lib/workingRoute'

// Dynamic import for Leaflet CSS via CDN (minimal footprint)
function ensureLeafletAssets() {
  if (typeof window === 'undefined') return
  const id = 'leaflet-css'
  if (!document.getElementById(id)) {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
  }
}

export default function MapPage() {
  const mapRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [L, setL] = useState<any>(null)
  const [routeId, setRouteId] = useState<string>('')
  const [name, setName] = useState<string>('Untitled route')
  const [stops, setStops] = useState<RouteStop[]>([])
  const [routes, setRoutes] = useState<SavedRoute[]>(listRoutes())
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState<string>('')
  const [tags, setTags] = useState<string>('')
  const [routeColor, setRouteColor] = useState<string>('#3b82f6') // tailwind blue-500
  const [startFromHere, setStartFromHere] = useState<boolean>(false)
  const [myLoc, setMyLoc] = useState<{ lat: number; lon: number } | null>(null)

  // Geolocation effect
  useEffect(() => {
    if (startFromHere && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMyLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setMyLoc(null),
        { enableHighAccuracy: true, timeout: 8000 }
      )
    } else {
      setMyLoc(null)
    }
  }, [startFromHere])

  // Load Leaflet JS lazily on client
  useEffect(() => {
    ensureLeafletAssets()
    let cancelled = false
    ;(async () => {
      try {
        const mod = await import('leaflet')
        if (!cancelled) { setL(mod); setReady(true) }
      } catch {
        setStatus('Failed to load map library')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Init map when L is ready
  useEffect(() => {
    if (!ready || !L) return
    if (mapRef.current) return
    const el = document.getElementById('map') as HTMLDivElement
    if (!el) return
    const map = L.map(el).setView([41.7658, -72.6734], 9) // Hartford default
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
  }, [ready, L])

  // Load working route on mount
  useEffect(() => {
    const wr = getWorkingRoute()
    if (wr.stops?.length) setStops(wr.stops)
  }, [])

  // Persist any edit back to working route
  useEffect(() => {
    setWorkingRoute({ stops, selectedIndex: null })
  }, [stops])

  // Keep in sync across tabs/pages
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'salestrail:workingRoute:v1') {
        const wr = getWorkingRoute()
        setStops(wr.stops)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Render markers whenever stops change (updated to use routeColor and optional start point)
  useEffect(() => {
    if (!L || !mapRef.current) return
    const map = mapRef.current

    ;(map as any)._stopsLayer?.remove()

    const layer = L.layerGroup()
    const latlngs: any[] = []

    if (myLoc) {
      const m = L.marker([myLoc.lat, myLoc.lon], { title: 'Start' }).bindPopup('<strong>Start</strong>')
      layer.addLayer(m as any)
      latlngs.push([myLoc.lat, myLoc.lon])
    }

    stops.forEach((s, idx) => {
      const color = s.color || paletteColor(idx)
      const marker = L.circleMarker([s.lat, s.lon], { radius: 9, color, fillColor: color, fillOpacity: 0.95, weight: 2 })
        .bindPopup(`<strong>${escapeHtml(s.label)}</strong><br/><em>${escapeHtml(s.query)}</em><br/>Stop #${idx + 1}`)
        .on('click', () => setSelectedIndex(idx))
      layer.addLayer(marker as any)
      latlngs.push([s.lat, s.lon])
    })

    if (latlngs.length > 1) {
      const poly = L.polyline(latlngs, { color: routeColor, weight: 4, opacity: 0.8 })
      layer.addLayer(poly as any)
      map.fitBounds(poly.getBounds(), { padding: [30, 30] })
    } else if (latlngs.length === 1) {
      map.setView(latlngs[0], 13)
    }

    ;(map as any)._stopsLayer = layer
    layer.addTo(map)
  }, [stops, L, routeColor, myLoc])

  function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
  }

  async function geocode(query: string): Promise<{ lat: number; lon: number; label: string } | null> {
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (res.ok && data?.lat) return { lat: data.lat, lon: data.lon, label: data.raw?.label || query }
    } catch {}
    return null
  }

  async function addStop() {
    if (!q.trim()) return
    setStatus('Geocoding…')
    const r = await geocode(q.trim())
    if (!r) { setStatus('Address not found'); return }
    setStops(prev => [...prev, { label: r.label, query: q.trim(), lat: r.lat, lon: r.lon }])
    setQ('')
    setStatus('')
  }

  function removeStop(i: number) {
    setStops(prev => prev.filter((_, idx) => idx !== i))
  }

  function moveStop(i: number, dir: -1 | 1) {
    setStops(prev => {
      const arr = [...prev]
      const j = i + dir
      if (j < 0 || j >= arr.length) return prev
      const [x] = arr.splice(i, 1)
      arr.splice(j, 0, x)
      return arr
    })
  }

  function saveCurrentRoute() {
    const id = routeId || newRouteId()
    const now = Date.now()
    const route: SavedRoute = { id, name: name || 'Untitled route', createdAt: now, updatedAt: now, stops: [...stops], notes, color: routeColor, tags: tagsToArray(tags) }
    saveRoute(route)
    setRouteId(id)
    setRoutes(listRoutes())
  }

  function loadRoute(id: string) {
    const r = getRoute(id)
    if (!r) return
    setRouteId(r.id)
    setName(r.name)
    setStops(r.stops)
    setNotes(r.notes || '')
    setRouteColor(r.color || '#3b82f6')
    setTags((r.tags || []).join(', '))
  }

  function deleteRouteById(id: string) {
    if (!confirm('Delete this route?')) return
    deleteRoute(id)
    setRoutes(listRoutes())
    if (routeId === id) { setRouteId(''); setStops([]); setName('Untitled route') }
  }

  function googleMapsLink(stops: RouteStop[]) {
    const pts = [...(startFromHere && myLoc ? [{ lat: myLoc.lat, lon: myLoc.lon }] : []), ...stops]
    if (pts.length === 0) return '#'
    const parts = pts.map(s => encodeURIComponent(`${s.lat},${s.lon}`))
    return `https://www.google.com/maps/dir/${parts.join('/')}`
  }

  function appleMapsLink(stops: RouteStop[]) {
    const pts = [...(startFromHere && myLoc ? [{ lat: myLoc.lat, lon: myLoc.lon }] : []), ...stops]
    if (pts.length === 0) return '#'
    const parts = pts.map(s => `${s.lat},${s.lon}`).join('\n')
    return `http://maps.apple.com/?daddr=${encodeURIComponent(parts)}`
  }

  function tagsToArray(s: string) { return s.split(',').map(x => x.trim()).filter(Boolean) }

  function exportAll() {
    const json = exportRoutes()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'salestrail-routes.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importAll() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => { try { importRoutes(String(reader.result||'')); setRoutes(listRoutes()) } catch {} }
      reader.readAsText(file)
    }
    input.click()
  }

  const summary = useMemo(() => {
    if (stops.length === 0 && !myLoc) return ''
    // naive distance estimate (straight-line)
    let miles = 0
    const pts = [...(startFromHere && myLoc ? [{ lat: myLoc.lat, lon: myLoc.lon }] as any[] : []), ...stops]
    for (let i = 1; i < pts.length; i++) miles += haversineMi(pts[i-1], pts[i])
    const eta = Math.round((miles / 25) * 60) // assume 25 mph avg including stops
    return `${miles.toFixed(1)} mi · ~${eta} min`
  }, [stops, myLoc, startFromHere])

  function toRad(n: number) { return (n * Math.PI) / 180 }
  function haversineMi(a: {lat:number; lon:number}, b: {lat:number; lon:number}) {
    const R = 3958.8
    const dLat = toRad(b.lat - a.lat)
    const dLon = toRad(b.lon - a.lon)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const sinDLat = Math.sin(dLat/2)
    const sinDLon = Math.sin(dLon/2)
    const aa = sinDLat*sinDLat + Math.cos(lat1)*Math.cos(lat2)*sinDLon*sinDLon
    const c = 2*Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa))
    return R*c
  }

  function paletteColor(i: number) {
    const colors = [
      '#6366F1', // indigo-500
      '#10B981', // emerald-500
      '#F59E0B', // amber-500
      '#3B82F6', // blue-500
      '#EC4899', // pink-500
      '#84CC16', // lime-500
      '#06B6D4', // cyan-500
      '#A855F7', // purple-500
      '#F97316', // orange-500
      '#14B8A6', // teal-500
      '#EAB308', // yellow-500
      '#22C55E', // green-500
    ]
    return colors[i % colors.length]
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--background)' }}>
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold m-0">Map & Routes</h1>
            <span className="badge">{stops.length} stop{stops.length===1?'':'s'}</span>
            {summary && <span className="badge">{summary}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/feed" className="btn btn-outline">Back to Feed</Link>
          </div>
        </div>

        {/* Builder */}
        <div className="card mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <input className="input flex-1 min-w-[240px]" placeholder="Add address, place, or ZIP" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter' && addStop()} />
            <button className="btn" onClick={addStop}>Add stop</button>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={startFromHere} onChange={e => setStartFromHere(e.target.checked)} /> Start from my location
            </label>
            <input type="color" className="input w-10 h-10 p-0" value={routeColor} onChange={e => setRouteColor(e.target.value)} title="Route color" />
            <button className="btn" onClick={saveCurrentRoute}>Save route</button>
            <a className="btn btn-outline" href={googleMapsLink(stops)} target="_blank" rel="noreferrer">Google Maps</a>
            <a className="btn btn-outline" href={appleMapsLink(stops)} target="_blank" rel="noreferrer">Apple Maps</a>
          </div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
            <textarea className="input min-h-[44px]" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
            <input className="input" placeholder="Tags (comma separated)" value={tags} onChange={e => setTags(e.target.value)} />
            <div className="flex items-center gap-2">
              <button className="btn btn-outline" onClick={exportAll}>Export all routes</button>
              <button className="btn btn-outline" onClick={importAll}>Import routes</button>
            </div>
          </div>
          {status && <div className="text-xs text-muted mt-2">{status}</div>}
          <div id="map" className="mt-3 w-full h-[420px] rounded" style={{ background: 'var(--muted)' }} />

          {/* Legend */}
          {stops.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {stops.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="inline-block w-3.5 h-3.5 rounded" style={{ background: (s.color || paletteColor(idx)) }} />
                  <span className="text-muted">#{idx + 1}</span>
                  <span className="truncate" title={s.label}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {stops.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1 pr-2">Label</th>
                    <th className="py-1 pr-2">Query</th>
                    <th className="py-1 pr-2">Lat, Lon</th>
                    <th className="py-1 pr-2">Color</th>
                    <th className="py-1 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map((s, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="py-1 pr-2">{i+1}</td>
                      <td className="py-1 pr-2 whitespace-pre-wrap break-words">{s.label}</td>
                      <td className="py-1 pr-2 whitespace-pre-wrap break-words text-muted">{s.query}</td>
                      <td className="py-1 pr-2 text-muted">{s.lat.toFixed(5)}, {s.lon.toFixed(5)}</td>
                      <td className="py-1 pr-2"><input type="color" value={s.color || routeColor} onChange={e => setStops(prev => prev.map((x, idx) => idx===i ? { ...x, color: e.target.value } : x))} /></td>
                      <td className="py-1 pr-2 text-right">
                        <div className="inline-flex gap-1">
                          <button className="btn btn-outline" onClick={() => moveStop(i, -1)} disabled={i===0}>↑</button>
                          <button className="btn btn-outline" onClick={() => moveStop(i, 1)} disabled={i===stops.length-1}>↓</button>
                          <button className="btn btn-outline" onClick={() => removeStop(i)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Saved routes queue */}
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Saved routes</div>
            <div className="text-sm text-muted">{routes.length} total</div>
          </div>
          {routes.length === 0 ? (
            <div className="text-muted">No saved routes yet. Build a route above and click Save.</div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {routes.map((r) => (
                <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate max-w-[60ch]">{r.name}</div>
                    <div className="text-xs text-muted flex items-center gap-2 flex-wrap">
                      <span>{r.stops.length} stop{r.stops.length===1?'':'s'}</span>
                      {r.tags?.length ? <span>Tags: {r.tags.join(', ')}</span> : null}
                      {r.color ? <span>Color: <span className="inline-block align-middle w-3 h-3 rounded" style={{ background: r.color }} /></span> : null}
                      <span>Updated {new Date(r.updatedAt).toLocaleString()}</span>
                    </div>
                    {r.notes && <div className="text-xs text-muted mt-1 line-clamp-2">{r.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn" onClick={() => loadRoute(r.id)}>Load</button>
                    <button className="btn btn-outline" onClick={() => deleteRouteById(r.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </section>
    </main>
  )
}
