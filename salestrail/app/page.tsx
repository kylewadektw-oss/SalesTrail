'use client';
import Link from "next/link";
import { useEffect, useState } from "react";
import SaleCard from "@/components/SaleCard";
import type { UxSale } from "@/lib/types";

// Simple preset of supported cities with coordinates for weather lookup
const CITY_PRESETS: Record<string, { label: string; lat: number; lon: number }>
  = {
    hartford: { label: "Hartford, CT", lat: 41.7658, lon: -72.6734 },
    newyork: { label: "New York, NY", lat: 40.7128, lon: -74.0060 },
    boston: { label: "Boston, MA", lat: 42.3601, lon: -71.0589 },
    providence: { label: "Providence, RI", lat: 41.8240, lon: -71.4128 },
  };

export default function Home() {
  const [sales, setSales] = useState<UxSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState<keyof typeof CITY_PRESETS>("hartford");
  const [weather, setWeather] = useState<string | undefined>(undefined);
  const [useUnified, setUseUnified] = useState(false);

  // Prefer env-based proxy URL for production; fall back to localhost for dev
  const proxyBase = process.env.NEXT_PUBLIC_PROXY_BASE_URL || "http://localhost:4000";
  const proxyBase2 = process.env.NEXT_PUBLIC_PROXY_BASE_URL_2 || "";

  useEffect(() => {
    async function fetchSales() {
      try {
        setLoading(true);
        setError(null);

        let data: UxSale[] | null = null;
        if (useUnified) {
          const res = await fetch(`/api/rss-cached?unified=true`, { cache: 'no-store' });
          if (res.ok) {
            data = await res.json();
          } else {
            data = [];
          }
        } else {
          const rssUrl = encodeURIComponent(`https://${city}.craigslist.org/search/gms?format=rss`);
          // Try cached server API first; on any failure, fall back to proxies
          try {
            const res1 = await fetch(`/api/rss-cached?city=${city}`, { cache: 'no-store' });
            if (!res1.ok) throw new Error(`cached api ${res1.status}`);
            data = await res1.json();
          } catch {
            let res2 = await fetch(`${proxyBase}/rss?url=${rssUrl}`, { cache: 'no-store' });
            if (!res2.ok && proxyBase2) {
              res2 = await fetch(`${proxyBase2}/rss?url=${rssUrl}`, { cache: 'no-store' });
            }
            if (!res2.ok) throw new Error("Failed to fetch RSS (proxy fallback)");
            data = await res2.json();
          }
        }

        if (!Array.isArray(data)) throw new Error("No sales found");
        setSales(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
        setSales([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSales();
  }, [city, proxyBase, proxyBase2, useUnified]);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const coords = CITY_PRESETS[city];
        if (!coords) return setWeather(undefined);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&temperature_unit=fahrenheit&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return setWeather(undefined);
        const data = await res.json();
        const d = data?.daily as { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] } | undefined;
        if (d && d.temperature_2m_max?.[0] != null && d.temperature_2m_min?.[0] != null) {
          const hi = Math.round(d.temperature_2m_max[0]);
          const lo = Math.round(d.temperature_2m_min[0]);
          const precip = d.precipitation_probability_max?.[0];
          setWeather(`Today: ${hi}°F / ${lo}°F${precip != null ? `, precip ${precip}%` : ''}`);
        } else {
          setWeather(undefined);
        }
      } catch {
        setWeather(undefined);
      }
    }
    fetchWeather();
  }, [city]);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4 text-center">
        <h1 className="text-4xl font-bold mb-2">SaleTrail</h1>
        <p className="text-xl mb-4">Find &amp; plan your weekend sales — faster.</p>
        <p className="text-gray-600 mb-6">
          Discover local yard, estate, and garage sales. Plan your route, check the
          weather, and never miss a deal!
        </p>
        {/* City Picker */}
        <div className="flex flex-col items-center gap-3 max-w-md mx-auto mb-4">
          <div className="flex w-full gap-2 justify-center">
            <label className="sr-only" htmlFor="city">City</label>
            <select
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value as keyof typeof CITY_PRESETS)}
              className="px-3 py-2 border border-gray-300 rounded w-full md:w-auto"
              disabled={useUnified}
            >
              {Object.entries(CITY_PRESETS).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useUnified} onChange={(e) => setUseUnified(e.target.checked)} />
              All providers
            </label>
          </div>
        </div>
        <form
          action="/feed"
          method="get"
          className="flex justify-center gap-2 max-w-md mx-auto mb-4"
        >
          <input
            type="text"
            name="q"
            placeholder="Search by location or keyword..."
            className="rounded-l px-4 py-2 border border-gray-300 w-2/3 focus:outline-blue-400"
          />
          <button
            type="submit"
            className="rounded-r bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700"
          >
            Search
          </button>
        </form>
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          <Link
            href="/feed"
            className="bg-blue-600 text-white px-5 py-2 rounded font-semibold hover:bg-blue-700"
          >
            Browse Sales
          </Link>
        </div>
      </section>

      {/* Highlighted Sales (dynamic from RSS) */}
      <section className="max-w-3xl mx-auto py-10 px-4">
        <h2 className="text-2xl font-bold mb-2">Upcoming Sales</h2>
        {weather && (
          <div className="text-sm text-gray-600 mb-4">{weather}</div>
        )}
        {loading && <div className="text-gray-500">Loading sales...</div>}
        {error && <div className="text-red-600">{error}</div>}
        <div className="grid gap-4 md:grid-cols-3">
          {sales.slice(0, 3).map((sale, i) => (
            <SaleCard
              key={i}
              sale={{
                id: i.toString(),
                title: sale.title || '',
                description: sale.description || '',
                url: sale.url || sale.link || '#',
                start_date: sale.pubDate ?? '',
              }}
              weather={weather}
            />
          ))}
        </div>
        <div className="text-right mt-2">
          <Link
            href="/feed"
            className="text-blue-600 hover:underline font-medium"
          >
            See More →
          </Link>
        </div>
      </section>

      {/* Value Props */}
      <section className="bg-gray-50 py-8 px-4">
        <h2 className="text-xl font-bold mb-6 text-center">Why SaleTrail?</h2>
        <div className="flex flex-wrap justify-center gap-8">
          <div className="flex flex-col items-center max-w-xs">
            <span className="text-3xl mb-2">📍</span>
            <span className="font-semibold mb-1">Find sales near you</span>
            <span className="text-gray-600 text-sm text-center">
              See all local sales on a map or in a list.
            </span>
          </div>
          <div className="flex flex-col items-center max-w-xs">
            <span className="text-3xl mb-2">🧭</span>
            <span className="font-semibold mb-1">Plan optimized routes</span>
            <span className="text-gray-600 text-sm text-center">
              Select sales and get the best driving route.
            </span>
          </div>
          <div className="flex flex-col items-center max-w-xs">
            <span className="text-3xl mb-2">🌦️</span>
            <span className="font-semibold mb-1">Check the weather</span>
            <span className="text-gray-600 text-sm text-center">
              See the forecast before you go out.
            </span>
          </div>
        </div>
      </section>

      {/* Community/Engagement Teaser */}
      <section className="max-w-3xl mx-auto py-8 px-4 text-center">
        <h2 className="text-lg font-bold mb-2">Coming Soon</h2>
        <p className="mb-1">⭐ See what others are finding — Community</p>
        <p>💰 Track your profits — Reseller Tools</p>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-6 bg-gray-100 text-center text-sm text-gray-600">
        <div className="flex flex-wrap justify-center gap-6 mb-2">
          <Link href="/about">About</Link>
          <Link href="/about">FAQ</Link>
          <a href="mailto:support@saletrail.app">Contact</a>
          <a href="#">Privacy</a>
          <a
            href="https://github.com/kylewadektw-oss/SalesTrail"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
        <div>© {new Date().getFullYear()} SaleTrail</div>
      </footer>
    </div>
  );
}
