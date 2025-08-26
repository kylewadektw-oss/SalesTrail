import { NextRequest } from "next/server";
import { parseStringPromise } from "xml2js";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

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
