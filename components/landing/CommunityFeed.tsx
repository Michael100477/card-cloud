import Link from "next/link";
import { db } from "@/lib/db";

// Sport → card gradient colours
const SPORT_COLORS: Record<string, { c1: string; c2: string; accent: string }> = {
  "Baseball":              { c1: "#092C5C", c2: "#1B2E5C", accent: "#8FBCE6" },
  "Football":              { c1: "#1a1a2e", c2: "#16213e", accent: "#E31837" },
  "Basketball":            { c1: "#C9082A", c2: "#1a1a1a", accent: "#FDB927" },
  "Hockey":                { c1: "#1a1a1a", c2: "#0a0a1a", accent: "#cccccc" },
  "Soccer":                { c1: "#166534", c2: "#14532d", accent: "#86efac" },
  "Golf":                  { c1: "#14532d", c2: "#052e16", accent: "#4ade80" },
  "Pokémon":               { c1: "#FF6B35", c2: "#C2410C", accent: "#FCD34D" },
  "Magic: The Gathering":  { c1: "#1a0a3c", c2: "#6b21a8", accent: "#c084fc" },
  "Yu-Gi-Oh!":             { c1: "#1c1917", c2: "#44403c", accent: "#fbbf24" },
};
const DEFAULT_COLORS = { c1: "#1e293b", c2: "#0f172a", accent: "#94a3b8" };

const GRADE_BADGE: Record<string, string> = {
  PSA: "#185FA5", BGS: "#1a1a1a", BGGS: "#1a1a1a",
  CGC: "#d97706", SGC: "#059669", HGA: "#7c3aed",
};

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 3600)  return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  return `${Math.floor(diff / 86400)} days ago`;
}

