'use client';
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  // Replace single-line weather with a 5-day forecast array
  const [forecast, setForecast] = useState<Array<{ date: string; label: string; hi: number; lo: number; code: number }>>([]);
  const [useUnified, setUseUnified] = useState(false);

  // Date range for forecast display
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const defaultStart = toISO(new Date());
  const defaultEnd = toISO(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000));
  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);

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
        if (!coords) return setForecast([]);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&forecast_days=10&temperature_unit=fahrenheit&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return setForecast([]);
        const data = await res.json();
        const times: string[] = data?.daily?.time || [];
        const tmax: number[] = data?.daily?.temperature_2m_max || [];
        const tmin: number[] = data?.daily?.temperature_2m_min || [];
        const codes: number[] = data?.daily?.weathercode || [];
        const days = times.map((iso: string, i: number) => {
          const d = new Date(iso);
          const label = d.toLocaleDateString(undefined, { weekday: 'short' });
          return {
            date: iso,
            label,
            hi: Math.round(tmax[i] ?? 0),
            lo: Math.round(tmin[i] ?? 0),
            code: Number(codes[i] ?? 0),
          };
        });
        setForecast(days);
      } catch {
        setForecast([]);
      }
    }
    fetchWeather();
  }, [city]);

  const minDate = forecast[0]?.date || startDate;
  const maxDate = forecast[forecast.length - 1]?.date || endDate;

  const displayForecast = useMemo(() => {
    return forecast.filter((f) => (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate));
  }, [forecast, startDate, endDate]);

  function weatherIcon(code: number): { glyph: string; label: string } {
    // Open-Meteo weathercode mapping (simplified)
    if ([0].includes(code)) return { glyph: '☀️', label: 'Clear' };
    if ([1, 2].includes(code)) return { glyph: '🌤️', label: 'Mostly clear' };
    if ([3].includes(code)) return { glyph: '☁️', label: 'Cloudy' };
    if ([45, 48].includes(code)) return { glyph: '🌫️', label: 'Foggy' };
    if ([51, 53, 55, 56, 57].includes(code)) return { glyph: '🌦️', label: 'Drizzle' };
    if ([61, 63, 65, 66, 67].includes(code)) return { glyph: '🌧️', label: 'Rain' };
    if ([71, 73, 75, 77].includes(code)) return { glyph: '❄️', label: 'Snow' };
    if ([80, 81, 82].includes(code)) return { glyph: '🌧️', label: 'Showers' };
    if ([95].includes(code)) return { glyph: '⛈️', label: 'Thunderstorm' };
    if ([96, 99].includes(code)) return { glyph: '⛈️', label: 'Thunderstorm w/ hail' };
    return { glyph: '🌤️', label: 'Partly cloudy' };
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white">
      {/* Hero Section */}
      <section
        className="py-12 px-4 text-center"
        style={{
          background: "linear-gradient(135deg, var(--gradient-from), var(--gradient-to))",
        }}
      >
        <h1 className="mb-2">SalesTrail</h1>
        <p className="text-xl mb-4 text-[var(--foreground)]/90">Find &amp; plan your weekend sales — faster.</p>
        <p className="text-[var(--foreground)]/75 mb-6 max-w-2xl mx-auto">
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
              className="input w-full md:w-auto"
              disabled={useUnified}
            >
              {Object.entries(CITY_PRESETS).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={useUnified} onChange={(e) => setUseUnified(e.target.checked)} />
              All providers
            </label>
          </div>
        </div>
        {/* Date range controls */}
        <div className="flex justify-center gap-2 max-w-xl mx-auto mb-4">
          <input
            type="date"
            className="input"
            aria-label="Start date"
            value={startDate}
            min={minDate}
            max={maxDate}
            onChange={(e) => {
              const v = e.target.value;
              setStartDate(v);
              if (endDate < v) setEndDate(v);
            }}
          />
          <input
            type="date"
            className="input"
            aria-label="End date"
            value={endDate}
            min={startDate}
            max={maxDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <form
          action="/feed"
          method="get"
          className="flex justify-center gap-2 max-w-xl mx-auto mb-4"
        >
          <input
            type="text"
            name="q"
            placeholder="Search by location or keyword..."
            className="input w-1/2"
          />
          <input
            type="text"
            name="zip"
            inputMode="numeric"
            pattern="\\d{5}(-\\d{4})?"
            maxLength={10}
            placeholder="ZIP"
            aria-label="ZIP code"
            className="input w-1/4"
          />
          <button
            type="submit"
            className="btn btn-primary"
          >
            Search
          </button>
        </form>
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          <Link
            href="/feed"
            className="btn btn-primary"
          >
            Browse Sales
          </Link>
        </div>
      </section>

      {/* Highlighted Sales (dynamic from RSS) */}
      <section className="max-w-3xl mx-auto py-10 px-4">
        <h2 className="mb-2">Upcoming Sales</h2>
        {displayForecast.length > 0 && (
          <div className="mb-5 overflow-x-auto">
            <div className="flex gap-3 min-w-max">
              {displayForecast.map((d, idx) => {
                const ic = weatherIcon(d.code);
                const md = new Date(d.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
                return (
                  <div key={idx} className="card" style={{ width: 120 }}>
                    <div className="text-sm text-muted mb-1">{d.label}</div>
                    <div className="text-xs text-muted mb-1">{md}</div>
                    <div className="text-3xl" aria-label={ic.label} title={ic.label}>{ic.glyph}</div>
                    <div className="text-sm mt-1"><strong>{d.hi}°</strong> / {d.lo}°</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {loading && <div className="text-muted">Loading sales...</div>}
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
            />
          ))}
        </div>
        <div className="text-right mt-2">
          <Link
            href="/feed"
            className="text-[var(--primary)] hover:underline font-medium"
          >
            See More →
          </Link>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-8 px-4" style={{ background: "var(--muted)" }}>
        <h2 className="text-center mb-6">Why SalesTrail?</h2>
        <div className="flex flex-wrap justify-center gap-8">
          <div className="flex flex-col items-center max-w-xs card">
            <span className="text-3xl mb-2">📍</span>
            <span className="font-semibold mb-1">Find sales near you</span>
            <span className="text-muted text-sm text-center">
              See all local sales on a map or in a list.
            </span>
          </div>
          <div className="flex flex-col items-center max-w-xs card">
            <span className="text-3xl mb-2">🧭</span>
            <span className="font-semibold mb-1">Plan optimized routes</span>
            <span className="text-muted text-sm text-center">
              Select sales and get the best driving route.
            </span>
          </div>
          <div className="flex flex-col items-center max-w-xs card">
            <span className="text-3xl mb-2">🌦️</span>
            <span className="font-semibold mb-1">Check the weather</span>
            <span className="text-muted text-sm text-center">
              See the forecast before you go out.
            </span>
          </div>
        </div>
      </section>

      {/* Treasure Map Visual */}
      <section className="max-w-5xl mx-auto py-10 px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="mb-0">Plan your treasure hunt</h2>
          <Link href="/map" className="btn btn-outline">Open map</Link>
        </div>
        <p className="text-muted mb-4">Spot clusters of sales and plan your route visually.</p>
        <div className="card p-0 overflow-hidden">
          <img
            src="/treasure-map.svg"
            alt="Treasure map with several X marks"
            className="w-full h-auto"
          />
        </div>
      </section>

      {/* Community/Engagement Teaser */}
      <section className="max-w-3xl mx-auto py-8 px-4 text-center">
        <h2 className="text-lg font-bold mb-2">Coming Soon</h2>
        <p className="mb-1">⭐ See what others are finding — Community</p>
        <p>💰 Track your profits — Reseller Tools</p>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
        <div className="flex flex-wrap justify-center gap-6 mb-2">
          <Link href="/about">About</Link>
          <Link href="/about">FAQ</Link>
          <a href="mailto:support@salestrail.app">Contact</a>
          <a href="#">Privacy</a>
          <a
            href="https://github.com/kylewadektw-oss/SalesTrail"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
        <div>© {new Date().getFullYear()} SalesTrail</div>
      </footer>
    </div>
  );
}
