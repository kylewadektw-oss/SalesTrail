'use client';

import { useMemo, useState, useEffect } from 'react';
import { defaultPreferences, loadPreferences, savePreferences, type Preferences } from '@/lib/preferences';
import { getWorkingRoute, setWorkingRoute } from '@/lib/workingRoute'

function buildGoogleMapsLink(stops: string[]): string {
  const clean = stops.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return 'https://www.google.com/maps';
  const enc = clean.map((s) => encodeURIComponent(s));
  const origin = encodeURIComponent('Current Location');
  if (enc.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${enc[0]}&travelmode=driving`;
  }
  const destination = enc[enc.length - 1];
  const waypoints = enc.slice(0, -1).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving&waypoints=${waypoints}`;
}

function buildAppleMapsLink(stops: string[]): string {
  const clean = stops.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return 'http://maps.apple.com/';
  const enc = clean.map((s) => encodeURIComponent(s));
  const saddr = encodeURIComponent('Current Location');
  if (enc.length === 1) {
    return `http://maps.apple.com/?saddr=${saddr}&daddr=${enc[0]}`;
  }
  // Apple Maps supports daddr with multiple 'to:' segments
  const daddr = enc.map((s, i) => (i === 0 ? s : `to:${s}`)).join('%20');
  return `http://maps.apple.com/?saddr=${saddr}&daddr=${daddr}`;
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`; // assume US if 10 digits
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (input.trim().startsWith('+')) return input.trim();
  return `+${digits}`; // best effort
}

function paletteColor(i: number) {
  const colors = ['#6366F1','#10B981','#F59E0B','#3B82F6','#EC4899','#84CC16','#06B6D4','#A855F7','#F97316','#14B8A6','#EAB308','#22C55E']
  return colors[i % colors.length]
}

export default function RoutePlannerPage() {
  const [stops, setStops] = useState<string[]>(['123 Main St, Hartford, CT', '45 Park Ave, Hartford, CT']);
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [totalSummary, setTotalSummary] = useState<string | null>(null);
  const [useGeoStart, setUseGeoStart] = useState(true);
  const [strategy, setStrategy] = useState<'distance' | 'balanced' | 'quality'>('distance');
  const [profilePrefs, setProfilePrefs] = useState<Preferences>(defaultPreferences);
  const [pagePrefs, setPagePrefs] = useState<Preferences>(defaultPreferences);

  const gmaps = useMemo(() => buildGoogleMapsLink(stops), [stops]);
  const amaps = useMemo(() => buildAppleMapsLink(stops), [stops]);

  const message = useMemo(() => {
    return `SalesTrail route:\nGoogle Maps: ${gmaps}\nApple Maps: ${amaps}`;
  }, [gmaps, amaps]);

  useEffect(() => {
    const p = loadPreferences();
    setProfilePrefs(p);
    setPagePrefs(p);
  }, []);

  // Load from working route on mount
  useEffect(() => {
    const wr = getWorkingRoute()
    if (wr.stops?.length) setStops(wr.stops.map(s => s.label))
  }, [])

  // Persist to working route whenever stops change
  useEffect(() => {
    const wrStops = stops.filter(Boolean).map((label) => ({ label, query: label, lat: 0, lon: 0 }))
    setWorkingRoute({ stops: wrStops, selectedIndex: null })
  }, [stops])

  // Keep in sync if changed elsewhere
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'salestrail:workingRoute:v1') {
        const wr = getWorkingRoute()
        setStops(wr.stops.map(s => s.label))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function resetToProfile() {
    setPagePrefs(profilePrefs);
  }

  function updateStop(i: number, value: string) {
    setStops((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  }

  function addStop() {
    setStops((prev) => [...prev, '']);
  }

  function removeStop(i: number) {
    setStops((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onDragStart(i: number) {
    setDragIndex(i);
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }
  function onDrop(i: number) {
    if (dragIndex === null || dragIndex === i) return;
    setStops((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIndex, 1);
      arr.splice(i, 0, moved);
      return arr;
    });
    setDragIndex(null);
  }

  async function sendSMS() {
    setSending(true);
    setStatus(null);
    setError(null);
    try {
      const to = normalizePhone(phone);
      if (!to) throw new Error('Enter a valid phone number');
      if (stops.map((s) => s.trim()).filter(Boolean).length === 0) {
        throw new Error('Add at least one stop');
      }
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body: message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send SMS');
      }
      setStatus('Text sent successfully');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(message).then(
      () => setStatus('Message copied to clipboard'),
      () => setError('Failed to copy message')
    );
  }

  async function autoGenerate() {
    setOptimizing(true);
    setError(null);
    setStatus(null);
    setTotalSummary(null);
    try {
      const cleanStops = stops.map((s) => s.trim()).filter(Boolean);
      if (cleanStops.length < 2) throw new Error('Add at least two stops');

      let origin: { lat: number; lon: number } | undefined = undefined;
      if (useGeoStart && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const coords = await new Promise<GeolocationPosition['coords']>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition((pos) => resolve(pos.coords), (err) => reject(err), { enableHighAccuracy: true, timeout: 8000 });
          });
          origin = { lat: coords.latitude, lon: coords.longitude };
        } catch {
          // Ignore geolocation failure, continue without origin
        }
      }

      const res = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stops: cleanStops,
          origin,
          strategy,
          unit: pagePrefs.unit,
          weights: pagePrefs.weights,
          constraints: pagePrefs.constraints,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to optimize route');

      const order: number[] = data.order || [];
      if (!order.length) throw new Error('No optimized order returned');
      setStops(order.map((idx: number) => cleanStops[idx]));
      if (data?.summary) setTotalSummary(data.summary);
      setStatus('Optimized best route');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
    } finally {
      setOptimizing(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="mb-2">Route Planner</h1>
      <p className="text-muted mb-6">Add your stops, generate a maps link, and send it to a phone via SMS.</p>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="mb-0">Stops</h2>
          <div className="flex gap-2">
            <button onClick={addStop} className="btn btn-outline">+ Add stop</button>
            <button onClick={autoGenerate} className="btn btn-primary" disabled={optimizing}>{optimizing ? 'Optimizing…' : 'Autogenerate best route'}</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mb-3 items-center">
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={useGeoStart} onChange={(e) => setUseGeoStart(e.target.checked)} /> Use my location as start</label>
          <label className="text-sm text-muted flex items-center gap-2">Strategy
            <select className="input" value={strategy} onChange={(e) => setStrategy(e.target.value as any)}>
              <option value="distance">Minimize driving</option>
              <option value="balanced">Balanced</option>
              <option value="quality">Maximize quality</option>
            </select>
          </label>
        </div>
        <div className="space-y-2">
          {stops.map((s, i) => (
            <div
              key={i}
              className="flex gap-2 items-center"
              onDragOver={onDragOver}
              onDrop={() => onDrop(i)}
            >
              <span
                className="cursor-grab select-none"
                title="Drag to reorder"
                draggable
                onDragStart={() => onDragStart(i)}
                onDragEnd={() => setDragIndex(null)}
              >
                ⋮⋮
              </span>
              <input
                className="input w-full"
                placeholder={`Stop #${i + 1} (address or place)`}
                value={s}
                onChange={(e) => updateStop(i, e.target.value)}
              />
              <button
                onClick={() => removeStop(i)}
                className="btn"
                aria-label={`Remove stop #${i + 1}`}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {totalSummary && <div className="text-sm text-muted mt-3">{totalSummary}</div>}
      </div>

      <div className="card mb-6">
        <h2>Preview links</h2>
        <div className="text-sm text-muted mb-2">These open the route in the recipient's maps app.</div>
        <ul className="list-disc pl-5">
          <li className="break-all"><a className="text-[var(--primary)] hover:underline" href={gmaps} target="_blank" rel="noopener noreferrer">Google Maps</a></li>
          <li className="break-all"><a className="text-[var(--primary)] hover:underline" href={amaps} target="_blank" rel="noopener noreferrer">Apple Maps</a></li>
        </ul>
        {stops.filter(Boolean).length > 0 && (
          <div className="mt-3">
            <div className="text-sm text-muted mb-1">Pin colors by order (shown on the Map page):</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {stops.filter(Boolean).map((s, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="inline-block w-3.5 h-3.5 rounded" style={{ background: paletteColor(idx) }} />
                  <span className="text-muted">#{idx + 1}</span>
                  <span className="truncate" title={s}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card mb-4">
        <h2>Send to phone</h2>
        <div className="flex flex-col gap-3 mt-2">
          <input
            className="input"
            type="tel"
            inputMode="tel"
            placeholder="Recipient phone (e.g., +15551234567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={sendSMS} className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send SMS'}</button>
            <button onClick={copyToClipboard} className="btn">Copy message</button>
          </div>
          <textarea className="input" rows={4} value={message} readOnly />
          {status && <div className="text-green-700">{status}</div>}
          {error && <div className="text-red-600">{error}</div>}
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="mb-2">Route preferences (this page)</h2>
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <label className="text-sm text-muted">Units
            <select className="input ml-2" value={pagePrefs.unit} onChange={(e) => setPagePrefs({ ...pagePrefs, unit: e.target.value as any })}>
              <option value="auto">Auto</option>
              <option value="mi">Miles</option>
              <option value="km">Kilometers</option>
            </select>
          </label>
          <label className="text-sm text-muted">Max stops
            <input className="input ml-2 w-24" type="number" min={1} value={pagePrefs.constraints.maxStops ?? ''} onChange={(e) => setPagePrefs({ ...pagePrefs, constraints: { ...pagePrefs.constraints, maxStops: e.target.value ? Number(e.target.value) : undefined } })} />
          </label>
          <button className="btn" onClick={resetToProfile}>Reset to profile settings</button>
        </div>
        <div className="grid md:grid-cols-5 gap-3">
          {(['distance','time','quality','weather','favorites'] as const).map((k) => (
            <div key={k}>
              <label className="block text-xs mb-1 capitalize">{k} ({Math.round((pagePrefs.weights as any)[k]*100)}%)</label>
              <input type="range" min={0} max={1} step={0.05} value={(pagePrefs.weights as any)[k]} onChange={(e) => setPagePrefs({ ...pagePrefs, weights: { ...pagePrefs.weights, [k]: Number(e.target.value) } })} className="w-full" />
            </div>
          ))}
        </div>
      </div>

      <p className="text-muted text-sm">Note: SMS sending requires server configuration (Twilio). If it's not set up, use "Copy message" or share the link directly.</p>
    </main>
  );
}
