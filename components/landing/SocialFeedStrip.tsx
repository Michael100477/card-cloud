import Link from "next/link";
import { db } from "@/lib/db";

export async function SocialFeedStrip() {
  const posts = await db.feedPost.findMany({
    where: {
      user: { isPublic: true },
      OR: [
        { photos: { isEmpty: false } },
        { card: { isNot: null } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 16,
    include: {
      user: { select: { displayName: true, username: true, profilePhoto: true } },
      card: { select: { id: true, player: true, year: true, set: true, grade: true, gradeCompany: true, photos: true, sport: true } },
    },
  });

  if (posts.length === 0) return null;

  return (
    <section className="bg-white py-14 border-t border-slate-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-7">
          <div>
            <p className="text-sky-highlight text-xs font-semibold uppercase tracking-widest mb-1 text-brand">Community</p>
            <h2 className="text-navy text-2xl font-bold leading-tight">What collectors are sharing</h2>
          </div>
          <Link href="/explore" className="text-brand text-sm font-semibold hover:underline shrink-0">
            See all →
          </Link>
        </div>

        {/* Horizontal scroll strip */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 snap-x snap-mandatory">
          {posts.map(post => {
            const photo = post.photos[0] ?? post.card?.photos?.[0] ?? null;
            const name  = post.user.displayName ?? post.user.username ?? "Collector";
            const slug  = post.user.username ?? "";
            const initial = name.slice(0, 2).toUpperCase();

            return (
              <Link
                key={post.id}
                href={slug ? `/u/${slug}` : "/explore"}
                className="flex-none w-52 snap-start bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group"
              >
                {/* Photo area */}
                <div className="w-full h-40 bg-slate-200 overflow-hidden relative">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={post.card?.player ?? "Card"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand/10 to-navy/10">
                      <span className="text-3xl">🃏</span>
                    </div>
                  )}
                  {/* Sport badge */}
                  {post.card?.sport && (
                    <span className="absolute top-2 right-2 bg-white/90 text-navy text-xs font-semibold px-2 py-0.5 rounded-full">
                      {post.card.sport}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-3">
                  {/* Card info */}
                  {post.card && (
                    <div className="mb-2">
                      <p className="text-navy font-semibold text-sm leading-tight truncate">{post.card.player}</p>
                      <p className="text-slate-400 text-xs truncate">
                        {[post.card.year, post.card.set].filter(Boolean).join(" · ")}
                        {post.card.grade ? ` · ${post.card.gradeCompany} ${post.card.grade}` : ""}
                      </p>
                    </div>
                  )}
                  {/* Caption snippet */}
                  {post.caption && (
                    <p className="text-slate-500 text-xs line-clamp-2 mb-2">{post.caption}</p>
                  )}
                  {/* User */}
                  <div className="flex items-center gap-1.5 mt-1">
                    {post.user.profilePhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.user.profilePhoto} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center text-white text-[9px] font-bold">
                        {initial}
                      </div>
                    )}
                    <span className="text-slate-400 text-xs truncate">{name}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
