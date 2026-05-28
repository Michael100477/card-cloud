import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CommentSection } from "@/components/social/CommentSection";
import { FollowButton } from "@/components/social/FollowButton";

const SPORT_GRAD: Record<string, [string, string]> = {
  Baseball: ["#CE1141","#041E42"], Football: ["#8B4513","#C8A96E"],
  Basketball: ["#C9430A","#1D428A"], Hockey: ["#003087","#C8102E"],
};
function grad(sport: string | null | undefined): [string, string] {
  return SPORT_GRAD[sport ?? ""] ?? ["#185FA5","#042C53"];
}

interface Props { params: Promise<{ id: string }> }

export default async function PublicCollectionPage({ params }: Props) {
  const { id }   = await params;
  const session  = await auth(); // optional — page works without it
  const viewerId = session?.user?.id ?? null;

  const collection = await db.collection.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true, displayName: true, username: true, profilePhoto: true,
          _count: { select: { followers: true } },
          ...(viewerId ? { followers: { where: { followerId: viewerId }, select: { followerId: true } } } : {}),
        },
      },
      _count:    { select: { cards: true, followers: true } },
      snapshots: { orderBy: { capturedAt: "desc" }, take: 1, select: { totalValue: true } },
      cards: {
        orderBy: { addedAt: "desc" },
        include: {
          card: {
            select: {
              id: true, player: true, year: true, manufacturer: true, set: true,
              subset: true, sport: true, grade: true, gradeCompany: true,
              photos: true, serialNumber: true, tags: true, estimatedValue: true,
            },
          },
        },
      },
    },
  });

  if (!collection || !collection.isPublic) notFound();

  const owner      = collection.owner;
  const ownerName  = owner.displayName ?? owner.username ?? "Collector";
  const isOwn      = viewerId === owner.id;
  const ownerFollowers = (owner as { followers?: { followerId: string }[] }).followers;
  const isFollowingOwner = viewerId && !isOwn
    ? (ownerFollowers?.length ?? 0) > 0
    : false;
  const isFollowingCollection = viewerId && !isOwn
    ? !!(await db.collectionFollow.findUnique({ where: { userId_collectionId: { userId: viewerId, collectionId: id } } }))
    : false;
  const latestValue = collection.snapshots[0] ? Number(collection.snapshots[0].totalValue) : null;

  const GRADE_BG: Record<string, string> = { PSA: "#185FA5", BGS: "#1a1a1a", SGC: "#059669" };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Collection header */}
      <div className="bg-navy rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-2xl font-bold">{collection.name}</h1>
            {collection.description && (
              <p className="text-sky-highlight text-sm mt-1">{collection.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap text-sm">
              <span className="text-sky-highlight/70">{collection._count.cards} cards</span>
              {latestValue != null && latestValue > 0 && (
                <><span className="text-sky-highlight/40">·</span>
                <span className="text-sky-highlight/70">Est. ${latestValue.toLocaleString()}</span></>
              )}
            </div>
          </div>

          {/* Owner + actions */}
          <div className="flex flex-col gap-2 items-end">
            <Link href={owner.username ? `/u/${owner.username}` : "#"}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
                {owner.profilePhoto
                  ? <img src={owner.profilePhoto} alt={ownerName} className="w-full h-full object-cover" />
                  : <span className="text-white text-xs font-bold">{ownerName[0]?.toUpperCase()}</span>
                }
              </div>
              <span className="text-sky-highlight text-sm">{ownerName}</span>
            </Link>

            {viewerId && !isOwn && (
              <div className="flex gap-2">
                <FollowButton type="collection" targetId={id} initialFollowing={isFollowingCollection}
                  initialCount={collection._count.followers} compact />
                <FollowButton type="user" targetId={owner.id} initialFollowing={isFollowingOwner}
                  initialCount={owner._count.followers} compact />
              </div>
            )}
            {!viewerId && (
              <Link href="/login" className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-xl transition-colors">
                Log in to follow
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
        {collection.cards.map(({ card }) => {
          const [g1, g2] = grad(card.sport);
          const gradeBg  = GRADE_BG[card.gradeCompany ?? ""] ?? "#475569";
          return (
            <Link key={card.id} href={`/dashboard/cards/${card.id}`}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
              <div className="aspect-[3/4] overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                {card.photos[0]
                  ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <span className="flex items-center justify-center h-full text-white/40 text-2xl font-bold">
                      {card.player.split(" ").map(w => w[0]).join("").slice(0,2)}
                    </span>
                }
              </div>
              <div className="p-3">
                <p className="text-navy text-xs font-semibold truncate">{card.player}</p>
                <p className="text-slate-400 text-xs truncate">{card.year} · {card.set}</p>
                {card.grade && (
                  <span className="inline-block mt-1 text-white text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: gradeBg }}>
                    {card.gradeCompany} {card.grade}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Comments */}
      {viewerId ? (
        <CommentSection collectionId={id} currentUserId={viewerId} isOwner={isOwn} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
          <p className="text-slate-400 text-sm mb-3">Log in to leave a comment on this collection.</p>
          <Link href="/login" className="inline-block bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 transition-colors">
            Log in
          </Link>
        </div>
      )}
    </div>
  );
}
