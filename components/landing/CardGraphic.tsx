// Sports trading card fan — five cards styled as real collectibles
// Each card shows a sport, player name, jersey number, stats, and grade badge

const PIVOT = { x: 210, y: 380 };
const C = { x: 155, y: 45, w: 108, h: 158 };

interface SportCard {
  angle: number;
  sport: "baseball" | "football" | "basketball" | "soccer" | "baseball2";
  teamTop: string;
  teamBot: string;
  year: string;
  name: string;
  position: string;
  number: string;
  stat1: string;
  stat2: string;
  grade: string;
  gradeFill: string;
  rookie?: boolean;
  featured?: boolean;
}

const CARDS: SportCard[] = [
  {
    angle: -24, sport: "baseball", year: "2011", name: "M. TROUT", position: "CF",
    number: "27", stat1: ".299 AVG", stat2: "30 HR · 83 RBI",
    grade: "PSA 10", gradeFill: "#1D4ED8",
    teamTop: "#B91C1C", teamBot: "#7F1D1D", rookie: true,
  },
  {
    angle: 24, sport: "football", year: "2005", name: "A. RODGERS", position: "QB",
    number: "12", stat1: "4,299 YDS", stat2: "38 TD · 8 INT",
    grade: "BGS 9.5", gradeFill: "#15803D",
    teamTop: "#2D5016", teamBot: "#1A3009",
  },
  {
    angle: -12, sport: "basketball", year: "2003", name: "L. JAMES", position: "SF",
    number: "23", stat1: "27.2 PPG", stat2: "8.5 REB · 8.3 AST",
    grade: "PSA 9", gradeFill: "#B45309",
    teamTop: "#7F1D1D", teamBot: "#450A0A",
  },
  {
    angle: 12, sport: "soccer", year: "2004", name: "L. MESSI", position: "FWD",
    number: "10", stat1: "32 GOALS", stat2: "16 AST · 47 APPS",
    grade: "CGC 10", gradeFill: "#6D28D9",
    teamTop: "#1E3A8A", teamBot: "#1E1B4B",
  },
  {
    angle: 0, sport: "baseball2", year: "1989", name: "K. GRIFFEY JR", position: "CF",
    number: "24", stat1: ".296 AVG", stat2: "398 HR · ROOKIE",
    grade: "PSA 10", gradeFill: "#0369A1",
    teamTop: "#0C3A6B", teamBot: "#072040", featured: true, rookie: true,
  },
];

