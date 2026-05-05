import { db } from "@/lib/db";
import Link from "next/link";

// Sport → gradient for the card placeholder
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

export async function FeaturedCards() {
  const cards = await db.card.findMany({
    where:   { isPublic: true, isFeatured: true },
    orderBy: { updatedAt: "desc" },
    take:    12,
    select: {
      id: true, player: true, year: true, set: true,
      grade: true, gradeCompany: true, sport: true, photos: true,
      owner: { select: { username: true, displayName: true } },
    },
  });

  if (cards.length === 0) return null; // hidden until admin features a card

  return (
    <section className="bg-navy py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-amber text-sm font-semibold uppercase tracking-widest mb-1">
              ★ Featured
            </p>
            <h2 className="text-white text-2xl sm:text-3xl font-bold">
              Cards worth seeing
            </h2>
          </div>
          <Link href="/signup" className="text-sky-highlight/70 hover:text-sky-highlight text-sm font-medium transition-colors hidden sm:block">
            Start your collection →
          </Link>
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {cards.map((card) => {
            const gradient = GRADIENTS[card.sport ?? ""] ?? ["#185FA5", "#042C53"];
            const gradeBg  = GRADE_COLORS[card.gradeCompany ?? ""] ?? "#475569";
            const photo    = card.photos[0];

            return (
              <Link key={card.id} href="/signup" className="group block">
                {/* Card image */}
                <div
                  className="relative overflow-hidden shadow-lg group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-200"
                  style={{ aspectRatio: "2.5/3.5", background: `linear-gradient(145deg, ${gradient[0]}, ${gradient[1]})` }}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={card.player} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-3 text-center">
                      <p className="text-white/70 text-xs font-semibold leading-tight line-clamp-3">
                        {card.player}
                      </p>
                    </div>
                  )}

                  {/* Grade badge */}
                  {card.grade && (
                    <div
                      className="absolute top-2 right-2 text-white font-bold rounded-full px-2 py-0.5 shadow-md"
                      style={{ background: gradeBg, fontSize: "9px" }}
                    >
                      {card.gradeCompany} {card.grade}
                    </div>
                  )}
                </div>

                {/* Card info */}
                <div className="mt-2">
                  <p className="text-white text-xs font-semibold truncate group-hover:text-amber transition-colors">
                    {card.player}
                  </p>
                  <p className="text-sky-highlight/60 text-xs truncate">
                    {card.year} {card.set}
                  </p>
                  {card.owner.username && (
                    <p className="text-sky-highlight/40 text-xs mt-0.5 truncate">
                      @{card.owner.username}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
