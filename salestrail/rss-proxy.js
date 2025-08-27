const express = require('express');
const cors = require('cors');
const { parseStringPromise } = require('xml2js');

const app = express();
app.use(cors());

function getUA() {
  const versions = ['127.0.0.0', '126.0.0.0', '125.0.0.0'];
  const v = versions[Math.floor(Math.random() * versions.length)];
  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`;
}

app.get('/rss', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const rssRes = await fetch(url, {
      headers: {
        'User-Agent': getUA(),
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!rssRes.ok) {
      const body = await rssRes.text().catch(() => '');
      const snippet = body ? body.slice(0, 300) : '';
      return res.status(502).json({ error: 'Upstream fetch failed', status: rssRes.status, snippet });
    }

    const xml = await rssRes.text();
    let parsed;
    try {
      parsed = await parseStringPromise(xml, { explicitArray: false });
    } catch {
      return res.status(500).json({ error: 'Failed to parse RSS XML' });
    }

    const items = parsed?.rss?.channel?.item || [];
    const arr = Array.isArray(items) ? items : [items];
    const sales = arr
      .filter(Boolean)
      .map((item) => ({
        title: item?.title,
        description: item?.description,
        link: item?.link,
        pubDate: item?.pubDate,
      }));

    res.json(sales);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