function SportArt({ sport, accent, cx, y }: { sport: SportCard["sport"]; accent: string; cx: number; y: number }) {
  if (sport === "baseball" || sport === "baseball2") {
    return (
      <g>
        {/* Baseball */}
        <circle cx={cx} cy={y + 40} r={28} fill="white" opacity="0.9" />
        <circle cx={cx} cy={y + 40} r={28} fill="none" stroke="#E2E8F0" strokeWidth="1" />
        {/* Stitches */}
        <path d={`M${cx - 8},${y + 18} C${cx - 14},${y + 25} ${cx - 14},${y + 33} ${cx - 8},${y + 40}`}
          fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
        <path d={`M${cx + 8},${y + 18} C${cx + 14},${y + 25} ${cx + 14},${y + 33} ${cx + 8},${y + 40}`}
          fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
        {/* Stitch marks */}
        {[-8,-4,0,4,8].map((offset, i) => (
          <g key={i}>
            <line x1={cx - 8} y1={y + 22 + i * 4.5} x2={cx - 12} y2={y + 21 + i * 4.5} stroke="#EF4444" strokeWidth="1" />
            <line x1={cx + 8} y1={y + 22 + i * 4.5} x2={cx + 12} y2={y + 21 + i * 4.5} stroke="#EF4444" strokeWidth="1" />
          </g>
        ))}
        {/* Batter silhouette */}
        <g opacity="0.18" fill={accent}>
          <circle cx={cx + 14} cy={y + 24} r={5} /> {/* head */}
          <rect x={cx + 10} y={y + 29} width={8} height={14} rx="2" /> {/* body */}
          <rect x={cx - 2} y={y + 32} width={16} height={3} rx="1.5" transform={`rotate(-30 ${cx + 6} ${y + 33})`} /> {/* bat */}
        </g>
      </g>
    );
  }
  if (sport === "football") {
    return (
      <g>
        {/* Football */}
        <ellipse cx={cx} cy={y + 40} rx={24} ry={16} fill="#92400E" opacity="0.9" />
        <ellipse cx={cx} cy={y + 40} rx={24} ry={16} fill="none" stroke="#78350F" strokeWidth="1" />
        {/* Laces */}
        <line x1={cx} y1={y + 27} x2={cx} y2={y + 53} stroke="white" strokeWidth="1.5" opacity="0.8" />
        {[-6,-2,2,6].map((offset, i) => (
          <line key={i} x1={cx - 5} y1={y + 33 + i * 5} x2={cx + 5} y2={y + 33 + i * 5} stroke="white" strokeWidth="1.5" opacity="0.8" />
        ))}
        {/* Seams */}
        <path d={`M${cx - 24},${y + 40} C${cx - 10},${y + 28} ${cx + 10},${y + 28} ${cx + 24},${y + 40}`}
          fill="none" stroke="#78350F" strokeWidth="1" />
        {/* QB silhouette */}
        <g opacity="0.2" fill={accent}>
          <circle cx={cx - 14} cy={y + 23} r={5} />
          <rect x={cx - 18} y={y + 28} width={8} height={13} rx="2" />
          <rect x={cx - 10} y={y + 30} width={12} height={3} rx="1.5" transform={`rotate(20 ${cx - 4} ${y + 31})`} />
        </g>
      </g>
    );
  }
  if (sport === "basketball") {
    return (
      <g>
        {/* Basketball */}
        <circle cx={cx} cy={y + 40} r={26} fill="#EA580C" opacity="0.9" />
        <circle cx={cx} cy={y + 40} r={26} fill="none" stroke="#C2410C" strokeWidth="1" />
        {/* Lines */}
        <line x1={cx - 26} y1={y + 40} x2={cx + 26} y2={y + 40} stroke="#C2410C" strokeWidth="1.5" />
        <path d={`M${cx},${y + 14} C${cx + 18},${y + 20} ${cx + 18},${y + 34} ${cx},${y + 40}`} fill="none" stroke="#C2410C" strokeWidth="1.5" />
        <path d={`M${cx},${y + 40} C${cx + 18},${y + 46} ${cx + 18},${y + 60} ${cx},${y + 66}`} fill="none" stroke="#C2410C" strokeWidth="1.5" />
        <path d={`M${cx},${y + 14} C${cx - 18},${y + 20} ${cx - 18},${y + 34} ${cx},${y + 40}`} fill="none" stroke="#C2410C" strokeWidth="1.5" />
        {/* Player silhouette jumping */}
        <g opacity="0.2" fill={accent}>
          <circle cx={cx - 16} cy={y + 20} r={5} />
          <rect x={cx - 20} y={y + 25} width={8} height={13} rx="2" />
          <circle cx={cx - 4} cy={y + 27} r={4} fill={accent} opacity="0.7" /> {/* ball */}
        </g>
      </g>
    );
  }
  if (sport === "soccer") {
    return (
      <g>
        {/* Soccer ball */}
        <circle cx={cx} cy={y + 40} r={25} fill="white" opacity="0.92" />
        <circle cx={cx} cy={y + 40} r={25} fill="none" stroke="#E2E8F0" strokeWidth="1" />
        {/* Pentagon pattern */}
        <polygon points={`${cx},${y + 19} ${cx + 9},${y + 26} ${cx + 6},${y + 37} ${cx - 6},${y + 37} ${cx - 9},${y + 26}`}
          fill="#1E293B" opacity="0.75" />
        <polygon points={`${cx + 21},${y + 32} ${cx + 15},${y + 38} ${cx + 16},${y + 50} ${cx + 24},${y + 53} ${cx + 28},${y + 44}`}
          fill="#1E293B" opacity="0.65" />
        <polygon points={`${cx - 21},${y + 32} ${cx - 15},${y + 38} ${cx - 16},${y + 50} ${cx - 24},${y + 53} ${cx - 28},${y + 44}`}
          fill="#1E293B" opacity="0.65" />
        {/* Kicker silhouette */}
        <g opacity="0.18" fill={accent}>
          <circle cx={cx + 16} cy={y + 19} r={5} />
          <rect x={cx + 12} y={y + 24} width={8} height={12} rx="2" />
        </g>
      </g>
    );
  }
  return null;
}

