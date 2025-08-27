import { NextRequest } from "next/server";
import { parseStringPromise } from "xml2js";
import type { RawRssItem, CitySale } from "@/lib/types";

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
      redirect: "follow",
    });

    if (!rssRes.ok) {
      const body = await rssRes.text().catch(() => "");
      const snippet = body?.slice(0, 300);
      return new Response(
        JSON.stringify({ error: "Upstream fetch failed", status: rssRes.status, snippet }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const xml = await rssRes.text();
    let parsed: { rss?: { channel?: { item?: RawRssItem | RawRssItem[] } } } | undefined;
    try {
      parsed = await parseStringPromise(xml, { explicitArray: false });
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse RSS XML" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const items = parsed?.rss?.channel?.item || [];
    const arr = Array.isArray(items) ? items : [items];
    const sales: CitySale[] = arr
      .filter(Boolean)
      .map((item) => ({
        title: item?.title ?? "",
        description: item?.description,
        link: item?.link ?? "",
        pubDate: item?.pubDate,
      }))
      .filter((s) => s.title && s.link);

    return new Response(JSON.stringify(sales), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
