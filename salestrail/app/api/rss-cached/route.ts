import { NextRequest } from "next/server";
import { parseStringPromise } from "xml2js";
import { getCachedRSS, cacheRSS } from "@/lib/rssCache";
import { getUnifiedSales, fetchUnifiedLive } from "@/lib/rssFetcher";
import { SUPABASE_ENABLED } from "@/lib/supabaseServerClient";

const TTL_SECONDS = 60 * 30; // 30 minutes
const ALLOWED = (process.env.NEXT_PUBLIC_ALLOWED_CITIES || 'hartford,newyork,boston,providence')
  .split(',')
  .map(c => c.trim().toLowerCase())
  .filter(Boolean);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const unified = searchParams.get('unified');
  if (unified === 'true') {
    try {
      const sales = SUPABASE_ENABLED ? await getUnifiedSales() : await fetchUnifiedLive();
      return new Response(JSON.stringify(sales), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  let city = (searchParams.get("city") || "hartford").toLowerCase();
  if (!ALLOWED.includes(city)) city = 'hartford';
  const url = `https://${city}.craigslist.org/search/gms?format=rss`;
  const cacheKey = `rss:${city}`;
  const proxyBase = process.env.NEXT_PUBLIC_PROXY_BASE_URL || 'http://localhost:4000';
  const proxyBase2 = process.env.NEXT_PUBLIC_PROXY_BASE_URL_2 || '';

  try {
    // 1) Try cache
    const cached = await getCachedRSS(cacheKey, TTL_SECONDS);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) Fetch fresh (direct)
    try {
      const rssRes = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "application/rss+xml,application/xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.google.com/",
        },
      });
      if (!rssRes.ok) throw new Error(`Upstream ${rssRes.status}`);
      const xml = await rssRes.text();
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const items = parsed?.rss?.channel?.item || [];
      const arr = Array.isArray(items) ? items : [items];
      const sales = arr.filter(Boolean).map((item: any) => ({
        title: item.title,
        description: item.description,
        link: item.link,
        pubDate: item.pubDate,
      }));

      await cacheRSS(cacheKey, sales);
      return new Response(JSON.stringify(sales), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (directErr) {
      // 3) Proxy fallback(s)
      let proxied = await fetch(`${proxyBase}/rss?url=${encodeURIComponent(url)}`);
      if (!proxied.ok && proxyBase2) {
        proxied = await fetch(`${proxyBase2}/rss?url=${encodeURIComponent(url)}`);
      }
      if (!proxied.ok) throw new Error(`Proxy failed ${proxied.status}`);
      const sales = await proxied.json();
      await cacheRSS(cacheKey, sales);
      return new Response(JSON.stringify(sales), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
