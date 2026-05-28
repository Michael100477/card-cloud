import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CollectionView } from "@/components/cards/CollectionView";
import { ValueHistory } from "@/components/collections/ValueHistory";
import { ShareButtons } from "@/components/social/ShareButtons";
import { CommentSection } from "@/components/social/CommentSection";
import { FollowButton } from "@/components/social/FollowButton";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CollectionDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [collection, rawSnapshots, user] = await Promise.all([
    db.collection.findUnique({
      where: { id },
      include: {
        _count:     { select: { cards: true, followers: true } },
        followers:  { where: { userId: session.user.id }, select: { userId: true } },
        owner: {
          select: {
            id: true, displayName: true, username: true,
            _count: { select: { followers: true } },
            followers: { where: { followerId: session.user.id }, select: { followerId: true } },
          },
        },
        cards: {
          orderBy: { addedAt: "desc" },
          include: {
            card: {
              select: {
                id: true, player: true, year: true, manufacturer: true,
                set: true, subset: true, cardNumber: true, serialNumber: true, sport: true,
                team: true, grade: true, gradeCompany: true, tags: true,
                photos: true, estimatedValue: true, status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    }),
    db.collectionSnapshot.findMany({
      where: { collectionId: id },
      orderBy: { capturedAt: "asc" },
      select: { id: true, totalValue: true, cardCount: true, capturedAt: true },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { createdAt: true },
    }),
  ]);

  if (!collection) notFound();

  const isOwner = collection.ownerId === session.user.id;
  if (!collection.isPublic && !isOwner) notFound();

  const cards = collection.cards.map(({ card }) => ({
    ...card,
    estimatedValue: card.estimatedValue ? Number(card.estimatedValue) : null,
    createdAt: card.createdAt.toISOString(),
  }));

  const snapshots = rawSnapshots.map(s => ({
    id:         s.id,
    totalValue: Number(s.totalValue),
    cardCount:  s.cardCount,
    capturedAt: s.capturedAt.toISOString(),
  }));

  const latestValue = snapshots.length > 0
    ? snapshots[snapshots.length - 1].totalValue
    : cards.reduce((sum, c) => sum + (c.estimatedValue ?? 0), 0);

  const ownerName            = collection.owner.displayName ?? collection.owner.username ?? "a collector";
  const isFollowingCollection = collection.followers.length > 0;
  const collectionFollowerCount = collection._count.followers;
  const isFollowingOwner      = collection.owner.followers.length > 0;
  const ownerFollowerCount    = collection.owner._count.followers;

  return (
    <div>
      {/* Collection hero */}
      <div className="bg-navy px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-sky-highlight/70 mb-4">
            <Link href="/dashboard" className="hover:text-sky-highlight transition-colors">Home</Link>
            <span>/</span>
            <Link href="/dashboard/my-collections" className="hover:text-sky-highlight transition-colors">My Collections</Link>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-white text-2xl sm:text-3xl font-bold">{collection.name}</h1>
              {!isOwner && (
                <p className="text-sky-highlight/60 text-sm mt-0.5">by {ownerName}</p>
              )}
              {collection.description && (
                <p className="text-sky-highlight text-sm mt-1">{collection.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-sky-highlight/70 text-sm">
                  {collection._count.cards} {collection._count.cards === 1 ? "card" : "cards"}
                </span>
                <span className="text-sky-highlight/40">·</span>
                <span className="text-sky-highlight/70 text-sm">
                  Est. {latestValue > 0 ? `$${latestValue.toLocaleString()}` : "$—"}
                </span>
                {collectionFollowerCount > 0 && (
                  <>
                    <span className="text-sky-highlight/40">·</span>
                    <span className="text-sky-highlight/70 text-sm">
                      {collectionFollowerCount} {collectionFollowerCount === 1 ? "follower" : "followers"}
                    </span>
                  </>
                )}
                {collection.isPublic && (
                  <>
                    <span className="text-sky-highlight/40">·</span>
                    <span className="bg-brand/30 text-sky-highlight text-xs px-2 py-0.5 rounded-full font-medium">
                      Public
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
              {/* Follow collection — non-owners only */}
              {!isOwner && (
                <FollowButton
                  type="collection"
                  targetId={id}
                  initialFollowing={isFollowingCollection}
                  initialCount={collectionFollowerCount}
                  compact
                />
              )}

              {/* Follow the owner — non-owners only */}
              {!isOwner && (
                <FollowButton
                  type="user"
                  targetId={collection.owner.id}
                  targetName={ownerName}
                  initialFollowing={isFollowingOwner}
                  initialCount={ownerFollowerCount}
                />
              )}

              {/* Share buttons */}
              <div className="[&_button]:border-white/20 [&_button]:text-white/60 [&_button]:hover:text-white [&_span]:text-amber-300 [&_span]:bg-amber-900/40 [&_span]:border-amber-700">
                <ShareButtons
                  title={`${collection.name} — ${ownerName}'s collection on Card Cloud`}
                  description={`${collection._count.cards} cards · Est. $${latestValue.toLocaleString()}`}
                  isPublic={collection.isPublic}
                />
              </div>

              {/* Add card — owner only */}
              {isOwner && (
                <Link
                  href={`/dashboard/cards/new?collection=${id}`}
                  className="bg-amber text-amber-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:brightness-105 transition-all whitespace-nowrap"
                >
                  + Add card
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card grid */}
      <CollectionView cards={cards} collectionId={id} />

      {/* Value history — owner only */}
      {isOwner && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <ValueHistory
            collectionId={id}
            snapshots={snapshots}
            accountCreatedAt={user?.createdAt.toISOString() ?? new Date().toISOString()}
          />
        </div>
      )}

      {/* Comments */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <CommentSection
          collectionId={id}
          currentUserId={session.user.id}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
