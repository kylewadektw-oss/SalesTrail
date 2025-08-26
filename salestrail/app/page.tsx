'use client';
import Link from "next/link";
import { useEffect, useState } from "react";
import SaleCard from "@/components/SaleCard";

export default function Home() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSales() {
      try {
        const res = await fetch(
          "/api/rss?url=https://hartford.craigslist.org/search/gms?format=rss"
        );
        if (!res.ok) throw new Error("Failed to fetch RSS");
        const data = await res.json();
        setSales(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchSales();
  }, []);

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
          <Link
            href="/map"
            className="bg-green-600 text-white px-5 py-2 rounded font-semibold hover:bg-green-700"
          >
            View Map
          </Link>
          <Link
            href="/route"
            className="bg-purple-600 text-white px-5 py-2 rounded font-semibold hover:bg-purple-700"
          >
            Plan a Route
          </Link>
        </div>
      </section>

      {/* Highlighted Sales (dynamic from RSS) */}
      <section className="max-w-3xl mx-auto py-10 px-4">
        <h2 className="text-2xl font-bold mb-4">Upcoming Sales</h2>
        {loading && <div className="text-gray-500">Loading sales...</div>}
        {error && <div className="text-red-600">{error}</div>}
        <div className="grid gap-4 md:grid-cols-3">
          {sales.slice(0, 3).map((sale: any, i: number) => (
            <SaleCard
              key={i}
              sale={{
                id: i.toString(),
                title: sale.title,
                description: sale.description,
                url: sale.link,
                start_date: sale.pubDate,
              }}
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
