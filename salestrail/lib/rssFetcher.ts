import { parseStringPromise } from "xml2js";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabaseServerClient";
import { RSS_FEEDS } from "./rssSources";

async function fetchRSS(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      "Accept": "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.google.com/",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch RSS: ${res.status}`);
  const xml = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false });
  return parsed?.rss?.channel?.item ?? [];
}

export async function fetchUnifiedLive() {
  const results: any[] = [];
  await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        const items = await fetchRSS(feed.url);
        const arr = Array.isArray(items) ? items : [items];
        const normalized = arr.filter(Boolean).map((item: any, i: number) => ({
          id: `${feed.key}-${i}`,
          title: item.title,
          description: item.description || "",
          url: item.link,
          pubDate: item.pubDate || item["dc:date"] || null,
          source: feed.source,
          location: feed.location,
        }));
        results.push(...normalized);
      } catch (e) {
        // ignore individual feed failures
      }
    })
  );
  return results.sort(
    (a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime()
  );
}

export async function updateRSSCache() {
  if (!SUPABASE_ENABLED) {
    console.warn("Supabase disabled; skipping cache update.");
    return;
  }
  for (const feed of RSS_FEEDS) {
    try {
      const items = await fetchRSS(feed.url);
      const arr = Array.isArray(items) ? items : [items];

      const normalized = arr.filter(Boolean).map((item: any, i: number) => ({
        id: `${feed.key}-${i}`,
        title: item.title,
        description: item.description || "",
        url: item.link,
        pubDate: item.pubDate || item["dc:date"] || null,
        source: feed.source,
        location: feed.location,
      }));

      await supabaseAdmin.from("rss_cache").upsert(
        {
          key: feed.key,
          source: feed.source,
          location: feed.location,
          payload: JSON.stringify(normalized),
        },
        { onConflict: "key" }
      );

      console.log(`Cached ${normalized.length} from ${feed.key}`);
    } catch (err) {
      console.error(`Error fetching ${feed.key}:`, err);
    }
  }
}

export async function getUnifiedSales() {
  if (!SUPABASE_ENABLED) return [] as any[];

  const { data, error } = await supabaseAdmin
    .from("rss_cache")
    .select("key, source, location, payload, updated_at");

  if (error) throw error;

  let allSales: any[] = [];
  for (const row of data || []) {
    try {
      const parsed = JSON.parse((row as any).payload);
      allSales = allSales.concat(parsed);
    } catch {}
  }
  return allSales.sort(
    (a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime()
  );
}
