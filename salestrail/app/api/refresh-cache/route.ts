import { NextRequest } from 'next/server'
import { parseStringPromise } from 'xml2js'
import { cacheRSS } from '@/lib/rssCache'
import { updateRSSCache } from '@/lib/rssFetcher'
import type { RawRssItem, CitySale } from '@/lib/types'

const ALLOWED = (process.env.NEXT_PUBLIC_ALLOWED_CITIES || 'hartford,newyork,boston,providence')
  .split(',')
  .map(c => c.trim().toLowerCase())
  .filter(Boolean)

const SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const provided = searchParams.get('secret') || req.headers.get('x-api-key') || ''
  const expected = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const citiesParam = searchParams.get('cities')
  const cities = (citiesParam ? citiesParam.split(',') : ALLOWED).map(c => c.trim().toLowerCase()).filter(Boolean)

  const results: Record<string, { ok: boolean; count?: number; error?: string }> = {}

  await Promise.all(cities.map(async (city) => {
    try {
      const url = `https://${city}.craigslist.org/search/gms?format=rss`
      const rssRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SalesTrailBot/1.0; +https://salestrail.app)',
          'Accept': 'application/rss+xml,application/xml',
        },
      })
      if (!rssRes.ok) throw new Error(`Fetch failed ${rssRes.status}`)
      const xml = await rssRes.text()
      const parsed: { rss?: { channel?: { item?: RawRssItem | RawRssItem[] } } } = await parseStringPromise(xml, { explicitArray: false })
      const items = parsed?.rss?.channel?.item || []
      const sales: CitySale[] = (Array.isArray(items) ? items : [items]).filter(Boolean).map((item) => ({
        title: item?.title ?? '',
        description: item?.description,
        link: item?.link ?? '',
        pubDate: item?.pubDate,
      })).filter(s => s.title && s.link)
      await cacheRSS(`rss:${city}`, sales)
      results[city] = { ok: true, count: sales.length }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      results[city] = { ok: false, error: msg }
    }
  }))

  return new Response(JSON.stringify({ results }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!SECRET || token !== SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    // Retain any existing city warming (noop if removed elsewhere), then multi-source
    await updateRSSCache()
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}
