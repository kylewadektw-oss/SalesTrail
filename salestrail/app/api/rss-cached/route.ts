import { NextRequest } from "next/server";
import { parseStringPromise } from "xml2js";
import { getCachedRSS, cacheRSS } from "@/lib/rssCache";

const TTL_SECONDS = 60 * 30; // 30 minutes
const ALLOWED = (process.env.NEXT_PUBLIC_ALLOWED_CITIES || 'hartford,newyork,boston,providence')
  .split(',')
  .map(c => c.trim().toLowerCase())
  .filter(Boolean);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let city = (searchParams.get("city") || "hartford").toLowerCase();
  if (!ALLOWED.includes(city)) city = 'hartford';
  const url = `https://${city}.craigslist.org/search/gms?format=rss`;
  const cacheKey = `rss:${city}`;

  try {
    // 1) Try cache
    const cached = await getCachedRSS(cacheKey, TTL_SECONDS);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) Fetch fresh
    const rssRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SaleTrailBot/1.0; +https://saletrail.app)",
        Accept: "application/rss+xml,application/xml",
      },
    });
    if (!rssRes.ok) throw new Error("Failed to fetch RSS");

    const xml = await rssRes.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed?.rss?.channel?.item || [];
    const sales = (Array.isArray(items) ? items : [items])
      .filter(Boolean)
      .map((item: any) => ({
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
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
