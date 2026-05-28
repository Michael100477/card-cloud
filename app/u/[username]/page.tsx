import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { FollowButton } from "@/components/social/FollowButton";
import { CommentSection } from "@/components/social/CommentSection";

const SPORT_GRAD: Record<string, [string, string]> = {
  Baseball: ["#CE1141","#041E42"], Football: ["#8B4513","#C8A96E"],
  Basketball: ["#C9430A","#1D428A"], Hockey: ["#003087","#C8102E"],
  "Pokémon": ["#FF0000","#FFCB05"],
};
function grad(sport: string | null | undefined): [string, string] {
  return SPORT_GRAD[sport ?? ""] ?? ["#185FA5","#042C53"];
}

interface Props { params: Promise<{ username: string }> }

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;
  const session      = await auth();
  const viewerId     = session?.user?.id ?? null;

  // Find user by username or id
  const profile = await db.user.findFirst({
    where: {
      OR: [
        { username: { equals: username, mode: "insensitive" } },
        { id: username },
      ],
    },
    select: {
      id: true, displayName: true, username: true, profilePhoto: true,
      bio: true, location: true, createdAt: true,
      _count: { select: { followers: true, following: true, cards: true } },
    },
  });
  if (!profile) notFound();

  const isOwn       = viewerId === profile.id;
  const isFollowing = viewerId && !isOwn
    ? !!(await db.userFollow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: profile.id } } }))
    : false;

  // Feed posts (shared cards with captions)
  const feedPosts = await db.feedPost.findMany({
    where:   { userId: profile.id, card: { isPublic: true } },
    orderBy: { createdAt: "desc" },
    take:    20,
    include: {
      card: {
        select: {
          id: true, player: true, year: true, manufacturer: true, set: true,
          subset: true, sport: true, grade: true, gradeCompany: true,
          photos: true, estimatedValue: true, tags: true,
        },
      },
    },
  });

  // Public collections
  const collections = await db.collection.findMany({
    where:   { ownerId: profile.id, isPublic: true },
    orderBy: { updatedAt: "desc" },
    take: 6,
    include: { _count: { select: { cards: true } } },
  });

  const name = profile.displayName ?? profile.username ?? "Collector";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand/10 overflow-hidden flex items-center justify-center shrink-0">
              {profile.profilePhoto
                ? <img src={profile.profilePhoto} alt={name} className="w-full h-full object-cover" />
                : <span className="text-brand text-2xl font-bold">{name[0]?.toUpperCase()}</span>
              }
            </div>
            <div>
              <h1 className="text-navy text-xl font-bold">{name}</h1>
              {profile.username && <p className="text-slate-400 text-sm">@{profile.username}</p>}
              {profile.location && <p className="text-slate-400 text-xs mt-0.5">📍 {profile.location}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOwn ? (
              <Link href="/dashboard/profile"
                className="border border-slate-200 text-navy text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                Edit profile
              </Link>
            ) : viewerId ? (
              <FollowButton
                type="user" targetId={profile.id}
                initialFollowing={isFollowing}
                initialCount={profile._count.followers}
              />
            ) : (
              <Link href="/login"
                className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-600 transition-colors">
                Follow
              </Link>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="text-slate-600 text-sm mt-4 leading-relaxed">{profile.bio}</p>
        )}

        {/* Stats */}
        <div className="flex gap-6 mt-4 pt-4 border-t border-slate-100 text-sm">
          <div><span className="text-navy font-bold">{profile._count.cards}</span> <span className="text-slate-400">cards</span></div>
          <div><span className="text-navy font-bold">{profile._count.followers}</span> <span className="text-slate-400">followers</span></div>
          <div><span className="text-navy font-bold">{profile._count.following}</span> <span className="text-slate-400">following</span></div>
        </div>
      </div>

      {/* Feed posts */}
      {feedPosts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center mb-6">
          <p className="text-slate-400 text-sm">{isOwn ? "You haven't shared any cards yet." : "No shared cards yet."}</p>
          {isOwn && (
            <Link href="/dashboard" className="text-brand text-sm font-medium hover:underline mt-2 inline-block">
              Go to your collection →
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 mb-6">
          {feedPosts.map(post => {
            const card = post.card;
            if (!card) return null;
            const [g1, g2] = grad(card.sport);
            const GRADE_BG: Record<string, string> = { PSA: "#185FA5", BGS: "#1a1a1a", SGC: "#059669" };
            const gradeBg = GRADE_BG[card.gradeCompany ?? ""] ?? "#475569";

            return (
              <div key={post.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="flex gap-4 p-4">
                  {/* Card thumbnail */}
                  <Link href={`/dashboard/cards/${card.id}`} className="shrink-0">
                    <div className="w-20 h-28 rounded-xl overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                      {card.photos[0]
                        ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-cover" />
                        : <span className="flex items-center justify-center h-full text-white/40 text-lg font-bold">
                            {card.player.split(" ").map(w => w[0]).join("").slice(0,2)}
                          </span>
                      }
                    </div>
                  </Link>

                  {/* Card info + caption */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/dashboard/cards/${card.id}`}
                          className="text-navy font-semibold text-sm hover:text-brand transition-colors">
                          {card.player}
                        </Link>
                        <p className="text-slate-400 text-xs">
                          {[card.year, card.manufacturer, card.set].filter(Boolean).join(" · ")}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {card.grade && (
                            <span className="text-white text-xs font-bold px-1.5 py-0.5 rounded-md" style={{ background: gradeBg }}>
                              {card.gradeCompany} {card.grade}
                            </span>
                          )}
                          {card.tags.map(t => (
                            <span key={t} className="bg-brand/10 text-brand text-xs px-1.5 py-0.5 rounded-md">{t}</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-slate-300 text-xs shrink-0">
                        {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>

                    {post.caption && (
                      <p className="text-slate-600 text-sm mt-2 leading-relaxed">"{post.caption}"</p>
                    )}
                  </div>
                </div>

                {/* Comments (login-gated) */}
                {viewerId ? (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    <CommentSection cardId={card.id} currentUserId={viewerId} isOwner={isOwn} />
                  </div>
                ) : (
                  <div className="border-t border-slate-100 px-4 py-3 text-center">
                    <Link href="/login" className="text-brand text-xs font-medium hover:underline">
                      Log in to comment →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Public collections */}
      {collections.length > 0 && (
        <div>
          <h2 className="text-navy text-lg font-bold mb-3">Collections</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {collections.map(col => (
              <Link key={col.id} href={`/collections/${col.id}`}
                className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-sm transition-shadow">
                <p className="text-navy font-semibold text-sm truncate">{col.name}</p>
                <p className="text-slate-400 text-xs mt-1">{col._count.cards} cards</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
