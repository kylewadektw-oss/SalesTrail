import { parseStringPromise } from "xml2js";
import type { RawRssItem, CitySale } from "@/lib/types";

export async function fetchCraigslistRSS(url: string): Promise<CitySale[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch RSS");
  const xml = await res.text();

  const parsed: { rss?: { channel?: { item?: RawRssItem | RawRssItem[] } } } = await parseStringPromise(xml, { explicitArray: false });
  const items = parsed?.rss?.channel?.item;

  return Array.isArray(items)
    ? items
        .filter(Boolean)
        .map((item) => ({
          title: item?.title ?? '',
          description: item?.description,
          link: item?.link ?? '',
          pubDate: item?.pubDate,
        }))
        .filter((s) => s.title && s.link)
    : [];
}
