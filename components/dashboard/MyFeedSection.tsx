import Link from "next/link";

const SPORT_GRAD: Record<string, [string, string]> = {
  Baseball:   ["#CE1141","#041E42"], Football:   ["#8B4513","#C8A96E"],
  Basketball: ["#C9430A","#1D428A"], Hockey:     ["#003087","#C8102E"],
  "Pokémon":  ["#FF0000","#FFCB05"],
};
function grad(sport: string | null | undefined): [string, string] {
  return SPORT_GRAD[sport ?? ""] ?? ["#185FA5","#042C53"];
}
const GRADE_BG: Record<string, string> = {
  PSA: "#185FA5", BGS: "#1a1a1a", SGC: "#059669",
};

interface FeedItem {
  id:        string;
  caption:   string | null;
  createdAt: string;
  card: {
    id: string; player: string; year: number | null; manufacturer: string | null;
    set: string | null; sport: string | null; grade: string | null;
    gradeCompany: string | null; photos: string[];
  } | null;
}

export function MyFeedSection({ posts }: { posts: FeedItem[] }) {
  if (posts.length === 0) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-navy text-lg font-bold">My Activity</h2>
          <Link href="/dashboard/feed" className="text-brand text-sm font-medium hover:underline">
            Open feed →
          </Link>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <ShareIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-navy font-semibold mb-1">Nothing shared yet</p>
          <p className="text-slate-400 text-sm mb-4">
            Open any card and click <strong>"Share to your feed"</strong> to post it with a caption.
          </p>
          <Link href="/dashboard" className="text-brand text-sm font-medium hover:underline">
            Browse your collection →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-navy text-lg font-bold">My Activity</h2>
        <Link href="/dashboard/feed" className="text-brand text-sm font-medium hover:underline">
          See full feed →
        </Link>
      </div>

      {/* Horizontal post list — photo left, caption right */}
      <div className="flex flex-col gap-3">
        {posts.slice(0, 4).map(post => {
          const card = post.card;
          if (!card) return null;
          const [g1, g2] = grad(card.sport);
          const gradeBg  = GRADE_BG[card.gradeCompany ?? ""] ?? "#475569";

          return (
            <div key={post.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-sm transition-shadow">
              <div className="flex gap-0">

                {/* Photo — fixed width portrait thumbnail */}
                <Link href={`/dashboard/cards/${card.id}`} className="shrink-0 w-28 sm:w-36">
                  <div className="w-full aspect-[3/4] overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                    {card.photos[0]
                      ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-cover" />
                      : <span className="flex items-center justify-center h-full text-white/40 text-xl font-bold">
                          {card.player.split(" ").map(w => w[0]).join("").slice(0,2)}
                        </span>
                    }
                  </div>
                </Link>

                {/* Content — right of photo */}
                <div className="flex-1 min-w-0 p-4 flex flex-col justify-between">
                  <div>
                    {/* Card identity */}
                    <Link href={`/dashboard/cards/${card.id}`}
                      className="text-navy font-bold text-base hover:text-brand transition-colors block leading-tight">
                      {card.player}
                    </Link>
                    <p className="text-slate-500 text-sm mt-0.5">
                      {[card.year, card.manufacturer, card.set].filter(Boolean).join(" · ")}
                    </p>
                    {card.grade && (
                      <span className="inline-block mt-1.5 text-white text-xs font-bold px-2 py-0.5 rounded"
                        style={{ background: gradeBg }}>
                        {card.gradeCompany} {card.grade}
                      </span>
                    )}

                    {/* Caption — large and prominent */}
                    {post.caption && (
                      <p className="text-navy text-base mt-3 leading-relaxed font-medium">
                        {post.caption}
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <span className="text-slate-400 text-xs">
                      {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <Link href={`/dashboard/feed`}
                      className="text-brand text-xs font-medium hover:underline">
                      View comments →
                    </Link>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {posts.length > 4 && (
        <Link href="/dashboard/feed"
          className="block mt-3 text-center text-brand text-sm font-medium hover:underline">
          See all {posts.length} posts →
        </Link>
      )}
    </section>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}
