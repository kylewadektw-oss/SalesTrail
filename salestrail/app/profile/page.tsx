'use client';

import { useEffect, useState } from 'react';
import type { Preferences } from '@/lib/preferences';
import { CATEGORY_OPTIONS, type Category, type ShopperMode } from '@/lib/preferences';
import { defaultPreferences, loadPreferences, savePreferences } from '@/lib/preferences';

export default function ProfilePage() {
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  function save() {
    savePreferences(prefs);
    setSaved('Saved');
    setTimeout(() => setSaved(null), 1500);
  }

  function reset() {
    setPrefs(defaultPreferences);
  }

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="mb-2">Profile</h1>
      <p className="text-muted mb-6">Set your route planning preferences.</p>

      {/* Units */}
      <div className="card mb-6">
        <h2 className="mb-2">Units</h2>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm text-muted"><input type="radio" name="unit" checked={prefs.unit==='auto'} onChange={() => setPrefs({ ...prefs, unit: 'auto' })}/> Auto (based on locale)</label>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="radio" name="unit" checked={prefs.unit==='mi'} onChange={() => setPrefs({ ...prefs, unit: 'mi' })}/> Miles</label>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="radio" name="unit" checked={prefs.unit==='km'} onChange={() => setPrefs({ ...prefs, unit: 'km' })}/> Kilometers</label>
        </div>
      </div>

      {/* Shopper Identity / Mode */}
      <div className="card mb-6">
        <h2 className="mb-2">Shopper Mode</h2>
        <div className="flex flex-wrap gap-3">
          {([
            { id: 'treasure', label: 'Treasure Hunter' },
            { id: 'reseller', label: 'Reseller / Flipper' },
            { id: 'bargain', label: 'Bargain Hunter' },
            { id: 'casual', label: 'Casual Browser' },
          ] as { id: ShopperMode; label: string }[]).map(opt => (
            <label key={opt.id} className="flex items-center gap-2 text-sm text-muted">
              <input type="radio" name="mode" checked={prefs.mode===opt.id} onChange={() => setPrefs({ ...prefs, mode: opt.id })} /> {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Category Interests */}
      <div className="card mb-6">
        <h2 className="mb-2">Category Interests</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((c) => {
            const checked = prefs.categories.includes(c)
            return (
              <label key={c} className={`px-3 py-1 rounded border cursor-pointer ${checked ? 'bg-[var(--primary)] text-white' : 'bg-transparent'}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...prefs.categories, c]
                      : prefs.categories.filter(x => x !== c)
                    setPrefs({ ...prefs, categories: next })
                  }}
                />
                {c}
              </label>
            )
          })}
        </div>
      </div>

      {/* Travel Radius / Style */}
      <div className="card mb-6">
        <h2 className="mb-2">Travel Radius / Route Style</h2>
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <label className="text-sm text-muted">Style
            <select className="input ml-2" value={prefs.travel.style} onChange={(e) => setPrefs({ ...prefs, travel: { ...prefs.travel, style: e.target.value as any } })}>
              <option value="local">Local Shopper (5–10 mi)</option>
              <option value="city">City-Wide (25–30 mi)</option>
              <option value="road">Road Tripper (50+ mi)</option>
            </select>
          </label>
          <label className="text-sm text-muted">Radius (mi)
            <input className="input ml-2 w-24" type="number" min={1} value={prefs.travel.radiusMi} onChange={(e) => setPrefs({ ...prefs, travel: { ...prefs.travel, radiusMi: Number(e.target.value) } })} />
          </label>
        </div>
        <p className="text-xs text-muted">UI Impact: default map zoom, hide outside radius, planner includes only within-radius stops.</p>
      </div>

      {/* Time of Day Preference */}
      <div className="card mb-6">
        <h2 className="mb-2">Time of Day</h2>
        <div className="flex gap-3">
          {([
            { id: 'early', label: 'Early Bird' },
            { id: 'midday', label: 'Midday Browser' },
            { id: 'flex', label: 'Flexible' },
          ] as const).map(opt => (
            <label key={opt.id} className="flex items-center gap-2 text-sm text-muted">
              <input type="radio" name="timeOfDay" checked={prefs.timeOfDay===opt.id} onChange={() => setPrefs({ ...prefs, timeOfDay: opt.id })} /> {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Weather Sensitivity */}
      <div className="card mb-6">
        <h2 className="mb-2">Weather Sensitivity</h2>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm text-muted"><input type="radio" name="wx" checked={prefs.weatherSensitivity==='fair'} onChange={() => setPrefs({ ...prefs, weatherSensitivity: 'fair' })}/> Fair-Weather Only</label>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="radio" name="wx" checked={prefs.weatherSensitivity==='all'} onChange={() => setPrefs({ ...prefs, weatherSensitivity: 'all' })}/> All-Weather Shopper</label>
        </div>
      </div>

      {/* Display Preferences */}
      <div className="card mb-6">
        <h2 className="mb-2">Display</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-muted">Default Tab
            <select className="input ml-2" value={prefs.display.defaultTab} onChange={(e) => setPrefs({ ...prefs, display: { ...prefs.display, defaultTab: e.target.value as any } })}>
              <option value="feed">Feed</option>
              <option value="map">Map</option>
              <option value="route">Route</option>
            </select>
          </label>
          <label className="text-sm text-muted">View Style
            <select className="input ml-2" value={prefs.display.view} onChange={(e) => setPrefs({ ...prefs, display: { ...prefs.display, view: e.target.value as any } })}>
              <option value="grid">Card grid</option>
              <option value="compact">Compact list</option>
            </select>
          </label>
          <label className="text-sm text-muted">Theme
            <select className="input ml-2" value={prefs.display.theme} onChange={(e) => setPrefs({ ...prefs, display: { ...prefs.display, theme: e.target.value as any } })}>
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </div>

      {/* Community & Social */}
      <div className="card mb-6">
        <h2 className="mb-2">Community & Social</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={prefs.social.showRatings} onChange={(e) => setPrefs({ ...prefs, social: { ...prefs.social, showRatings: e.target.checked } })}/> Show Ratings/Reviews</label>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={prefs.social.showFinds} onChange={(e) => setPrefs({ ...prefs, social: { ...prefs.social, showFinds: e.target.checked } })}/> Show Finds of the Week</label>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={prefs.social.privateMode} onChange={(e) => setPrefs({ ...prefs, social: { ...prefs.social, privateMode: e.target.checked } })}/> Private Mode</label>
        </div>
      </div>

      {/* Alerts & Favorites */}
      <div className="card mb-6">
        <h2 className="mb-2">Alerts & Favorites</h2>
        <div className="flex flex-wrap gap-3 items-center mb-2">
          <label className="text-sm text-muted">Auto-favorite by keywords
            <input className="input ml-2" placeholder="e.g., tools, vintage, lego" value={prefs.alerts.autoFavoriteKeywords} onChange={(e) => setPrefs({ ...prefs, alerts: { ...prefs.alerts, autoFavoriteKeywords: e.target.value } })}/>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={prefs.alerts.push} onChange={(e) => setPrefs({ ...prefs, alerts: { ...prefs.alerts, push: e.target.checked } })}/> Push</label>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={prefs.alerts.email} onChange={(e) => setPrefs({ ...prefs, alerts: { ...prefs.alerts, email: e.target.checked } })}/> Email</label>
        </div>
        <label className="block text-sm mb-1">Smart Alerts Threshold ({Math.round(prefs.alerts.smartThreshold*100)}%)</label>
        <input type="range" min={0} max={1} step={0.05} value={prefs.alerts.smartThreshold} onChange={(e) => setPrefs({ ...prefs, alerts: { ...prefs.alerts, smartThreshold: Number(e.target.value) } })} className="w-full" />
      </div>

      {/* Weights */}
      <div className="card mb-6">
        <h2 className="mb-2">Weights</h2>
        {(['distance','time','quality','weather','favorites'] as const).map((k) => (
          <div key={k} className="mb-3">
            <label className="block text-sm mb-1 capitalize">{k} ({Math.round(prefs.weights[k]*100)}%)</label>
            <input type="range" min={0} max={1} step={0.05} value={prefs.weights[k]} onChange={(e) => setPrefs({ ...prefs, weights: { ...prefs.weights, [k]: Number(e.target.value) } })} className="w-full" />
          </div>
        ))}
        <p className="text-xs text-muted">Tip: Ensure your weights roughly add up to 1.0</p>
      </div>

      {/* Constraints */}
      <div className="card mb-6">
        <h2 className="mb-2">Constraints</h2>
        <label className="block text-sm mb-2">Max stops (optional)</label>
        <input className="input w-40" type="number" min={1} placeholder="e.g., 8" value={prefs.constraints.maxStops ?? ''} onChange={(e) => setPrefs({ ...prefs, constraints: { ...prefs.constraints, maxStops: e.target.value ? Number(e.target.value) : undefined } })} />
      </div>

      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={save}>Save</button>
        <button className="btn" onClick={reset}>Reset to defaults</button>
        {saved && <div className="text-green-700">{saved}</div>}
      </div>
    </main>
  );
}
