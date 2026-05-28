import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { FollowButton } from "@/components/social/FollowButton";

export default async function FollowingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [userFollows, collectionFollows] = await Promise.all([
    db.userFollow.findMany({
      where:   { followerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        following: {
          select: {
            id: true, displayName: true, username: true, profilePhoto: true, bio: true,
            _count: { select: { cards: true, collections: true } },
          },
        },
      },
    }),
    db.collectionFollow.findMany({
      where:   { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        collection: {
          select: {
            id: true, name: true, description: true, isPublic: true,
            _count: { select: { cards: true } },
            owner: { select: { id: true, displayName: true, username: true } },
            snapshots: { orderBy: { capturedAt: "desc" }, take: 1, select: { totalValue: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-navy text-2xl font-bold mb-1">Following</h1>
      <p className="text-slate-400 text-sm mb-8">
        {userFollows.length} {userFollows.length === 1 ? "person" : "people"} · {collectionFollows.length} {collectionFollows.length === 1 ? "collection" : "collections"}
      </p>

      {/* ── People ── */}
      <Section title="People" count={userFollows.length}>
        {userFollows.length === 0 ? (
          <EmptyState message="You're not following anyone yet. Visit a public card or collection to follow the owner." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userFollows.map(({ following: u }) => {
              const name = u.displayName ?? u.username ?? "Collector";
              const initials = name.slice(0, 2).toUpperCase();
              return (
                <div key={u.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-start gap-3">
                  {/* Avatar */}
                  <div className="shrink-0 w-11 h-11 rounded-full bg-brand/10 overflow-hidden flex items-center justify-center">
                    {u.profilePhoto
                      ? <img src={u.profilePhoto} alt={name} className="w-full h-full object-cover" />
                      : <span className="text-brand text-sm font-bold">{initials}</span>
                    }
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-navy font-semibold text-sm truncate">{name}</p>
                    {u.username && <p className="text-slate-400 text-xs">@{u.username}</p>}
                    {u.bio && <p className="text-slate-500 text-xs mt-1 line-clamp-2">{u.bio}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{u._count.cards} cards</span>
                      <span>·</span>
                      <span>{u._count.collections} collections</span>
                    </div>
                  </div>
                  {/* Unfollow */}
                  <FollowButton
                    type="user"
                    targetId={u.id}
                    initialFollowing={true}
                    initialCount={0}
                    compact
                  />
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Collections ── */}
      <Section title="Collections" count={collectionFollows.length}>
        {collectionFollows.length === 0 ? (
          <EmptyState message="You're not following any collections yet. Visit a public collection and hit Follow." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collectionFollows.map(({ collection: col }) => {
              const ownerName = col.owner.displayName ?? col.owner.username ?? "a collector";
              const latestValue = col.snapshots[0] ? Number(col.snapshots[0].totalValue) : null;
              return (
                <div key={col.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/collections/${col.id}`}
                        className="text-navy font-semibold text-sm hover:text-brand transition-colors truncate block"
                      >
                        {col.name}
                      </Link>
                      <p className="text-slate-400 text-xs mt-0.5">by {ownerName}</p>
                    </div>
                    <FollowButton
                      type="collection"
                      targetId={col.id}
                      initialFollowing={true}
                      initialCount={0}
                      compact
                    />
                  </div>
                  {col.description && (
                    <p className="text-slate-500 text-xs mb-2 line-clamp-2">{col.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{col._count.cards} {col._count.cards === 1 ? "card" : "cards"}</span>
                    {latestValue != null && latestValue > 0 && (
                      <>
                        <span>·</span>
                        <span>Est. ${latestValue.toLocaleString()}</span>
                      </>
                    )}
                    {col.isPublic && (
                      <>
                        <span>·</span>
                        <span className="text-brand">Public</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-navy text-base font-semibold mb-4">
        {title}
        {count > 0 && <span className="ml-2 text-slate-400 font-normal text-sm">({count})</span>}
      </h2>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-6 py-10 text-center">
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}
