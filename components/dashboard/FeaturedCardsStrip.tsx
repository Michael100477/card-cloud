import Link from "next/link";

const SPORT_GRAD: Record<string, [string, string]> = {
  Baseball: ["#CE1141","#041E42"], Football: ["#8B4513","#C8A96E"],
  Basketball: ["#C9430A","#1D428A"], Hockey: ["#003087","#C8102E"],
  "Pokémon": ["#FF0000","#FFCB05"], "Magic: The Gathering": ["#1A1A2E","#6B21A8"],
};
function grad(sport: string | null | undefined): [string, string] {
  return SPORT_GRAD[sport ?? ""] ?? ["#185FA5", "#042C53"];
}

interface FeaturedCard {
  id:          string;
  player:      string;
  year:        number | null;
  set:         string | null;
  sport:       string | null;
  grade:       string | null;
  gradeCompany:string | null;
  photos:      string[];
  owner: { displayName: string | null; username: string | null };
}

export function FeaturedCardsStrip({ cards }: { cards: FeaturedCard[] }) {
  if (cards.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-navy text-lg font-bold">Featured on The Card Cloud</h2>
          <p className="text-slate-400 text-xs mt-0.5">Standout cards from our collector community</p>
        </div>
      </div>

      {/* Horizontal scroll strip */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        {cards.map(card => {
          const [g1, g2]  = grad(card.sport);
          const ownerName = card.owner.displayName ?? card.owner.username ?? "Collector";
          return (
            <Link key={card.id} href={`/dashboard/cards/${card.id}`}
              className="flex-none w-36 bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow group">
              {/* Photo */}
              <div className="relative aspect-[3/4] overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                {card.photos[0]
                  ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <span className="absolute inset-0 flex items-center justify-center text-white/40 text-2xl font-bold">
                      {card.player.split(" ").map(w => w[0]).join("").slice(0,2)}
                    </span>
                }
                {/* Featured star */}
                <div className="absolute top-2 left-2 w-6 h-6 bg-amber rounded-full flex items-center justify-center">
                  <StarIcon className="w-3.5 h-3.5 text-amber-dark" />
                </div>
                {card.grade && (
                  <span className="absolute top-2 right-2 text-white text-[10px] font-bold bg-black/50 px-1.5 py-0.5 rounded">
                    {card.gradeCompany} {card.grade}
                  </span>
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <p className="text-navy text-xs font-semibold truncate">{card.player}</p>
                <p className="text-slate-400 text-xs truncate">{[card.year, card.set].filter(Boolean).join(" · ")}</p>
                <p className="text-slate-300 text-xs truncate mt-1">by {ownerName}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function StarIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
}
