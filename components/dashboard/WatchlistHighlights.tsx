import Link from "next/link";

const SPORT_GRAD: Record<string, [string, string]> = {
  Baseball: ["#CE1141","#041E42"], Football: ["#8B4513","#C8A96E"],
  Basketball: ["#C9430A","#1D428A"], Hockey: ["#003087","#C8102E"],
  "Pokémon": ["#FF0000","#FFCB05"], "Magic: The Gathering": ["#1A1A2E","#6B21A8"],
};
function grad(sport: string | null | undefined): [string, string] {
  return SPORT_GRAD[sport ?? ""] ?? ["#185FA5", "#042C53"];
}

interface WatchCard {
  id:           string;
  player:       string;
  year:         number | null;
  set:          string | null;
  sport:        string | null;
  grade:        string | null;
  gradeCompany: string | null;
  photos:       string[];
  estimatedValue: number | null;
  priceAtWatch:   number | null;
}

export function WatchlistHighlights({ cards, total }: { cards: WatchCard[]; total: number }) {
  if (cards.length === 0) {
    return (
      <section className="mb-8">
        <SectionHeader title="Your Watchlist" count={0} href="/dashboard/watchlist" />
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <EyeOffIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-navy font-semibold mb-1">Nothing on your watchlist yet</p>
          <p className="text-slate-400 text-sm mb-4">Watch any card to track its value over time.</p>
          <Link href="/dashboard" className="text-brand text-sm font-medium hover:underline">
            Browse your collection →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <SectionHeader title="Your Watchlist" count={total} href="/dashboard/watchlist" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {cards.map(card => {
          const [g1, g2]  = grad(card.sport);
          const current   = card.estimatedValue;
          const atWatch   = card.priceAtWatch;
          const delta     = current != null && atWatch != null ? current - atWatch : null;
          const deltaPct  = delta != null && atWatch != null && atWatch > 0 ? (delta / atWatch) * 100 : null;
          const deltaPos  = delta != null && delta > 0;
          const deltaNeg  = delta != null && delta < 0;

          return (
            <Link key={card.id} href={`/dashboard/cards/${card.id}`}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
              {/* Photo */}
              <div className="relative aspect-[3/4] overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                {card.photos[0]
                  ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-cover" />
                  : <span className="absolute inset-0 flex items-center justify-center text-white/40 text-2xl font-bold">
                      {card.player.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    </span>
                }
                {card.grade && (
                  <span className="absolute top-2 right-2 text-white text-xs font-bold bg-black/50 px-1.5 py-0.5 rounded">
                    {card.gradeCompany} {card.grade}
                  </span>
                )}
              </div>
              {/* Info */}
              <div className="p-3">
                <p className="text-navy text-xs font-semibold truncate">{card.player}</p>
                <p className="text-slate-400 text-xs truncate">{[card.year, card.set].filter(Boolean).join(" · ")}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-navy text-sm font-bold">
                    {current != null ? `$${current.toLocaleString()}` : "$—"}
                  </p>
                  {delta != null && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      deltaPos ? "bg-green-100 text-green-700" :
                      deltaNeg ? "bg-red-100 text-red-600"   : "bg-slate-100 text-slate-500"
                    }`}>
                      {deltaPos ? "+" : ""}{delta >= 0 ? "$" : "-$"}{Math.abs(delta).toFixed(0)}
                      {deltaPct != null && ` (${Math.abs(deltaPct).toFixed(0)}%)`}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeader({ title, count, href }: { title: string; count: number; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-navy text-lg font-bold">{title}</h2>
      {count > 0 && (
        <Link href={href} className="text-brand text-sm font-medium hover:underline">
          See all ({count}) →
        </Link>
      )}
    </div>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}