export async function CommunityFeed() {
  const posts = await db.feedPost.findMany({
    where: { user: { isPublic: true }, card: { isNot: null } },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      user: { select: { displayName: true, username: true, profilePhoto: true } },
      card: {
        select: {
          id: true, player: true, year: true, set: true, cardNumber: true,
          grade: true, gradeCompany: true, sport: true, photos: true,
          collections: {
            take: 1,
            include: { collection: { select: { name: true, id: true } } },
          },
          _count: { select: { watchers: true } },
        },
      },
      comments: {
        take: 1, orderBy: { createdAt: "desc" },
        include: { author: { select: { username: true, displayName: true } } },
      },
      _count: { select: { comments: true } },
    },
  });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-1">Community</p>
            <h2 className="text-navy text-2xl sm:text-3xl font-bold">What collectors are adding</h2>
            <p className="text-slate-500 text-sm mt-1">Real collectors, real collections — see what's being tracked right now</p>
          </div>
          <Link href="/explore" className="text-brand text-sm font-semibold hover:text-light-navy transition-colors hidden sm:block shrink-0 ml-8">
            Explore all collectors →
          </Link>
        </div>

        {/* Activity grid — empty state when no posts yet */}
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">🃏</span>
            <p className="text-navy font-semibold text-lg mb-2">Be the first to share a card</p>
            <p className="text-slate-400 text-sm mb-6 max-w-sm">Add cards to your collection and share them to your feed — they'll appear here for the whole community to see.</p>
            <Link href="/signup" className="bg-brand text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-blue-600 transition-colors">
              Start your collection
            </Link>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((post) => {
            const card      = post.card!;
            const user      = post.user;
            const username  = user.username ?? "collector";
            const name      = user.displayName ?? user.username ?? "Collector";
            const initial   = name.slice(0, 1).toUpperCase();
            const colors    = SPORT_COLORS[card.sport ?? ""] ?? DEFAULT_COLORS;
            const collection = card.collections[0]?.collection;
            const grader    = card.gradeCompany ?? "";
            const grade     = card.grade ?? "";
            const photo     = card.photos?.[0] ?? post.photos?.[0] ?? null;
            const comment   = post.comments[0];
            const commentAuthor = comment?.author?.username ?? comment?.author?.displayName ?? null;
            const profileBg = `hsl(${(username.charCodeAt(0) * 37) % 360}, 55%, 40%)`;

            return (
              <article key={post.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-md transition-shadow flex flex-col">

                {/* Post header */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  {user.profilePhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.profilePhoto} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ background: profileBg }}>
                      {initial}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      <Link href={`/u/${username}`} className="font-bold text-navy hover:text-brand transition-colors">
                        @{username}
                      </Link>
                      <span className="text-slate-500 font-normal"> added to </span>
                      {collection ? (
                        <Link href={`/u/${username}`} className="font-semibold text-brand hover:text-light-navy transition-colors">
                          {collection.name}
                        </Link>
                      ) : (
                        <Link href={`/u/${username}`} className="font-semibold text-brand hover:text-light-navy transition-colors">
                          their collection
                        </Link>
                      )}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">{timeAgo(post.createdAt)}</p>
                  </div>
                </div>

                {/* Card visual */}
                <Link href={`/u/${username}`}>
                  <div className="relative mx-4 rounded-xl overflow-hidden" style={{ aspectRatio: "2.5 / 3.5" }}>
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={card.player} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full" style={{ background: `linear-gradient(145deg, ${colors.c1}, ${colors.c2})` }}>
                        <div className="absolute inset-2.5 border border-white/20 rounded-lg" />
                        {/* Ghosted card number */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="font-black select-none leading-none"
                            style={{ fontSize: "clamp(52px, 20cqi, 96px)", color: "rgba(255,255,255,0.07)", letterSpacing: "-0.04em" }}>
                            {card.cardNumber ?? ""}
                          </span>
                        </div>
                        {/* Player & set label */}
                        <div className="absolute bottom-8 left-0 right-0 px-3 text-center">
                          <p className="text-white/80 font-bold truncate" style={{ fontSize: "clamp(9px, 3.5cqi, 14px)" }}>
                            {(card.player ?? "").toUpperCase()}
                          </p>
                          <p className="font-semibold mt-0.5 truncate opacity-85"
                            style={{ color: colors.accent, fontSize: "clamp(7px, 2.8cqi, 11px)" }}>
                            {card.year} {card.set}
                          </p>
                        </div>
                        {/* Bottom sport bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-7" style={{ background: "rgba(0,0,0,0.5)" }} />
                        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center">
                          <span className="text-white/50 uppercase tracking-widest" style={{ fontSize: "clamp(5px, 1.8cqi, 8px)" }}>
                            {card.sport ?? ""}
                          </span>
                        </div>
                      </div>
                    )}
                    {/* Grade badge */}
                    {grader && grade && (
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-white font-bold shadow-sm"
                        style={{ background: GRADE_BADGE[grader] ?? "#64748b", fontSize: "clamp(7px, 2.5cqi, 10px)" }}>
                        {grader} {grade}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Card metadata */}
                <div className="px-4 pt-3">
                  <p className="text-navy font-bold text-sm">{card.player}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {[card.year, card.set, card.cardNumber].filter(Boolean).join(" · ")}
                  </p>
                </div>

                {/* Latest comment */}
                {comment && commentAuthor && (
                  <div className="mx-4 mt-3 bg-slate-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                      <span className="font-semibold text-navy">@{commentAuthor} </span>
                      {comment.body}
                    </p>
                  </div>
                )}

                {/* Engagement */}
                <div className="flex items-center justify-between px-4 py-3 mt-auto">
                  <div className="flex items-center gap-4 text-slate-400">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <HeartIcon className="w-4 h-4" />{card._count.watchers}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <CommentIcon className="w-4 h-4" />{post._count.comments}
                    </span>
                  </div>
                  <Link href={`/u/${username}`} className="text-brand text-xs font-semibold hover:text-light-navy transition-colors">
                    View collection →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        )}

        {/* Bottom CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/explore" className="text-brand font-semibold text-sm hover:text-light-navy transition-colors">
            Explore all collectors →
          </Link>
          <span className="text-slate-300 hidden sm:block">·</span>
          <Link href="/signup" className="bg-navy text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-light-navy transition-colors">
            Start your own collection
          </Link>
        </div>
      </div>
    </section>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
