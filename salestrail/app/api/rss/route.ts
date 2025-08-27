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
    const rssRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: 'follow',
    });

    if (!rssRes.ok) {
      const body = await rssRes.text().catch(() => '');
      const snippet = body?.slice(0, 300);
      return new Response(
        JSON.stringify({ error: "Upstream fetch failed", status: rssRes.status, snippet }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const xml = await rssRes.text();
    let parsed: any;
    try {
      parsed = await parseStringPromise(xml, { explicitArray: false });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to parse RSS XML" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const items = parsed?.rss?.channel?.item || [];
    const arr = Array.isArray(items) ? items : [items];
    const sales = arr
      .filter(Boolean)
      .map((item: any) => ({
        title: item.title,
        description: item.description,
        link: item.link,
        pubDate: item.pubDate,
      }));

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
