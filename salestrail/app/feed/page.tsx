'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SaleCard from '@/components/SaleCard';
import type { UxSale } from '@/lib/types';
import { loadPreferences } from '@/lib/preferences';
import { isFavorite, countFavorites, listFavoriteDetails, removeFavorite, clearFavorites } from '@/lib/favorites';
import { getWorkingRoute, setWorkingRoute } from '@/lib/workingRoute';

const CITY_PRESETS: Record<string, { label: string; lat: number; lon: number }>
  = {
    hartford: { label: 'Hartford, CT', lat: 41.7658, lon: -72.6734 },
    newyork: { label: 'New York, NY', lat: 40.7128, lon: -74.0060 },
    boston: { label: 'Boston, MA', lat: 42.3601, lon: -71.0589 },
    providence: { label: 'Providence, RI', lat: 41.8240, lon: -71.4128 },
  };

function ensureLeafletAssets() {
  if (typeof window === 'undefined') return;
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  if (!document.getElementById('leaflet-cluster-css')) {
    const link2 = document.createElement('link');
    link2.id = 'leaflet-cluster-css';
    link2.rel = 'stylesheet';
    link2.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
    document.head.appendChild(link2);
  }
}

function paletteColor(i: number) {
  const colors = ['#6366F1','#10B981','#F59E0B','#3B82F6','#EC4899','#84CC16','#06B6D4','#A855F7','#F97316','#14B8A6','#EAB308','#22C55E']
  return colors[i % colors.length]
}

