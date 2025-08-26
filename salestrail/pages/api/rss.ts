import type { NextApiRequest, NextApiResponse } from "next";
import { parseStringPromise } from "xml2js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    const rssRes = await fetch(url);
    if (!rssRes.ok) throw new Error("Failed to fetch RSS");
    const xml = await rssRes.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed.rss.channel.item;
    const sales = Array.isArray(items)
      ? items.map((item: any) => ({
          title: item.title,
          description: item.description,
          link: item.link,
          pubDate: item.pubDate,
        }))
      : [];
    res.status(200).json(sales);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
}
