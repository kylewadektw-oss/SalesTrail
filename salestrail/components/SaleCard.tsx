import React, { useEffect, useState } from "react";
import { isFavorite, toggleFavorite } from '@/lib/favorites'

type Sale = {
  id: string;
  title: string;
  description: string;
  url: string;
  start_date: string;
};

type Props = { sale: Sale; weather?: string };

export default function SaleCard({ sale, weather }: Props) {
  const [fav, setFav] = useState(false)
  useEffect(() => { setFav(isFavorite(sale.id)) }, [sale.id])

  function onToggleFav() {
    const next = toggleFavorite(sale.id, {
      title: sale.title,
      url: sale.url,
      description: sale.description,
      pubDate: sale.start_date,
    })
    setFav(next)
  }

  function addToRoute() {
    // Placeholder: could push to route planner via querystring or state store
    try {
      const ls = typeof window !== 'undefined' ? window.localStorage : undefined
      if (ls) {
        const key = 'salestrail:routeDraft:v1'
        const raw = ls.getItem(key)
        const arr: string[] = raw ? JSON.parse(raw) : []
        if (!arr.includes(sale.title)) arr.push(sale.title)
        ls.setItem(key, JSON.stringify(arr))
      }
      alert('Added to route draft')
    } catch {}
  }

  return (
    <div className="card shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-lg mb-1">
          <a
            href={sale.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-[var(--foreground)]"
          >
            {sale.title}
          </a>
        </h3>
        <div className="flex gap-2">
          <button className={`btn ${fav ? 'btn-primary' : ''}`} onClick={onToggleFav} aria-pressed={fav}>{fav ? '★ Favorited' : '☆ Favorite'}</button>
          <button className="btn" onClick={addToRoute}>+ Route</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-1">
        {fav && <span className="badge">★ Favorite</span>}
      </div>
      <p className="text-sm text-muted mb-1">{sale.start_date}</p>
      {weather && (
        <p className="text-xs text-muted mb-1">Weather: {weather}</p>
      )}
      <p className="text-[var(--foreground)]/80 text-sm mb-2">{sale.description}</p>
    </div>
  );
}
