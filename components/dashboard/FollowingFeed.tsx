import Link from "next/link";

const SPORT_GRAD: Record<string, [string, string]> = {
  Baseball: ["#CE1141","#041E42"], Football: ["#8B4513","#C8A96E"],
  Basketball: ["#C9430A","#1D428A"], Hockey: ["#003087","#C8102E"],
  "Pokémon": ["#FF0000","#FFCB05"], "Magic: The Gathering": ["#1A1A2E","#6B21A8"],
};
function grad(sport: string | null | undefined): [string, string] {
  return SPORT_GRAD[sport ?? ""] ?? ["#185FA5", "#042C53"];
}

interface FeedCard {
  id:          string;
  player:      string;
  year:        number | null;
  set:         string | null;
  sport:       string | null;
  grade:       string | null;
  gradeCompany:string | null;
  photos:      string[];
  owner: {
    displayName:  string | null;
    username:     string | null;
    profilePhoto: string | null;
  };
}

export function FollowingFeed({ cards, followingCount }: { cards: FeedCard[]; followingCount: number }) {
  if (followingCount === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-navy text-lg font-bold mb-3">From collectors you follow</h2>
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <UsersIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-navy font-semibold mb-1">Follow collectors to see their pickups</p>
          <p className="text-slate-400 text-sm mb-4">
            When you follow someone, their latest cards show up right here.
          </p>
          <Link href="/explore" className="inline-block bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 transition-colors">
            Explore collectors
          </Link>
        </div>
      </section>
    );
  }

  if (cards.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-navy text-lg font-bold mb-3">From collectors you follow</h2>
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <p className="text-slate-400 text-sm">The collectors you follow haven&apos;t added any public cards yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-navy text-lg font-bold mb-3">From collectors you follow</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(card => {
          const [g1, g2] = grad(card.sport);
          const ownerName = card.owner.displayName ?? card.owner.username ?? "Collector";
          return (
            <Link key={card.id} href={`/dashboard/cards/${card.id}`}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
              {/* Photo */}
              <div className="relative aspect-[3/4] overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                {card.photos[0]
                  ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-cover" />
                  : <span className="absolute inset-0 flex items-center justify-center text-white/40 text-xl font-bold">
                      {card.player.split(" ").map(w => w[0]).join("").slice(0,2)}
                    </span>
                }
                {card.grade && (
                  <span className="absolute top-1.5 right-1.5 text-white text-xs font-bold bg-black/50 px-1 py-0.5 rounded text-[10px]">
                    {card.gradeCompany} {card.grade}
                  </span>
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <p className="text-navy text-xs font-semibold truncate">{card.player}</p>
                <p className="text-slate-400 text-xs truncate">{card.year}</p>
                {/* Owner */}
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="w-4 h-4 rounded-full bg-brand/20 overflow-hidden shrink-0 flex items-center justify-center">
                    {card.owner.profilePhoto
                      ? <img src={card.owner.profilePhoto} alt="" className="w-full h-full object-cover" />
                      : <span className="text-brand text-[8px] font-bold">{ownerName[0]}</span>
                    }
                  </div>
                  <span className="text-slate-400 text-xs truncate">{ownerName}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
