export type RssFeedConfig = {
  key: string;
  source: string;
  location: string;
  url: string;
};

export const RSS_FEEDS: RssFeedConfig[] = [
  {
    key: "craigslist-hartford",
    source: "craigslist",
    location: "Hartford, CT",
    url: "https://hartford.craigslist.org/search/gms?format=rss",
  },
  {
    key: "estatesales-ct",
    source: "estatesales.net",
    location: "Connecticut",
    url: "https://www.estatesales.net/rss?state=CT",
  },
  {
    key: "gsalr-hartford",
    source: "gsalr.com",
    location: "Hartford, CT",
    url: "https://gsalr.com/rss?city=Hartford&state=CT",
  },
  {
    key: "yardsalesearch-hartford",
    source: "yardsalesearch",
    location: "Hartford, CT",
    url: "https://www.yardsalesearch.com/rss.xml?city=Hartford&state=CT",
  },
];