function CardShape({ card }: { card: SportCard }) {
  const { x, y, w, h } = C;
  const cx = x + w / 2;

  return (
    <>
      {/* Drop shadow */}
      <rect x={x + 5} y={y + 5} width={w} height={h} rx={9} fill="rgba(0,0,0,0.35)" />

      {/* Card body */}
      <rect x={x} y={y} width={w} height={h} rx={9} fill="white" />

      {/* Header gradient band */}
      <defs>
        <linearGradient id={`hdr-${card.sport}-${card.angle}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={card.teamTop} />
          <stop offset="100%" stopColor={card.teamBot} />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={42} rx={9} fill={`url(#hdr-${card.sport}-${card.angle})`} />
      <rect x={x} y={y + 33} width={w} height={9} fill={card.teamTop} />

      {/* Year — top left */}
      <text x={x + 9} y={y + 14} fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="system-ui" fontWeight="600">{card.year}</text>

      {/* Player name — header */}
      <text x={cx} y={y + 26} textAnchor="middle" fill="white" fontSize="11" fontWeight="900" fontFamily="system-ui" letterSpacing="1">{card.name}</text>

      {/* Position badge */}
      <rect x={x + w - 28} y={y + 6} width={22} height={12} rx={6} fill="rgba(255,255,255,0.2)" />
      <text x={x + w - 17} y={y + 15} textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="system-ui">{card.position}</text>

      {/* Rookie banner */}
      {card.rookie && (
        <>
          <rect x={x + 7} y={y + 6} width={32} height={11} rx={5.5} fill="#EF9F27" />
          <text x={x + 23} y={y + 14} textAnchor="middle" fill="#412402" fontSize="6.5" fontWeight="900" fontFamily="system-ui">ROOKIE</text>
        </>
      )}

      {/* Sport art area */}
      <rect x={x + 8} y={y + 44} width={w - 16} height={72} rx={6} fill={`${card.teamTop}12`} />
      <SportArt sport={card.sport} accent={card.teamTop} cx={cx} y={y + 44} />

      {/* Jersey number — large, bottom of art area */}
      <text x={cx} y={y + 107} textAnchor="middle" fill={card.teamTop} fontSize="28" fontWeight="900"
        fontFamily="system-ui" opacity="0.15" letterSpacing="-1">#{card.number}</text>

      {/* Divider */}
      <line x1={x + 8} y1={y + 118} x2={x + w - 8} y2={y + 118} stroke="#E2E8F0" strokeWidth="0.75" />

      {/* Stats */}
      <text x={cx} y={y + 129} textAnchor="middle" fill="#042C53" fontSize="8" fontWeight="700" fontFamily="system-ui">{card.stat1}</text>
      <text x={cx} y={y + 140} textAnchor="middle" fill="#64748B" fontSize="6.5" fontFamily="system-ui">{card.stat2}</text>

      {/* Grade badge */}
      <rect x={x + 8} y={y + h - 20} width={45} height={14} rx={7} fill={card.gradeFill} />
      <text x={x + 30} y={y + h - 10} textAnchor="middle" fill="white" fontSize="7" fontWeight="900" fontFamily="system-ui">{card.grade}</text>

      {/* Holographic shimmer (featured card) */}
      {card.featured && (
        <>
          <rect x={x} y={y + 44} width={w - 16 + 8} height={3} rx={1}
            fill="url(#holo)" opacity="0.6" transform={`translate(8, 0)`} />
          <rect x={x} y={y + 44} width={w - 16 + 8} height={1.5} rx={0.75}
            fill="url(#holo)" opacity="0.4" transform={`translate(8, 69)`} />
        </>
      )}

      {/* Serial number */}
      <text x={x + w - 9} y={y + h - 9} textAnchor="end" fill="#CBD5E1" fontSize="5.5" fontFamily="monospace">#/10,000</text>
    </>
  );
}

export function CardGraphic() {
  return (
    <div className="relative select-none" aria-hidden="true">
      <svg viewBox="0 0 420 275" className="w-full max-w-sm lg:max-w-md">
        <defs>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="holo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#f0abfc" />
            <stop offset="25%"  stopColor="#60a5fa" />
            <stop offset="50%"  stopColor="#34d399" />
            <stop offset="75%"  stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
        </defs>

        {/* Soft glow behind center card */}
        <ellipse cx="210" cy="155" rx="95" ry="115" fill="#0369A1" opacity="0.1" />

        {/* Cards back-to-front */}
        {CARDS.map((card) => (
          <g key={`${card.sport}-${card.angle}`}
            transform={`rotate(${card.angle}, ${PIVOT.x}, ${PIVOT.y})`}
            filter={card.featured ? "url(#glow)" : undefined}>
            <CardShape card={card} />
          </g>
        ))}

        {/* Sparkle dots */}
        {[{x:38,y:52},{x:382,y:58},{x:62,y:205},{x:358,y:198},{x:158,y:18},{x:264,y:14},{x:16,y:138},{x:404,y:132}].map((pos, i) => (
          <g key={i}>
            <line x1={pos.x} y1={pos.y-6} x2={pos.x} y2={pos.y+6} stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1={pos.x-6} y1={pos.y} x2={pos.x+6} y2={pos.y} stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    </div>
  );
}
