const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { parseStringPromise } = require('xml2js');

const app = express();
app.use(cors());

app.get('/rss', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    const rssRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaleTrailBot/1.0; +https://saletrail.app)',
        'Accept': 'application/rss+xml,application/xml',
      },
    });
    if (!rssRes.ok) throw new Error('Failed to fetch RSS');
    const xml = await rssRes.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed.rss.channel.item;
    const sales = Array.isArray(items)
      ? items.map(item => ({
          title: item.title,
          description: item.description,
          link: item.link,
          pubDate: item.pubDate,
        }))
      : [];
    res.json(sales);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
