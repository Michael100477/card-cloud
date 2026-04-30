import Link from "next/link";

const PILLARS = [
  {
    icon: TrophyIcon,
    headline: "Show off every pull",
    body: "Every card you add gets its own page. Your entire collection lives at a public link you can share anywhere — or keep private. When you land a grail, you'll have somewhere worthy to put it.",
  },
  {
    icon: ChatIcon,
    headline: "Reactions from people who get it",
    body: "Comments and likes from collectors who actually understand the hobby. When you post a PSA 10 or a vintage holo, the people celebrating with you will know exactly why it matters.",
  },
  {
    icon: UsersIcon,
    headline: "Follow the collectors you admire",
    body: "Discover collections by sport, era, team, or player. Follow the hunters whose taste matches yours and see every new pickup in your personal feed the moment it's added.",
  },
];

const STATS = [
  { value: "12,400+", label: "Collectors" },
  { value: "890K+",   label: "Cards tracked" },
  { value: "4,800+",  label: "Public collections" },
  { value: "42",      label: "States represented" },
];

export function CommunityPitch() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Headline block */}
        <div className="max-w-3xl mb-14">
          <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-4">
            Community
          </p>
          <h2 className="text-navy text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5">
            More than a tracker.
            <br />
            <span className="text-brand">A home for collectors.</span>
          </h2>
          <p className="text-slate-600 text-lg sm:text-xl leading-relaxed">
            The Card Cloud isn't just a tool for managing cards — it's where
            collectors gather. Show off what you've built, celebrate other
            people's pickups, and find your people in the hobby.
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {PILLARS.map((pillar) => (
            <div key={pillar.headline} className="flex flex-col gap-4">
              {/* Icon circle */}
              <div className="w-12 h-12 rounded-2xl bg-brand-muted flex items-center justify-center shrink-0">
                <pillar.icon className="w-6 h-6 text-brand" />
              </div>
              <div>
                <h3 className="text-navy font-bold text-lg mb-2">
                  {pillar.headline}
                </h3>
                <p className="text-slate-500 text-base leading-relaxed">
                  {pillar.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="border-t border-slate-100 pt-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center sm:text-left">
                <p className="text-navy text-3xl sm:text-4xl font-bold">{stat.value}</p>
                <p className="text-slate-400 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <Link
              href="/signup"
              className="bg-amber text-amber-dark font-semibold px-7 py-3.5 rounded-xl text-base hover:brightness-105 transition-all"
            >
              Create your collection
            </Link>
            <Link
              href="/explore"
              className="text-brand font-semibold px-7 py-3.5 rounded-xl text-base border border-brand/25 hover:border-brand/50 transition-all"
            >
              Browse collector profiles
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="8 17 12 21 16 17" />
      <line x1="12" y1="13" x2="12" y2="21" />
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