export default function FeedPage() {
  const params = useSearchParams();
  const [sales, setSales] = useState<UxSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 7-day forecast state
  const [forecast, setForecast] = useState<Array<{ date: string; label: string; hi: number; lo: number; code: number }>>([]);

  // Filters state
  const [q, setQ] = useState(params?.get?.('q') || '');
  const [zip, setZip] = useState(params?.get?.('zip') || '');
  const [radiusMi, setRadiusMi] = useState<number>(loadPreferences().travel.radiusMi);
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [datePreset, setDatePreset] = useState<'today' | 'weekend' | 'custom'>('weekend');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [saleType, setSaleType] = useState<string>('all');
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [sort, setSort] = useState<'newest' | 'closest' | 'highest' | 'best'>('best');
  const [prefs] = useState(loadPreferences());
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const city = (params?.get?.('city') || 'hartford').toLowerCase();
  const unified = (params?.get?.('unified') ?? 'true') !== 'false';

  const apiUrl = useMemo(() => {
    const sp = new URLSearchParams();
    if (unified) sp.set('unified', 'true'); else sp.set('city', city);
    if (zip) sp.set('zip', zip);
    return `/api/rss-cached?${sp.toString()}`;
  }, [city, unified, zip]);

  // Load sales
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true); setError(null);
        const res = await fetch(apiUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed ${res.status}`);
        const data = await res.json();
        const mapped: UxSale[] = (Array.isArray(data) ? data : []).map((it: any) => ({
          title: it?.title || '',
          description: it?.description || '',
          url: it?.url || it?.link || '#',
          pubDate: it?.pubDate ?? null,
        }));
        if (!cancelled) setSales(mapped);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg); setSales([]);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [apiUrl]);

  // Geolocate or geocode ZIP
  useEffect(() => {
    let cancelled = false;
    async function resolveCoords() {
      if (useMyLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { if (!cancelled) setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
          () => { if (!cancelled) setCoords(null); },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else if (zip) {
        try {
          const res = await fetch(`/api/geocode?zip=${encodeURIComponent(zip)}`);
          const data = await res.json();
          if (res.ok && data?.lat && !cancelled) setCoords({ lat: data.lat, lon: data.lon });
        } catch { /* ignore */ }
      } else {
        setCoords(null);
      }
    }
    resolveCoords();
    return () => { cancelled = true; };
  }, [useMyLocation, zip]);

  // Reset filters back to profile defaults
  const resetToProfile = () => {
    setQ('');
    setZip('');
    setUseMyLocation(false);
    setCoords(null);
    setRadiusMi(loadPreferences().travel.radiusMi);
    setDatePreset('weekend');
    setStartDate('');
    setEndDate('');
    setSaleType('all');
    setOnlyFavs(false);
    setSort('best');
    setPage(1);
  };

  // Determine base coordinates for features (forecast, distance) when user coords unavailable
  function baseCoords() {
    if (coords) return coords;
    const preset = CITY_PRESETS[city] || CITY_PRESETS.hartford;
    return { lat: preset.lat, lon: preset.lon };
  }

  // Load 7-day forecast for the current week using Open-Meteo
  useEffect(() => {
    let cancelled = false;
    async function loadForecast() {
      try {
        const b = baseCoords();
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${b.lat}&longitude=${b.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const days: Array<{ date: string; label: string; hi: number; lo: number; code: number }> = [];
        const dates: string[] = data?.daily?.time || [];
        const his: number[] = data?.daily?.temperature_2m_max || [];
        const los: number[] = data?.daily?.temperature_2m_min || [];
        const codes: number[] = data?.daily?.weather_code || [];
        for (let i = 0; i < dates.length && i < 7; i++) {
          const d = new Date(dates[i]);
          const label = d.toLocaleDateString(undefined, { weekday: 'short' });
          days.push({ date: dates[i], label, hi: Math.round(his[i]), lo: Math.round(los[i]), code: Number(codes[i] || 0) });
        }
        if (!cancelled) setForecast(days);
      } catch {
        // ignore forecast errors
      }
    }
    loadForecast();
    return () => { cancelled = true; };
  }, [coords, city]);

  // Highlight rules for forecast tiles based on current date preset
  function isSelectedDay(dateISO: string) {
    const d = new Date(dateISO);
    if (datePreset === 'today') {
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }
    if (datePreset === 'weekend') {
      const dow = d.getDay();
      return dow === 0 || dow === 6;
    }
    if (datePreset === 'custom' && startDate && endDate) {
      const iso = dateISO.slice(0, 10);
      return iso >= startDate && iso <= endDate;
    }
    return false;
  }

  // Map Open-Meteo weather codes to simple glyphs and labels
  function weatherIcon(code: number): { glyph: string; label: string } {
    if (code === 0) return { glyph: '☀️', label: 'Clear' };
    if ([1, 2, 3].includes(code)) return { glyph: '🌤️', label: 'Partly cloudy' };
    if ([45, 48].includes(code)) return { glyph: '🌫️', label: 'Fog' };
    if ([51, 53, 55, 56, 57].includes(code)) return { glyph: '🌦️', label: 'Drizzle' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { glyph: '🌧️', label: 'Rain' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { glyph: '❄️', label: 'Snow' };
    if ([95, 96, 97, 98, 99].includes(code)) return { glyph: '⛈️', label: 'Thunderstorm' };
    return { glyph: '☁️', label: 'Clouds' };
  }

  // Helpers
  function toRad(n: number) { return (n * Math.PI) / 180; }
  function haversineMi(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
    const R = 3958.8; // miles
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
  }

  // Placeholder location extraction from sale text
  function roughLatLonFromText(s: UxSale): { lat: number; lon: number } | null {
    // In future, store lat/lon in sale. For now, return null.
    return null;
  }

  // Helpers for interest matching and type
  const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'antiques & collectibles': ['antique', 'collectible', 'vintage', 'retro', 'mid-century'],
    'tools & hardware': ['tool', 'dewalt', 'milwaukee', 'saw', 'drill', 'wrench', 'hardware'],
    'electronics': ['electronics', 'tv', 'stereo', 'camera', 'computer', 'laptop', 'console', 'ps5', 'xbox'],
    'furniture': ['sofa', 'chair', 'table', 'dresser', 'furniture', 'couch', 'desk'],
    'vinyl/media': ['vinyl', 'records', 'cds', 'dvds', 'blu-ray', 'media'],
    'clothing & apparel': ['clothing', 'apparel', 'clothes', 'jacket', 'coat', 'boots'],
    'toys/kids': ['toys', 'lego', 'kid', 'children', 'stroller', 'games'],
  };

  function textForSale(s: UxSale) {
    return `${s.title || ''} ${s.description || ''}`.toLowerCase();
  }

  function extractSaleType(s: UxSale): 'estate' | 'garage' | 'moving' | 'yard' | 'tag' | 'unknown' {
    const t = textForSale(s);
    if (t.includes('estate')) return 'estate';
    if (t.includes('garage')) return 'garage';
    if (t.includes('moving')) return 'moving';
    if (t.includes('yard')) return 'yard';
    if (t.includes('tag')) return 'tag';
    return 'unknown';
  }

  function interestScore(s: UxSale): number {
    const t = textForSale(s);
    const selected = prefs.categories || [];
    if (!selected.length) return 0;
    let hits = 0; let total = 0;
    for (const cat of selected) {
      const key = String(cat).toLowerCase();
      const words = CATEGORY_KEYWORDS[key] || [key];
      total += 1;
      if (words.some(w => t.includes(w))) hits += 1;
    }
    return total ? hits / total : 0;
  }

  function recencyScore(s: UxSale): number {
    const ts = Date.parse(s.pubDate || '') || 0;
    if (!ts) return 0.5;
    const hours = (Date.now() - ts) / 36e5; // hours ago
    // 0h -> 1, 48h -> ~0
    return Math.max(0, Math.min(1, 1 - hours / 48));
  }

  // Date filter utilities
  function inDatePreset(s: UxSale) {
    if (!s.pubDate) return true;
    const d = new Date(s.pubDate);
    if (isNaN(d.getTime())) return true;
    if (datePreset === 'today') {
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }
    if (datePreset === 'weekend') {
      const day = d.getDay();
      return day === 0 || day === 6;
    }
    if (datePreset === 'custom' && startDate && endDate) {
      const iso = d.toISOString().slice(0, 10);
      return iso >= startDate && iso <= endDate;
    }
    return true;
  }

  const filteredSorted = useMemo(() => {
    let list = sales;

    // Keyword filter
    if (q.trim()) {
      const qq = q.toLowerCase();
      list = list.filter((s) => textForSale(s).includes(qq));
    }

    // Sale type filter
    if (saleType !== 'all') {
      list = list.filter((s) => extractSaleType(s) === saleType);
    }

    // Favorites filter using URL as stable ID
    if (onlyFavs) {
      list = list.filter((s) => (s.url ? isFavorite(s.url) : false));
    }

    // Date filter
    list = list.filter(inDatePreset);

    // Distance filter if we have coords and sale coords (placeholder)
    if (coords) {
      list = list.filter((s) => {
        const pt = roughLatLonFromText(s);
        if (!pt) return true; // retain if unknown for now
        return haversineMi(coords!, pt) <= radiusMi;
      });
    }

    // Sort
    list = [...list];
    switch (sort) {
      case 'newest':
        list.sort((a, b) => (Date.parse(b.pubDate || '') || 0) - (Date.parse(a.pubDate || '') || 0));
        break;
      case 'closest':
        if (coords) {
          list.sort((a, b) => {
            const pa = roughLatLonFromText(a); const pb = roughLatLonFromText(b);
            const da = pa ? haversineMi(coords!, pa) : Infinity;
            const db = pb ? haversineMi(coords!, pb) : Infinity;
            return da - db;
          });
        }
        break;
      case 'highest':
        // placeholder for ratings
        break;
      case 'best':
      default: {
        const mode = prefs.mode;
        // Adjust weights by mode
        let wInterest = 0.6, wRecency = 0.4;
        if (mode === 'reseller') { wInterest = 0.7; wRecency = 0.3; }
        if (mode === 'casual') { wInterest = 0.4; wRecency = 0.6; }
        if (mode === 'bargain') { wInterest = 0.5; wRecency = 0.5; }
        if (mode === 'treasure') { wInterest = 0.65; wRecency = 0.35; }
        list.sort((a, b) => {
          const sa = interestScore(a) * wInterest + recencyScore(a) * wRecency;
          const sb = interestScore(b) * wInterest + recencyScore(b) * wRecency;
          return sb - sa;
        });
        break; }
    }

    return list;
  }, [sales, q, saleType, onlyFavs, coords, radiusMi, sort, prefs]);

  const paged = useMemo(() => filteredSorted.slice(0, page * pageSize), [filteredSorted, page]);

  // Favorites drawer state
  const [showFavs, setShowFavs] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [favList, setFavList] = useState(listFavoriteDetails());

  useEffect(() => {
    setFavCount(countFavorites());
    setFavList(listFavoriteDetails());
  }, [onlyFavs, sales, q, saleType, coords, radiusMi, sort]);

  function onRemoveFav(id: string) {
    removeFavorite(id);
    setFavCount(countFavorites());
    setFavList(listFavoriteDetails());
  }

  function onClearFavs() {
    if (confirm('Clear all favorites?')) {
      clearFavorites();
      setFavCount(0);
      setFavList([]);
    }
  }

  // Banners
  const interestBanner = prefs.categories?.length ? `Matches your interests: ${prefs.categories.join(', ')}` : '';
  const rainCodes = new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
  const rainDays = (forecast || []).filter(d => rainCodes.has(Number(d.code))).length;

  const legendItems = useMemo(() => paged.slice(0, 12).map((s, i) => ({ label: s.title || s.url || `Sale ${i+1}`, color: paletteColor(i) })), [paged])

  const mapRef = useRef<any>(null);
  const [Lmod, setLmod] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Load Leaflet for mini map
  useEffect(() => {
    ensureLeafletAssets();
    let cancelled = false;
    (async () => {
      try {
        const [L, MC] = await Promise.all([
          import('leaflet'),
          import('leaflet.markercluster'),
        ]);
        if (!cancelled) { setLmod(L); setMapReady(true); }
      } catch {}
    })();
    return () => { cancelled = true; }
  }, []);

  // Initialize mini map once
  useEffect(() => {
    if (!mapReady || !Lmod || mapRef.current) return;
    const el = document.getElementById('feed-mini-map') as HTMLDivElement;
    if (!el) return;
    const map = Lmod.map(el, { zoomControl: false, attributionControl: false }).setView([41.7658, -72.6734], 9);
    Lmod.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
  }, [mapReady, Lmod]);

  // Render clustered pins for current page using working route points
  useEffect(() => {
    if (!Lmod || !mapRef.current) return;
    const map = mapRef.current;
    (map as any)._miniLayer?.remove();
    const layer = Lmod.layerGroup();

    const wr = getWorkingRoute();
    if (wr.stops.length > 0) {
      const cluster = new (Lmod as any).MarkerClusterGroup();
      wr.stops.forEach((s, idx) => {
        const color = paletteColor(idx);
        const icon = (Lmod as any).divIcon({
          className: 'custom-cluster-pin',
          html: `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};border:2px solid white"></span>`,
          iconSize: [14, 14]
        });
        const m = (Lmod as any).marker([s.lat, s.lon], { icon }).bindTooltip(`#${idx+1} ${s.label}`);
        cluster.addLayer(m);
      });
      layer.addLayer(cluster as any);
      const latlngs = wr.stops.map(s => [s.lat, s.lon]) as any;
      const poly = Lmod.polyline(latlngs, { color: '#888', weight: 2, opacity: 0.6 });
      layer.addLayer(poly as any);
      map.fitBounds(poly.getBounds(), { padding: [20, 20] });
    }

    (map as any)._miniLayer = layer;
    layer.addTo(map);
  }, [Lmod, mapRef.current, filteredSorted]);

  return (
    <main className="min-h-screen" style={{ background: 'var(--background)' }}>
      <section className="max-w-6xl mx-auto px-4 py-6">
        {/* Favorites header chip */}
        <div className="flex items-center justify-end mb-2">
          <button className="btn btn-outline" onClick={() => setShowFavs(v => !v)}>
            ★ Favorites ({favCount})
          </button>
        </div>

        {showFavs && (
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Your favorites</div>
              <div className="flex gap-2">
                <button className="btn btn-outline" onClick={onClearFavs}>Clear</button>
                <button className="btn" onClick={() => setShowFavs(false)}>Close</button>
              </div>
            </div>
            {favList.length === 0 ? (
              <div className="text-muted">No favorites yet. Tap ☆ on a sale to save it.</div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {favList.map((f) => (
                  <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <a href={f.url} target="_blank" rel="noreferrer" className="font-medium hover:underline block truncate">{f.title}</a>
                      {f.pubDate && <div className="text-xs text-muted truncate">{f.pubDate}</div>}
                    </div>
                    <button className="btn btn-outline" onClick={() => onRemoveFav(f.id)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Banners */}
        <div className="mb-3 space-y-2">
          {interestBanner && <div className="card">⭐ {interestBanner}</div>}
          {rainDays > 0 && <div className="card">🌧 Weather: Rain expected on {rainDays} day{rainDays===1?'':'s'} this week</div>}
        </div>

        {/* Mini Map */}
        <div className="card mb-4 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="font-semibold">Map preview</div>
            <Link href="/map" className="btn btn-outline">Open map</Link>
          </div>
          <div id="feed-mini-map" className="h-48 w-full" />
        </div>

        {/* Header + Filters */}
        <div className="card mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <input className="input flex-1 min-w-[200px]" placeholder="Search keywords (e.g., tools, vinyl)" value={q} onChange={(e) => setQ(e.target.value)} />
            <input className="input w-28" placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={useMyLocation} onChange={(e) => setUseMyLocation(e.target.checked)} /> Use my location</label>
            <label className="text-sm text-muted">Radius
              <input type="range" min={5} max={50} step={5} value={radiusMi} onChange={(e) => setRadiusMi(Number(e.target.value))} className="ml-2 align-middle" />
              <span className="ml-1 text-xs">{radiusMi} mi</span>
            </label>
            <label className="text-sm text-muted">Date
              <select className="input ml-2" value={datePreset} onChange={(e) => setDatePreset(e.target.value as any)}>
                <option value="today">Today</option>
                <option value="weekend">This weekend</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}
            <label className="text-sm text-muted">Type
              <select className="input ml-2" value={saleType} onChange={(e) => setSaleType(e.target.value)}>
                <option value="all">All</option>
                <option value="estate">Estate</option>
                <option value="garage">Garage</option>
                <option value="moving">Moving</option>
                <option value="yard">Yard</option>
                <option value="tag">Tag</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={onlyFavs} onChange={(e) => setOnlyFavs(e.target.checked)} /> Favorites only</label>
            <label className="text-sm text-muted">Sort
              <select className="input ml-2" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                <option value="best">Best Match</option>
                <option value="newest">Newest</option>
                <option value="closest">Closest</option>
                <option value="highest">Highest-rated</option>
              </select>
            </label>
            <button className="btn" onClick={resetToProfile}>Reset to profile</button>
          </div>
        </div>

        {/* Forecast: current week 7 days, highlight selected */}
        {forecast.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <div className="flex gap-3 min-w-max">
              {forecast.map((d, idx) => {
                const ic = weatherIcon(d.code);
                const md = new Date(d.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
                const selected = isSelectedDay(d.date);
                return (
                  <div key={idx} className="card" style={{ width: 120, border: selected ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                    <div className="text-sm text-muted mb-1">{d.label}</div>
                    <div className="text-xs text-muted mb-1">{md}</div>
                    <div className="text-3xl" aria-label={ic.label} title={ic.label}>{ic.glyph}</div>
                    <div className="text-sm mt-1"><strong>{d.hi}°</strong> / {d.lo}°</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Header badges */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold m-0">Sales</h1>
            {zip && (<span className="badge"><span className="badge-dot" /> ZIP {zip}</span>)}
            {!zip && <span className="badge"><span className="badge-dot" /> All ZIPs</span>}
            <span className="badge"><span className="badge-dot" /> {unified ? 'All providers' : `City: ${city}`}</span>
            {q && <span className="badge"><span className="badge-dot" /> “{q}”</span>}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn btn-outline">Home</Link>
            <Link href="/" className="btn btn-primary">New Search</Link>
          </div>
        </div>

        {loading && <div className="text-muted">Loading…</div>}
        {error && <div className="text-red-600">{error}</div>}

        {!loading && !error && (
          <>
            <div className="text-sm text-muted mb-3">{filteredSorted.length} result{filteredSorted.length === 1 ? '' : 's'}</div>
            {paged.length === 0 && (
              <div className="card">No sales found. Try widening the radius, changing the date, or updating your filters.</div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paged.map((sale, i) => (
                <SaleCard
                  key={`${sale.url || i}`}
                  sale={{
                    id: `${sale.url || i}`,
                    title: sale.title || '',
                    description: sale.description || '',
                    url: sale.url || '#',
                    start_date: sale.pubDate ?? '',
                  }}
                />
              ))}
            </div>
            {paged.length < filteredSorted.length && (
              <div className="text-center mt-4">
                <button className="btn" onClick={() => setPage((p) => p + 1)}>Load more</button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
