import Link from "next/link";

interface CardListing {
  id: number;
  player: string;
  year: number;
  set: string;
  cardNumber: string;
  grade: string;
  gradeCompany: "PSA" | "BGS" | "CGC" | "SGC" | "RAW";
  price: number;
  sport: string;
  color1: string;
  color2: string;
  textAccent: string;
  service: "consign" | "sell";
}

const LISTINGS: CardListing[] = [
  {
    id: 1,
    player: "Patrick Mahomes",
    year: 2023, set: "Topps Chrome", cardNumber: "#1",
    grade: "PSA 10", gradeCompany: "PSA", price: 285,
    sport: "NFL",
    color1: "#E31837", color2: "#FFB612", textAccent: "#FFB612",
    service: "consign",
  },
  {
    id: 2,
    player: "LeBron James",
    year: 2003, set: "Topps", cardNumber: "#221",
    grade: "BGS 9", gradeCompany: "BGS", price: 1250,
    sport: "NBA",
    color1: "#552583", color2: "#FDB927", textAccent: "#FDB927",
    service: "consign",
  },
  {
    id: 3,
    player: "Charizard — Holo",
    year: 1999, set: "Base Set", cardNumber: "#4/102",
    grade: "PSA 8", gradeCompany: "PSA", price: 3200,
    sport: "Pokémon",
    color1: "#FF6B35", color2: "#FF4500", textAccent: "#FFD166",
    service: "sell",
  },
  {
    id: 4,
    player: "Justin Jefferson",
    year: 2020, set: "Panini Prizm RC", cardNumber: "#341",
    grade: "PSA 10", gradeCompany: "PSA", price: 340,
    sport: "NFL",
    color1: "#4F2683", color2: "#FFC62F", textAccent: "#FFC62F",
    service: "consign",
  },
  {
    id: 5,
    player: "Michael Jordan",
    year: 1986, set: "Fleer", cardNumber: "#57",
    grade: "PSA 7", gradeCompany: "PSA", price: 2800,
    sport: "NBA",
    color1: "#CE1141", color2: "#000000", textAccent: "#CE1141",
    service: "sell",
  },
  {
    id: 6,
    player: "Wander Franco — Auto",
    year: 2021, set: "Bowman Chrome", cardNumber: "#BCP-25",
    grade: "PSA 10", gradeCompany: "PSA", price: 890,
    sport: "MLB",
    color1: "#092C5C", color2: "#8FBCE6", textAccent: "#8FBCE6",
    service: "consign",
  },
  {
    id: 7,
    player: "Black Lotus",
    year: 1993, set: "Alpha Edition", cardNumber: "#232",
    grade: "BGS 7.5", gradeCompany: "BGS", price: 12500,
    sport: "Magic",
    color1: "#1a0a3c", color2: "#6b21a8", textAccent: "#c084fc",
    service: "sell",
  },
  {
    id: 8,
    player: "Joe Burrow",
    year: 2020, set: "Panini Prizm RC", cardNumber: "#307",
    grade: "PSA 10", gradeCompany: "PSA", price: 420,
    sport: "NFL",
    color1: "#FB4F14", color2: "#000000", textAccent: "#FB4F14",
    service: "consign",
  },
];

const GRADE_COLORS: Record<string, string> = {
  PSA: "#185FA5",
  BGS: "#1a1a1a",
  CGC: "#d97706",
  SGC: "#059669",
  RAW: "#64748b",
};

export function FeaturedListings() {
  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-1">
              Live inventory
            </p>
            <h2 className="text-navy text-2xl sm:text-3xl font-bold">
              Cards available now
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Sports · Pokémon · Magic — currently listed through The Card Cloud
            </p>
          </div>
          <Link
            href="/explore"
            className="text-brand text-sm font-semibold hover:text-light-navy transition-colors hidden sm:block shrink-0 ml-8"
          >
            Browse all →
          </Link>
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {LISTINGS.map((card) => (
            <div
              key={card.id}
              className="bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
            >
              {/* Card image frame */}
              <div
                className="relative"
                style={{
                  background: `linear-gradient(145deg, ${card.color1}, ${card.color2})`,
                  aspectRatio: "2.5 / 3.5",
                }}
              >
                {/* Simulated card inner border */}
                <div className="absolute inset-2.5 border border-white/20 rounded-lg" />

                {/* Large ghosted card number as background art */}
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                  <span
                    className="font-black select-none leading-none"
                    style={{
                      fontSize: "clamp(48px, 18cqi, 88px)",
                      color: "rgba(255,255,255,0.08)",
                      letterSpacing: "-0.05em",
                    }}
                  >
                    {card.cardNumber}
                  </span>
                </div>

                {/* Player name watermark */}
                <div className="absolute bottom-7 left-0 right-0 px-3 text-center">
                  <p
                    className="text-white/70 font-bold leading-tight truncate"
                    style={{ fontSize: "clamp(9px, 3cqi, 13px)" }}
                  >
                    {card.player.toUpperCase()}
                  </p>
                  <p style={{ color: card.textAccent, fontSize: "clamp(7px, 2.5cqi, 10px)" }}
                    className="font-semibold mt-0.5 truncate opacity-90">
                    {card.year} {card.set}
                  </p>
                </div>

                {/* Bottom bar (like a real card's label area) */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-6"
                  style={{ background: "rgba(0,0,0,0.45)" }}
                />

                {/* Grade badge — top right */}
                <div
                  className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-white font-bold shadow-md"
                  style={{
                    background: GRADE_COLORS[card.gradeCompany],
                    fontSize: "clamp(7px, 2.5cqi, 10px)",
                  }}
                >
                  {card.grade}
                </div>

                {/* Sport badge — top left */}
                <div
                  className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full font-semibold shadow-sm"
                  style={{
                    background: "rgba(0,0,0,0.45)",
                    color: card.textAccent,
                    fontSize: "clamp(6px, 2.2cqi, 9px)",
                  }}
                >
                  {card.sport}
                </div>

                {/* Service badge */}
                <div
                  className="absolute bottom-1.5 left-0 right-0 flex justify-center"
                >
                  <span
                    className="text-white/60 uppercase tracking-widest"
                    style={{ fontSize: "clamp(5px, 1.8cqi, 8px)" }}
                  >
                    {card.service === "consign" ? "CONSIGNMENT" : "DIRECT SALE"}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="p-3 sm:p-4">
                <h3 className="text-navy font-bold text-sm leading-snug truncate">
                  {card.player}
                </h3>
                <p className="text-slate-400 text-xs mt-0.5 truncate">
                  {card.year} · {card.set}
                </p>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-navy font-bold text-base">
                    ${card.price.toLocaleString()}
                  </span>
                  <Link
                    href="/signup"
                    className="text-brand text-xs font-semibold hover:text-light-navy transition-colors"
                  >
                    {card.service === "sell" ? "Get offer" : "Buy"} →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile "browse all" */}
        <div className="mt-8 text-center sm:hidden">
          <Link href="/explore" className="text-brand text-sm font-semibold hover:text-light-navy transition-colors">
            Browse all listings →
          </Link>
        </div>
      </div>
    </section>
  );
}
