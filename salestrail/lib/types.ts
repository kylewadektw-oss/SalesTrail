export type RawRssItem = {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  'dc:date'?: string;
};

// Minimal shape returned by city-based Craigslist endpoint
export type CitySale = {
  title: string;
  description?: string;
  link: string;
  pubDate?: string;
};

// Normalized unified sale across providers
export type UnifiedSale = {
  id: string;
  title: string;
  description: string;
  url: string;
  pubDate: string | null;
  source: string;
  location: string;
};

// UI-friendly shape consumed on the homepage (supports both city + unified)
export type UxSale = {
  title: string;
  description?: string;
  url?: string;
  link?: string;
  pubDate?: string | null;
};
