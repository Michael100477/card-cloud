"use client";

import { useState } from "react";

interface AdminCard {
  id: string; player: string; year: number; manufacturer: string; set: string;
  grade: string | null; gradeCompany: string | null; photos: string[];
  isPublic: boolean; isFeatured: boolean;
  owner: { displayName: string | null; username: string | null; email: string };
}

export function FeaturedCardsClient({ initialFeatured }: { initialFeatured: AdminCard[] }) {
  const [featured,  setFeatured]  = useState<AdminCard[]>(initialFeatured);
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<AdminCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [toggling,  setToggling]  = useState<string | null>(null);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    const r = await fetch(`/api/admin/cards/search?q=${encodeURIComponent(query)}`);
    setResults(await r.json());
    setSearching(false);
  }

  async function toggleFeatured(card: AdminCard, feature: boolean) {
    setToggling(card.id);
    const r = await fetch(`/api/admin/cards/${card.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFeatured: feature, isPublic: feature ? true : card.isPublic }),
    });
    const updated = await r.json();
    if (feature) {
      setFeatured(prev => [...prev, { ...card, ...updated }]);
    } else {
      setFeatured(prev => prev.filter(c => c.id !== card.id));
    }
    setResults(prev => prev.map(c => c.id === card.id ? { ...c, ...updated } : c));
    setToggling(null);
  }

  const featuredIds = new Set(featured.map(c => c.id));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Featured Cards</h1>
      <p className="text-slate-400 text-sm mb-8">Cards marked as featured appear in the landing page showcase. They must be public.</p>

      {/* Currently featured */}
      <h2 className="text-navy font-semibold mb-3">Currently featured ({featured.length})</h2>
      {featured.length === 0 && (
        <p className="text-slate-400 text-sm mb-6">No featured cards yet. Search below to add some.</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {featured.map(card => (
          <CardTile key={card.id} card={card} featured onToggle={() => toggleFeatured(card, false)} toggling={toggling === card.id} />
        ))}
      </div>

      {/* Search */}
      <h2 className="text-navy font-semibold mb-3">Add cards</h2>
      <div className="flex gap-2 mb-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Search by player, set, manufacturer…"
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button
          onClick={search}
          disabled={searching}
          className="bg-brand text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          {searching ? "…" : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {results.map(card => (
            <CardTile
              key={card.id}
              card={card}
              featured={featuredIds.has(card.id)}
              onToggle={() => toggleFeatured(card, !featuredIds.has(card.id))}
              toggling={toggling === card.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardTile({ card, featured, onToggle, toggling }: {
  card: AdminCard; featured: boolean; onToggle: () => void; toggling: boolean;
}) {
  const ownerName = card.owner.displayName ?? card.owner.username ?? card.owner.email;
  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="aspect-[3/4] bg-slate-100 relative">
        {card.photos[0]
          ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs text-center p-2">{card.player}</div>
        }
        {!card.isPublic && (
          <span className="absolute top-1.5 left-1.5 text-xs bg-slate-800/70 text-white px-1.5 py-0.5 rounded">Private</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-navy font-semibold text-xs truncate">{card.player}</p>
        <p className="text-slate-400 text-xs truncate">{card.year} · {card.set}</p>
        {card.grade && <p className="text-xs text-slate-500">{card.gradeCompany} {card.grade}</p>}
        <p className="text-slate-400 text-xs truncate mt-0.5">{ownerName}</p>
        <button
          onClick={onToggle}
          disabled={toggling}
          className={`mt-2 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
            featured
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "bg-brand/10 text-brand hover:bg-brand/20"
          }`}
        >
          {toggling ? "…" : featured ? "Remove" : "Feature"}
        </button>
      </div>
    </div>
  );
}
