// Fan of 5 trading cards — rendered back-to-front so center card is on top.
// All coordinates are relative to a 420×260 viewBox; pivot for the fan sits at (210, 380)
// so the cards spread upward like a hand being held.

const PIVOT = { x: 210, y: 380 };

// Base card position (center card at angle 0)
const C = { x: 160, y: 50, w: 100, h: 150 };

interface TradingCard {
  angle: number;
  header: string;
  artBg: string;
  artAccent: string;
  badge: string;
  badgeFill: string;
  art: "number" | "creature" | "gem" | "flame" | "star";
  featured?: boolean;
}

const CARDS: TradingCard[] = [
  // Rendered back-to-front: outer first, center last
  { angle: -24, header: "#92400E", artBg: "#FEF3C7", artAccent: "#FBBF24", badge: "PSA 10",  badgeFill: "#D97706", art: "number"  },
  { angle:  24, header: "#991B1B", artBg: "#FEE2E2", artAccent: "#F87171", badge: "BGS 9.5", badgeFill: "#DC2626", art: "flame"   },
  { angle: -12, header: "#065F46", artBg: "#D1FAE5", artAccent: "#34D399", badge: "PSA 9",   badgeFill: "#059669", art: "creature"},
  { angle:  12, header: "#4C1D95", artBg: "#EDE9FE", artAccent: "#A78BFA", badge: "CGC 10",  badgeFill: "#7C3AED", art: "gem"     },
  { angle:   0, header: "#0C3A6B", artBg: "#DBEAFE", artAccent: "#60A5FA", badge: "PSA 10",  badgeFill: "#185FA5", art: "star", featured: true },
];

