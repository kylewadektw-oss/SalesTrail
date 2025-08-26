import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4 text-center">
        <h1 className="text-4xl font-bold mb-2">SaleTrail</h1>
        <p className="text-xl mb-4">Find & plan your weekend sales — faster.</p>
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

      {/* Highlighted Sales (static MVP) */}
      <section className="max-w-3xl mx-auto py-10 px-4">
        <h2 className="text-2xl font-bold mb-4">Upcoming Sales</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* SaleCard mockups */}
          <div className="border rounded p-4 bg-white shadow-sm">
            <h3 className="font-semibold text-lg mb-1">123 Main St</h3>
            <p className="text-sm text-gray-600 mb-1">Sat, Aug 30 • 9am-2pm</p>
            <p className="text-xs text-blue-700 mb-2">Sunny ☀️ 78°F</p>
            <p className="text-gray-700 text-sm">
              Multi-family yard sale, lots of kids' items!
            </p>
          </div>
          <div className="border rounded p-4 bg-white shadow-sm">
            <h3 className="font-semibold text-lg mb-1">456 Oak Ave</h3>
            <p className="text-sm text-gray-600 mb-1">Sun, Sep 1 • 8am-1pm</p>
            <p className="text-xs text-blue-700 mb-2">Partly Cloudy ⛅ 74°F</p>
            <p className="text-gray-700 text-sm">
              Estate sale: furniture, antiques, tools.
            </p>
          </div>
          <div className="border rounded p-4 bg-white shadow-sm">
            <h3 className="font-semibold text-lg mb-1">789 Pine Rd</h3>
            <p className="text-sm text-gray-600 mb-1">Sat, Aug 30 • 10am-4pm</p>
            <p className="text-xs text-blue-700 mb-2">Clear ☀️ 80°F</p>
            <p className="text-gray-700 text-sm">
              Garage sale: electronics, bikes, books.
            </p>
          </div>
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
