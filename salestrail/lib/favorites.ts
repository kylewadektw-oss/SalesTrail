const LS_KEY = 'salestrail:favorites:v1'
const LS_META_KEY = 'salestrail:favoritesMeta:v1'

function load(): Record<string, true> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function save(map: Record<string, true>) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(map)) } catch {}
}

function loadMeta(): Record<string, { title: string; url: string; description?: string; pubDate?: string | null; savedAt: number }> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_META_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveMeta(map: Record<string, { title: string; url: string; description?: string; pubDate?: string | null; savedAt: number }>) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(LS_META_KEY, JSON.stringify(map)) } catch {}
}

export function isFavorite(id: string): boolean {
  const map = load()
  return !!map[id]
}

export function toggleFavorite(id: string, meta?: { title: string; url: string; description?: string; pubDate?: string | null }): boolean {
  const map = load()
  const metaMap = loadMeta()
  if (map[id]) {
    delete map[id]
    delete metaMap[id]
    save(map)
    saveMeta(metaMap)
    return false
  } else {
    map[id] = true
    if (meta) {
      metaMap[id] = { ...meta, savedAt: Date.now() }
    } else if (!metaMap[id]) {
      // ensure a placeholder exists
      metaMap[id] = { title: id, url: id, savedAt: Date.now() }
    }
    save(map)
    saveMeta(metaMap)
    return true
  }
}

export function listFavorites(): string[] {
  return Object.keys(load())
}

export function listFavoriteDetails(): Array<{ id: string; title: string; url: string; description?: string; pubDate?: string | null; savedAt: number }> {
  const ids = load()
  const meta = loadMeta()
  return Object.keys(ids)
    .map((id) => ({ id, ...(meta[id] || { title: id, url: id, savedAt: 0 }) }))
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
}

export function removeFavorite(id: string) {
  const map = load()
  const meta = loadMeta()
  if (map[id]) delete map[id]
  if (meta[id]) delete meta[id]
  save(map)
  saveMeta(meta)
}

export function clearFavorites() {
  save({})
  saveMeta({})
}

export function countFavorites(): number {
  return Object.keys(load()).length
}
