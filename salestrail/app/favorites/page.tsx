'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { listFavoriteDetails, removeFavorite, clearFavorites, countFavorites, isFavorite, toggleFavorite } from '@/lib/favorites'

type FavItem = {
  id: string
  title: string
  url: string
  description?: string
  pubDate?: string | null
  savedAt: number
}

export default function FavoritesPage() {
  const params = useSearchParams()
  const [favs, setFavs] = useState<FavItem[]>(listFavoriteDetails())
  const [q, setQ] = useState('')
  const [sortBy, setSortBy] = useState<'saved' | 'title' | 'pub'>('saved')
  const [asc, setAsc] = useState(false)

  // Import preview state
  const [importPreview, setImportPreview] = useState<FavItem[] | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // keep in sync if localStorage changes in other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes('salestrail:favorites')) {
        setFavs(listFavoriteDetails())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Check for import payload in query string
  useEffect(() => {
    try {
      const payload = params?.get('import')
      if (!payload) { setImportPreview(null); setImportError(null); return }
      const data = decodePayload(payload)
      if (!Array.isArray(data)) { setImportError('Invalid import data'); setImportPreview(null); return }
      // Normalize to FavItem-like with minimal fields
      const preview: FavItem[] = data.map((d: any) => ({
        id: String(d.url || d.id || ''),
        title: String(d.title || d.url || ''),
        url: String(d.url || d.id || ''),
        description: typeof d.description === 'string' ? d.description : undefined,
        pubDate: typeof d.pubDate === 'string' ? d.pubDate : undefined,
        savedAt: Date.now(),
      })).filter(it => it.url)
      setImportPreview(preview)
      setImportError(null)
    } catch (e) {
      setImportError('Failed to parse import link')
      setImportPreview(null)
    }
  }, [params])

  function refresh() {
    setFavs(listFavoriteDetails())
  }

  function formatDate(s?: string | null) {
    if (!s) return ''
    const d = new Date(s)
    return isNaN(d.getTime()) ? s : d.toLocaleString()
  }

  function formatSavedAt(n: number) {
    if (!n) return ''
    const d = new Date(n)
    return d.toLocaleString()
  }

  function domainOf(u: string) {
    try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' }
  }

  const filteredSorted = useMemo(() => {
    let list = favs
    if (q.trim()) {
      const qq = q.toLowerCase()
      list = list.filter(f => `${f.title} ${f.description || ''} ${f.url}`.toLowerCase().includes(qq))
    }
    list = [...list]
    list.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'saved') cmp = (a.savedAt || 0) - (b.savedAt || 0)
      if (sortBy === 'pub') cmp = (Date.parse(a.pubDate || '') || 0) - (Date.parse(b.pubDate || '') || 0)
      if (sortBy === 'title') cmp = a.title.localeCompare(b.title)
      return asc ? cmp : -cmp
    })
    return list
  }, [favs, q, sortBy, asc])

  function addToRoute(title: string) {
    try {
      const key = 'salestrail:routeDraft:v1'
      const raw = window.localStorage.getItem(key)
      const arr: string[] = raw ? JSON.parse(raw) : []
      if (title && !arr.includes(title)) arr.push(title)
      window.localStorage.setItem(key, JSON.stringify(arr))
    } catch {}
  }

  function addAllToRoute(items: FavItem[]) {
    try {
      const key = 'salestrail:routeDraft:v1'
      const raw = window.localStorage.getItem(key)
      const set = new Set<string>(raw ? JSON.parse(raw) : [])
      for (const f of items) if (f.title) set.add(f.title)
      window.localStorage.setItem(key, JSON.stringify(Array.from(set)))
      alert('Added to route draft')
    } catch {}
  }

  function copyLinks(items: FavItem[]) {
    const text = items.map(f => f.url).join('\n')
    navigator.clipboard?.writeText(text).then(() => alert('Links copied')).catch(() => {})
  }

  function exportCSV(items: FavItem[]) {
    const header = ['title', 'url', 'pubDate', 'savedAt']
    const rows = items.map(f => [
      escapeCSV(f.title),
      escapeCSV(f.url),
      escapeCSV(f.pubDate || ''),
      escapeCSV(new Date(f.savedAt).toISOString()),
    ].join(','))
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'salestrail-favorites.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function escapeCSV(v: string) {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) return '"' + v.replace(/"/g, '""') + '"'
    return v
  }

  // Open all in new tabs (may be blocked by pop-up blocker)
  function openAll(items: FavItem[]) {
    let opened = 0
    for (const f of items) {
      const win = window.open(f.url, '_blank', 'noopener')
      if (win) opened++
    }
    if (opened < items.length) alert(`Opened ${opened}/${items.length} tabs. Your browser may have blocked pop-ups.`)
  }

  // Share favorites: generate a link with import payload
  function shareLink(items: FavItem[]) {
    try {
      const payload = items.map(f => ({ title: f.title, url: f.url, pubDate: f.pubDate }))
      const enc = encodePayload(payload)
      const link = `${window.location.origin}/favorites?import=${enc}`
      navigator.clipboard?.writeText(link).then(() => alert('Share link copied')).catch(() => { alert(link) })
    } catch {
      // fallback
    }
  }

  // Import merge
  function importAll(preview: FavItem[]) {
    let added = 0
    for (const f of preview) {
      if (!isFavorite(f.url)) {
        toggleFavorite(f.url, { title: f.title, url: f.url, description: f.description, pubDate: f.pubDate })
        added++
      }
    }
    setImportPreview(null)
    setImportError(null)
    refresh()
    alert(`Imported ${added} item${added===1?'':'s'}`)
  }

  // Base64 helpers with Unicode support
  function encodePayload(obj: any): string {
    const json = JSON.stringify(obj)
    const uint8 = new TextEncoder().encode(json)
    let bin = ''
    uint8.forEach(b => bin += String.fromCharCode(b))
    return btoa(bin)
  }
  function decodePayload(b64: string): any {
    const bin = atob(b64)
    const buf = new Uint8Array([...bin].map(ch => ch.charCodeAt(0)))
    const json = new TextDecoder().decode(buf)
    return JSON.parse(json)
  }

  function onRemove(id: string) {
    removeFavorite(id)
    refresh()
  }

  function onClear() {
    if (confirm('Clear all favorites?')) {
      clearFavorites()
      refresh()
    }
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--background)' }}>
      <section className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold m-0">★ Favorites</h1>
            <span className="badge">{countFavorites()} saved</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/feed" className="btn btn-outline">Back to Feed</Link>
          </div>
        </div>

        {importError && (
          <div className="card mb-4 text-red-600">{importError}</div>
        )}
        {importPreview && importPreview.length > 0 && (
          <div className="card mb-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">Import preview</div>
                <div className="text-sm text-muted">{importPreview.length} favorite{importPreview.length===1?'':'s'} in link</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn" onClick={() => importAll(importPreview)}>Merge into my favorites</button>
                <button className="btn btn-outline" onClick={() => setImportPreview(null)}>Dismiss</button>
              </div>
            </div>
          </div>
        )}

        <div className="card mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <input className="input flex-1 min-w-[220px]" placeholder="Search favorites" value={q} onChange={e => setQ(e.target.value)} />
            <label className="text-sm text-muted">Sort by
              <select className="input ml-2" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                <option value="saved">Saved</option>
                <option value="pub">Published</option>
                <option value="title">Title</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={asc} onChange={e => setAsc(e.target.checked)} /> Ascending
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button className="btn" onClick={() => addAllToRoute(filteredSorted)}>Add all to Route</button>
              <button className="btn btn-outline" onClick={() => openAll(filteredSorted)}>Open all</button>
              <button className="btn btn-outline" onClick={() => copyLinks(filteredSorted)}>Copy links</button>
              <button className="btn btn-outline" onClick={() => shareLink(filteredSorted)}>Share link</button>
              <button className="btn btn-outline" onClick={() => exportCSV(filteredSorted)}>Export CSV</button>
              <button className="btn btn-outline" onClick={onClear}>Clear all</button>
            </div>
          </div>
        </div>

        {filteredSorted.length === 0 ? (
          <div className="card">
            <div className="mb-2">No favorites yet.</div>
            <Link className="btn" href="/feed">Browse sales</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredSorted.map((f) => (
              <li key={f.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={f.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline truncate max-w-[60ch]">{f.title}</a>
                      {domainOf(f.url) && <span className="badge">{domainOf(f.url)}</span>}
                    </div>
                    <div className="text-xs text-muted mt-1 flex items-center gap-3 flex-wrap">
                      {f.pubDate && <span>Published: {formatDate(f.pubDate)}</span>}
                      <span>Saved: {formatSavedAt(f.savedAt)}</span>
                    </div>
                    {f.description && (
                      <p className="text-sm text-[var(--foreground)]/80 mt-2 whitespace-pre-line">{f.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button className="btn" onClick={() => addToRoute(f.title)}>+ Route</button>
                    <button className="btn btn-outline" onClick={() => onRemove(f.id)}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
