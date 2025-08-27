import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

function ok(json: any, status = 200) {
  return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } })
}
function bad(error: string, status = 400) {
  return ok({ error }, status)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const zip = (searchParams.get('zip') || '').trim()
  const q = (searchParams.get('q') || '').trim()
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return bad('Google Maps API key not configured', 501)
  const address = zip || q
  if (!address) return bad('Missing zip or q')

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const res = await fetch(url)
  if (!res.ok) return bad(`Geocoding failed ${res.status}`, 502)
  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.length) return bad('No geocode result', 404)
  const first = data.results[0]
  const loc = first?.geometry?.location
  const formatted = first?.formatted_address || address
  if (!loc) return bad('Invalid geocode response', 502)
  return ok({ lat: loc.lat, lon: loc.lng, raw: { label: formatted } })
}
