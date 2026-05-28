import Link from "next/link";

const PILLAR_ICONS = [TrophyIcon, ChatIcon, UsersIcon];


import type { LinksMap } from "@/lib/links";
import { getLink } from "@/lib/links";

type CmsMap = Record<string, string>;
function c(cms: CmsMap, key: string, fallback: string) { return cms[key] || fallback; }
function shown(cms: CmsMap, key: string) { return cms[`${key}_show`] !== "no"; }

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K+`;
  return String(n);
}

interface LiveStats { collectors: number; cardsTracked: number; publicCollections: number; statesRepresented: number; countriesRepresented: number }

export function CommunityPitch({ cms = {}, links = {}, liveStats = null }: {
  cms?: CmsMap; links?: LinksMap; liveStats?: LiveStats | null;
}) {
  const secondaryCta = getLink(links, "community_secondary");
  const showStats = c(cms, "stat_show_stats", "yes") !== "no";

  const allStats = [
    { key: "stat_1", value: liveStats ? fmt(liveStats.collectors)          : "—", label: c(cms, "stat_1_label", "Collectors"),           show: c(cms, "stat_1_show", "yes") !== "no" },
    { key: "stat_2", value: liveStats ? fmt(liveStats.cardsTracked)        : "—", label: c(cms, "stat_2_label", "Cards tracked"),         show: c(cms, "stat_2_show", "yes") !== "no" },
    { key: "stat_3", value: liveStats ? fmt(liveStats.publicCollections)   : "—", label: c(cms, "stat_3_label", "Public collections"),    show: c(cms, "stat_3_show", "yes") !== "no" },
    { key: "stat_4", value: liveStats ? String(liveStats.statesRepresented): "—", label: c(cms, "stat_4_label", "States represented"),    show: c(cms, "stat_4_show", "yes") !== "no" },
    { key: "stat_5", value: liveStats ? String(liveStats.countriesRepresented): "—", label: c(cms, "stat_5_label", "Countries represented"), show: c(cms, "stat_5_show", "no")  !== "no" },
  ];
  const stats = allStats.filter(s => s.show);

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Headline block */}
        <div className="max-w-3xl mb-14">
          {shown(cms, "community_kicker") && (
            <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-4">
              {c(cms, "community_kicker", "Community")}
            </p>
          )}
          <h2 className="text-navy text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5">
            {shown(cms, "community_headline") && c(cms, "community_headline", "More than a tracker.")}
            {shown(cms, "community_headline") && shown(cms, "community_subheadline") && <br />}
            {shown(cms, "community_subheadline") && (
              <span className="text-brand">{c(cms, "community_subheadline", "A home for collectors.")}</span>
            )}
          </h2>
          {shown(cms, "community_body") && (
            <p className="text-slate-600 text-lg sm:text-xl leading-relaxed">
              {c(cms, "community_body", "The Card Cloud isn't just a tool for managing cards — it's where collectors gather. Show off what you've built, celebrate other people's pickups, and find your people in the hobby.")}
            </p>
          )}
        </div>

        {/* Three pillars — text editable via Settings → Content → Landing Page */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {[1, 2, 3].map((n) => {
            const Icon = PILLAR_ICONS[n - 1];
            const defaults = [
              { h: "Show off every pull",              b: "Every card you add gets its own page. Your entire collection lives at a public link you can share anywhere — or keep private. When you land a grail, you'll have somewhere worthy to put it." },
              { h: "Reactions from people who get it", b: "Comments and likes from collectors who actually understand the hobby. When you post a PSA 10 or a vintage holo, the people celebrating with you will know exactly why it matters." },
              { h: "Follow the collectors you admire", b: "Discover collections by sport, era, team, or player. Follow the hunters whose taste matches yours and see every new pickup in your personal feed the moment it's added." },
            ][n - 1];
            const headline = c(cms, `community_pillar${n}_headline`, defaults.h);
            const body     = c(cms, `community_pillar${n}_body`,     defaults.b);
            const showHeadline = shown(cms, `community_pillar${n}_headline`);
            const showBody     = shown(cms, `community_pillar${n}_body`);
            if (!showHeadline && !showBody) return null;
            return (
              <div key={n} className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-muted flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-brand" />
                </div>
                <div>
                  {showHeadline && <h3 className="text-navy font-bold text-lg mb-2">{headline}</h3>}
                  {showBody     && <p className="text-slate-500 text-base leading-relaxed">{body}</p>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stats row + CTA */}
        <div className="border-t border-slate-100 pt-12">
          {showStats && (
            <div className={`grid grid-cols-2 gap-8 mb-10 ${stats.length <= 2 ? "sm:grid-cols-2" : stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
              {stats.map((stat) => (
                <div key={stat.label} className="text-center sm:text-left">
                  <p className="text-navy text-3xl sm:text-4xl font-bold">{stat.value}</p>
                  <p className="text-slate-400 text-sm mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {shown(cms, "community_cta_primary") && (
              <Link
                href={c(cms, "community_cta_primary_url", "/signup")}
                className="bg-amber text-amber-dark font-semibold px-7 py-3.5 rounded-xl text-base hover:brightness-105 transition-all"
              >
                {c(cms, "community_cta_primary", "Create your collection")}
              </Link>
            )}
            {secondaryCta && (
              <Link
                href={secondaryCta.href}
                className="text-brand font-semibold px-7 py-3.5 rounded-xl text-base border border-brand/25 hover:border-brand/50 transition-all"
              >
                {secondaryCta.label}
              </Link>
            )}
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
