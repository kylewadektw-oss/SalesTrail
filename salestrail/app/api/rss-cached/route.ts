import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServerClient";
import { parseStringPromise } from "xml2js";

// Cache sales for 30 minutes per city to avoid hammering external feeds
const TTL_SECONDS = 60 * 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "hartford";
  const url = searchParams.get("url") || `https://${city}.craigslist.org/search/gms?format=rss`;

  const cacheKey = `rss:${city}`;

  try {
    // 1) Try cache
    const { data: cached, error: cacheErr } = await supabaseAdmin
      .from('rss_cache')
      .select('payload, updated_at')
      .eq('key', cacheKey)
      .maybeSingle();

    const now = Date.now();
    if (cached && cached.updated_at && (now - new Date(cached.updated_at).getTime()) / 1000 < TTL_SECONDS) {
      return new Response(cached.payload, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 2) Fetch fresh
    const rssRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaleTrailBot/1.0; +https://saletrail.app)',
        'Accept': 'application/rss+xml,application/xml',
      },
    });
    if (!rssRes.ok) throw new Error('Failed to fetch RSS');
    const xml = await rssRes.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed?.rss?.channel?.item || [];

    const sales = (Array.isArray(items) ? items : [items]).filter(Boolean).map((item: any) => ({
      title: item.title,
      description: item.description,
      link: item.link,
      pubDate: item.pubDate,
    }));

    const payload = JSON.stringify(sales);

    // 3) Upsert cache
    await supabaseAdmin
      .from('rss_cache')
      .upsert({ key: cacheKey, payload }, { onConflict: 'key' });

    return new Response(payload, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
