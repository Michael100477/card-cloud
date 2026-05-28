const SPORTS = [
  {
    name: "Baseball",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <circle cx="24" cy="24" r="20" fill="white" />
        <circle cx="24" cy="24" r="20" fill="none" stroke="#E2E8F0" strokeWidth="1.5" />
        <path d="M15,10 C10,16 10,22 15,28" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
        <path d="M33,10 C38,16 38,22 33,28" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
        {/* Stitch marks */}
        {[0,1,2,3,4].map(i => (
          <g key={i}>
            <line x1="15" y1={13+i*4} x2="12" y2={12+i*4} stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="33" y1={13+i*4} x2="36" y2={12+i*4} stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    ),
    accent: "#DC2626",
    count: "Baseball Cards",
  },
  {
    name: "Football",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <ellipse cx="24" cy="24" rx="19" ry="13" fill="#92400E" />
        <ellipse cx="24" cy="24" rx="19" ry="13" fill="none" stroke="#78350F" strokeWidth="1.5" />
        <line x1="24" y1="11" x2="24" y2="37" stroke="white" strokeWidth="2" opacity="0.85" />
        {[-6,-2,2,6].map((y, i) => (
          <line key={i} x1="19" y1={24+y} x2="29" y2={24+y} stroke="white" strokeWidth="1.5" opacity="0.85" />
        ))}
        <path d="M5,24 C12,16 36,16 43,24" fill="none" stroke="#78350F" strokeWidth="1.5" />
      </svg>
    ),
    accent: "#D97706",
    count: "Football Cards",
  },
  {
    name: "Basketball",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <circle cx="24" cy="24" r="20" fill="#EA580C" />
        <circle cx="24" cy="24" r="20" fill="none" stroke="#C2410C" strokeWidth="1.5" />
        <line x1="4" y1="24" x2="44" y2="24" stroke="#C2410C" strokeWidth="2" />
        <path d="M24,4 C34,10 34,18 24,24" fill="none" stroke="#C2410C" strokeWidth="2" />
        <path d="M24,24 C34,30 34,38 24,44" fill="none" stroke="#C2410C" strokeWidth="2" />
        <path d="M24,4 C14,10 14,18 24,24" fill="none" stroke="#C2410C" strokeWidth="2" />
        <path d="M24,24 C14,30 14,38 24,44" fill="none" stroke="#C2410C" strokeWidth="2" />
      </svg>
    ),
    accent: "#EA580C",
    count: "Basketball Cards",
  },
  {
    name: "Soccer",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <circle cx="24" cy="24" r="20" fill="white" />
        <circle cx="24" cy="24" r="20" fill="none" stroke="#E2E8F0" strokeWidth="1.5" />
        <polygon points="24,8 29,15 24,22 19,15" fill="#1E293B" opacity="0.8" />
        <polygon points="38,18 38,27 31,27 28,20" fill="#1E293B" opacity="0.7" />
        <polygon points="10,18 10,27 17,27 20,20" fill="#1E293B" opacity="0.7" />
        <polygon points="20,32 24,40 28,32" fill="#1E293B" opacity="0.65" />
      </svg>
    ),
    accent: "#16A34A",
    count: "Soccer Cards",
  },
  {
    name: "Hockey",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        {/* Puck */}
        <ellipse cx="24" cy="30" rx="14" ry="6" fill="#1E293B" />
        <ellipse cx="24" cy="28" rx="14" ry="6" fill="#334155" />
        {/* Hockey stick */}
        <line x1="14" y1="8" x2="22" y2="28" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
        <path d="M22,28 L32,30" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
    accent: "#0284C7",
    count: "Hockey Cards",
  },
  {
    name: "Pokémon",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <circle cx="24" cy="24" r="20" fill="white" stroke="#E2E8F0" strokeWidth="1.5" />
        <rect x="4" y="22" width="40" height="4" fill="#EF4444" />
        <rect x="4" y="22" width="40" height="2" fill="#DC2626" />
        <circle cx="24" cy="24" r="6" fill="white" stroke="#E2E8F0" strokeWidth="2" />
        <circle cx="24" cy="24" r="3" fill="#E2E8F0" />
        {/* Top half red */}
        <path d="M4,24 A20,20 0 0,1 44,24 L4,24 Z" fill="#EF4444" opacity="0.9" />
        <line x1="4" y1="24" x2="44" y2="24" stroke="#1E293B" strokeWidth="2" />
        <circle cx="24" cy="24" r="6" fill="white" stroke="#1E293B" strokeWidth="2" />
        <circle cx="24" cy="24" r="3" fill="#F1F5F9" />
      </svg>
    ),
    accent: "#EF4444",
    count: "Pokémon Cards",
  },
];

export function SportsCategoryStrip() {
  return (
    <section className="bg-slate-900 border-t border-white/5 py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-amber text-xs font-bold uppercase tracking-[0.2em] mb-2">Browse by Sport</p>
          <h2 className="text-white text-2xl sm:text-3xl font-black tracking-tight">
            Every sport. Every card.
          </h2>
          <p className="text-white/50 mt-2 text-sm">Track, sell, trade, and consign across all the hobby's biggest categories.</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {SPORTS.map((sport) => (
            <div key={sport.name}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer group">
              {/* Ball icon with sport-colored ring on hover */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `radial-gradient(circle, ${sport.accent}25 0%, transparent 70%)`, transform: "scale(1.4)" }} />
                <div className="relative">
                  {sport.icon}
                </div>
              </div>
              <div className="text-center">
                <p className="text-white text-xs font-bold">{sport.name}</p>
                <p className="text-white/40 text-[10px] mt-0.5">{sport.count}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
