import 'server-only'
import { supabaseAdmin, SUPABASE_ENABLED } from '@/lib/supabaseServerClient'

export async function getCachedRSS(key: string, ttlSeconds: number) {
  if (!SUPABASE_ENABLED) return null
  const { data, error } = await supabaseAdmin
    .from('rss_cache')
    .select('payload, updated_at')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    console.error('Error fetching cache:', error)
    return null
  }
  if (!data) return null

  const ageSec = (Date.now() - new Date(data.updated_at as unknown as string).getTime()) / 1000
  if (ageSec > ttlSeconds) return null

  try {
    return JSON.parse(data.payload as unknown as string)
  } catch {
    return null
  }
}

export async function cacheRSS(key: string, payload: any) {
  if (!SUPABASE_ENABLED) return
  const { error } = await supabaseAdmin
    .from('rss_cache')
    .upsert({ key, payload: JSON.stringify(payload) }, { onConflict: 'key' })

  if (error) {
    console.error('Error caching RSS:', error)
  }
}
