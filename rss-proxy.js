const express = require('express');
const cors = require('cors');
const { parseStringPromise } = require('xml2js');

const app = express();
app.use(cors());

function withTimeout(ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
}

function ua() {
  const chromeBuilds = ['125.0.0.0', '126.0.0.0', '127.0.0.0'];
  const ver = chromeBuilds[Math.floor(Math.random() * chromeBuilds.length)];
  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
}

app.get('/rss', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  const { signal, cancel } = withTimeout(10000);
  try {
    const rssRes = await fetch(url, {
      headers: {
        'User-Agent': ua(),
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
      signal,
    });
    cancel();

    if (!rssRes.ok) {
      const body = await rssRes.text().catch(() => '');
      const snippet = body?.slice(0, 300);
      return res.status(502).json({
        error: 'Upstream fetch failed',
        status: rssRes.status,
        snippet,
      });
    }

    const xml = await rssRes.text();
    let parsed;
    try {
      parsed = await parseStringPromise(xml, { explicitArray: false });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to parse RSS XML' });
    }

    const items = parsed?.rss?.channel?.item || [];
    const arr = Array.isArray(items) ? items : [items];
    const sales = arr
      .filter(Boolean)
      .map((item) => ({
        title: item.title,
        description: item.description,
        link: item.link,
        pubDate: item.pubDate,
      }));

    return res.json(sales);
  } catch (e) {
    const isAbort = e?.name === 'AbortError';
    return res.status(500).json({ error: isAbort ? 'Fetch timeout' : e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
