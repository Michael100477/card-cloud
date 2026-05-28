import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { FollowButton } from "@/components/social/FollowButton";

const SPORT_GRAD: Record<string, [string, string]> = {
  Baseball: ["#CE1141","#041E42"], Football: ["#8B4513","#C8A96E"],
  Basketball: ["#C9430A","#1D428A"], Hockey: ["#003087","#C8102E"],
  "Pokémon": ["#FF0000","#FFCB05"], "Magic: The Gathering": ["#1A1A2E","#6B21A8"],
};
function grad(sport: string | null | undefined): [string, string] {
  return SPORT_GRAD[sport ?? ""] ?? ["#185FA5","#042C53"];
}

export default async function ExplorePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const uid = session.user.id;

  // Public collections with their owner and card previews
  const collections = await db.collection.findMany({
    where: { isPublic: true },
    orderBy: { updatedAt: "desc" },
    take: 24,
    include: {
      owner: {
        select: {
          id: true, displayName: true, username: true, profilePhoto: true,
          _count: { select: { cards: true, collections: true } },
          followers: { where: { followerId: uid }, select: { followerId: true } },
        },
      },
      _count: { select: { cards: true } },
      cards: {
        take: 4, orderBy: { addedAt: "desc" },
        include: { card: { select: { photos: true, sport: true, player: true } } },
      },
      snapshots: { orderBy: { capturedAt: "desc" }, take: 1, select: { totalValue: true } },
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <div className="mb-8">
        <h1 className="text-navy text-2xl font-bold">Explore Collectors</h1>
        <p className="text-slate-400 text-sm mt-1">
          Discover collections from the Card Cloud community. Follow collectors to see their latest pickups.
        </p>
      </div>

      {collections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-navy font-semibold mb-2">No public collections yet</p>
          <p className="text-slate-400 text-sm">Be the first — make one of your collections public from its settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {collections.map(col => {
            const owner      = col.owner;
            const ownerName  = owner.displayName ?? owner.username ?? "Collector";
            const isFollowing = owner.followers.length > 0;
            const isOwn      = owner.id === uid;
            const latestValue = col.snapshots[0] ? Number(col.snapshots[0].totalValue) : null;
            const previewCards = col.cards.map(cc => cc.card);

            return (
              <div key={col.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">

                {/* Card photo preview strip */}
                <div className="grid grid-cols-4 h-24">
                  {previewCards.length === 0 ? (
                    <div className="col-span-4 bg-slate-100 flex items-center justify-center">
                      <p className="text-slate-300 text-xs">No cards yet</p>
                    </div>
                  ) : (
                    Array.from({ length: 4 }).map((_, i) => {
                      const card = previewCards[i];
                      const [g1, g2] = card ? grad(card.sport) : ["#e2e8f0","#cbd5e1"];
                      return (
                        <div key={i} className="overflow-hidden"
                          style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                          {card?.photos[0] && (
                            <img src={card.photos[0]} alt={card.player}
                              className="w-full h-full object-cover" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Collection info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <Link href={`/dashboard/collections/${col.id}`}
                        className="text-navy font-semibold text-sm hover:text-brand transition-colors block truncate">
                        {col.name}
                      </Link>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {col._count.cards} {col._count.cards === 1 ? "card" : "cards"}
                        {latestValue != null && latestValue > 0 && ` · Est. $${latestValue.toLocaleString()}`}
                      </p>
                    </div>
                  </div>

                  {/* Owner row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-brand/10 overflow-hidden flex items-center justify-center shrink-0">
                        {owner.profilePhoto
                          ? <img src={owner.profilePhoto} alt={ownerName} className="w-full h-full object-cover" />
                          : <span className="text-brand text-xs font-bold">{ownerName[0]?.toUpperCase()}</span>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-navy text-xs font-medium truncate">{ownerName}</p>
                        <p className="text-slate-400 text-xs">{owner._count.cards} cards</p>
                      </div>
                    </div>

                    {!isOwn && (
                      <FollowButton
                        type="user"
                        targetId={owner.id}
                        initialFollowing={isFollowing}
                        initialCount={0}
                        compact
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
