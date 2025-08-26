import { parseStringPromise } from "xml2js";

export async function fetchCraigslistRSS(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch RSS");
  const xml = await res.text();

  const parsed = await parseStringPromise(xml, { explicitArray: false });
  const items = parsed.rss.channel.item;

  return Array.isArray(items)
    ? items.map((item: any) => ({
        title: item.title,
        description: item.description,
        link: item.link,
        pubDate: item.pubDate,
      }))
    : [];
}
