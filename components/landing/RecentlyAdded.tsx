import { db } from "@/lib/db";
import Link from "next/link";

const GRADIENTS: Record<string, [string, string]> = {
  Baseball:   ["#CE1141", "#041E42"],
  Football:   ["#8B4513", "#C8A96E"],
  Basketball: ["#C9430A", "#1D428A"],
  Hockey:     ["#003087", "#C8102E"],
  Soccer:     ["#1A6B3C", "#F6EB16"],
  "Pokémon":  ["#FF0000", "#FFCB05"],
  "Magic: The Gathering": ["#1A1A2E", "#6B21A8"],
};

const GRADE_COLORS: Record<string, string> = {
  PSA: "#185FA5", BGS: "#1a1a1a", BGGS: "#1a1a1a",
  BCCG: "#1a1a1a", SGC: "#059669", CGC: "#d97706",
};

export async function RecentlyAdded() {
  const cards = await db.card.findMany({
    where:   { isPublic: true },
    orderBy: { createdAt: "desc" },
    take:    10,
    select: {
      id: true, player: true, year: true, manufacturer: true,
      set: true, subset: true, grade: true, gradeCompany: true,
      sport: true, tags: true, photos: true,
      owner: { select: { username: true, displayName: true } },
    },
  });

  if (cards.length === 0) return null; // hidden until there are public cards

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-1">
              Just added
            </p>
            <h2 className="text-navy text-2xl sm:text-3xl font-bold">
              Recently added to collections
            </h2>
          </div>
          <Link href="/signup" className="text-brand text-sm font-semibold hover:text-light-navy transition-colors hidden sm:block">
            Track your cards →
          </Link>
        </div>

        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible lg:grid-cols-10 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          {cards.map((card) => {
            const gradient = GRADIENTS[card.sport ?? ""] ?? ["#185FA5", "#042C53"];
            const gradeBg  = GRADE_COLORS[card.gradeCompany ?? ""] ?? "#475569";
            const photo    = card.photos[0];
            const firstTag = card.tags[0];

            return (
              <Link
                key={card.id}
                href="/signup"
                className="group block shrink-0 w-32 sm:w-auto"
              >
                {/* Card image */}
                <div
                  className="relative overflow-hidden bg-slate-200 shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-200"
                  style={{ aspectRatio: "2.5/3.5", background: `linear-gradient(145deg, ${gradient[0]}, ${gradient[1]})` }}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={card.player} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <p className="text-white/70 text-xs font-semibold text-center leading-tight line-clamp-3">
                        {card.player}
                      </p>
                    </div>
                  )}

                  {/* Grade badge */}
                  {card.grade && (
                    <div
                      className="absolute top-1.5 right-1.5 text-white font-bold rounded-full px-1.5 py-0.5 shadow-sm"
                      style={{ background: gradeBg, fontSize: "8px" }}
                    >
                      {card.gradeCompany} {card.grade}
                    </div>
                  )}

                  {/* Tag badge */}
                  {firstTag && (
                    <div
                      className="absolute top-1.5 left-1.5 bg-black/50 text-white rounded px-1.5 py-0.5"
                      style={{ fontSize: "7px", fontWeight: 600 }}
                    >
                      {firstTag.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="mt-1.5">
                  <p className="text-navy text-xs font-semibold truncate group-hover:text-brand transition-colors">
                    {card.player}
                  </p>
                  <p className="text-slate-400 text-xs truncate">
                    {card.year} {card.set}{card.subset ? ` · ${card.subset}` : ""}
                  </p>
                  {card.owner.username && (
                    <p className="text-slate-300 text-xs truncate">
                      @{card.owner.username}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Mobile "see more" */}
        <div className="mt-6 text-center sm:hidden">
          <Link href="/signup" className="text-brand text-sm font-semibold">
            Track your cards →
          </Link>
        </div>
      </div>
    </section>
  );
}