function CardShape({ card }: { card: TradingCard }) {
  const { x, y, w, h, } = C;
  const cx = x + w / 2; // card horizontal center = 210

  return (
    <>
      {/* Drop shadow */}
      <rect x={x + 4} y={y + 4} width={w} height={h} rx={8} fill="rgba(0,0,0,0.22)" />

      {/* Card body */}
      <rect x={x} y={y} width={w} height={h} rx={8} fill="white" />

      {/* Header band */}
      <rect x={x} y={y}     width={w} height={36} rx={8}  fill={card.header} />
      <rect x={x} y={y + 26} width={w} height={10}         fill={card.header} />

      {/* Header label lines (card name placeholder) */}
      <rect x={x + 9} y={y + 10} width={54} height={3.5} rx={1.5} fill="rgba(255,255,255,0.65)" />
      <rect x={x + 9} y={y + 18} width={38} height={2.5} rx={1}   fill="rgba(255,255,255,0.4)"  />

      {/* Art area */}
      <rect x={x + 9} y={y + 43} width={w - 18} height={62} rx={5} fill={card.artBg} />

      {/* Art content per card type */}
      {card.art === "number" && (
        <>
          <text x={cx} y={y + 86} textAnchor="middle" fill={card.artAccent}
            fontSize="42" fontWeight="bold" fontFamily="system-ui" opacity="0.85">24</text>
        </>
      )}
      {card.art === "creature" && (
        <>
          {/* Simple Pokémon-style silhouette: head + body */}
          <ellipse cx={cx} cy={y + 85}  rx={16} ry={11} fill={card.artAccent} opacity="0.9" />
          <circle  cx={cx} cy={y + 68}  r={13}          fill={card.artAccent} opacity="0.9" />
          <circle  cx={cx - 5} cy={y + 65} r={3}        fill="white" opacity="0.7" />
          <circle  cx={cx + 5} cy={y + 65} r={3}        fill="white" opacity="0.7" />
        </>
      )}
      {card.art === "gem" && (
        <>
          {/* Diamond gem shape */}
          <polygon
            points={`${cx},${y + 52} ${cx + 18},${y + 70} ${cx},${y + 100} ${cx - 18},${y + 70}`}
            fill={card.artAccent} opacity="0.9"
          />
          <polygon
            points={`${cx},${y + 52} ${cx + 18},${y + 70} ${cx},${y + 70}`}
            fill="rgba(255,255,255,0.4)"
          />
        </>
      )}
      {card.art === "flame" && (
        <>
          {/* Flame path */}
          <path
            d={`M${cx},${y + 98} C${cx - 14},${y + 85} ${cx - 8},${y + 72} ${cx},${y + 62}
                C${cx + 4},${y + 72} ${cx + 6},${y + 64} ${cx + 2},${y + 55}
                C${cx + 16},${y + 66} ${cx + 18},${y + 82} ${cx + 12},${y + 91}
                C${cx + 18},${y + 86} ${cx + 16},${y + 78} ${cx + 12},${y + 75}
                C${cx + 22},${y + 84} ${cx + 14},${y + 105} ${cx},${y + 98}Z`}
            fill={card.artAccent} opacity="0.9"
          />
        </>
      )}
      {card.art === "star" && (
        <>
          {/* 5-pointed star */}
          <polygon
            points={`${cx},${y + 54} ${cx + 8},${y + 72} ${cx + 27},${y + 72} ${cx + 13},${y + 83}
                     ${cx + 18},${y + 102} ${cx},${y + 91} ${cx - 18},${y + 102}
                     ${cx - 13},${y + 83} ${cx - 27},${y + 72} ${cx - 8},${y + 72}`}
            fill={card.artAccent}
          />
        </>
      )}

      {/* Holographic shimmer stripe (only on featured) */}
      {card.featured && (
        <rect x={x} y={y + 43} width={w - 18 + 9} height={3} rx={1}
          fill="url(#holo)" opacity="0.5" transform={`translate(9, 0)`} />
      )}

      {/* Stat bars */}
      <rect x={x + 9}  y={y + 113} width={56} height={3} rx={1.5} fill="#E2E8F0" />
      <rect x={x + 9}  y={y + 121} width={40} height={3} rx={1.5} fill="#E2E8F0" />
      <rect x={x + 9}  y={y + 129} width={68} height={3} rx={1.5} fill="#E2E8F0" />
      <rect x={x + 9}  y={y + 137} width={30} height={3} rx={1.5} fill="#E2E8F0" />

      {/* Grade badge */}
      <rect    x={x + w - 44} y={y + 109} width={37} height={16} rx={8}  fill={card.badgeFill} />
      <text    x={x + w - 25} y={y + 121} textAnchor="middle"
        fill="white" fontSize="6.5" fontWeight="bold" fontFamily="system-ui">
        {card.badge}
      </text>

      {/* Serial number */}
      <text x={x + 9} y={y + h - 6} fill="#CBD5E1" fontSize="6" fontFamily="monospace">
        #000001/010000
      </text>
    </>
  );
}

export function CardGraphic() {
  return (
    <div className="relative select-none" aria-hidden="true">
      <svg
        viewBox="0 0 420 260"
        className="w-full max-w-sm lg:max-w-md"
      >
        <defs>
          {/* Glow filter for featured center card */}
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Holographic shimmer gradient */}
          <linearGradient id="holo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#f0abfc" />
            <stop offset="25%"  stopColor="#60a5fa" />
            <stop offset="50%"  stopColor="#34d399" />
            <stop offset="75%"  stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
        </defs>

        {/* Soft background glow behind center card */}
        <ellipse cx="210" cy="150" rx="90" ry="110" fill="#185FA5" opacity="0.12" />

        {/* Cards — back to front */}
        {CARDS.map((card) => (
          <g
            key={card.angle}
            transform={`rotate(${card.angle}, ${PIVOT.x}, ${PIVOT.y})`}
            filter={card.featured ? "url(#glow)" : undefined}
          >
            <CardShape card={card} />
          </g>
        ))}

        {/* Sparkle dots scattered around the graphic */}
        {[
          { x:  42, y:  58 }, { x: 378, y:  62 }, { x:  68, y: 195 },
          { x: 352, y: 190 }, { x: 155, y:  22 }, { x: 268, y:  18 },
          { x:  20, y: 130 }, { x: 400, y: 128 },
        ].map((pos, i) => (
          <g key={i}>
            <line x1={pos.x}     y1={pos.y - 5} x2={pos.x}     y2={pos.y + 5} stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1={pos.x - 5} y1={pos.y}     x2={pos.x + 5} y2={pos.y}     stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    </div>
  );
}
