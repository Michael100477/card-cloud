import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CollectionsGrid } from "@/components/collections/CollectionsGrid";
import { PortfolioStats } from "@/components/dashboard/PortfolioStats";

export default async function MyCollectionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [rawCollections, cardCount, user] = await Promise.all([
    db.collection.findMany({
      where:   { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { cards: true } },
        cards: {
          orderBy: { addedAt: "desc" },
          take: 12,
          include: { card: { select: { photos: true, player: true, estimatedValue: true } } },
        },
      },
    }),
    db.card.count({ where: { ownerId: session.user.id } }),
    db.user.findUnique({
      where:  { id: session.user.id },
      select: { createdAt: true },
    }),
  ]);

  const collections = rawCollections.map(col => ({
    ...col,
    cards: col.cards.map(cc => ({
      ...cc,
      card: { ...cc.card, estimatedValue: cc.card.estimatedValue ? Number(cc.card.estimatedValue) : null },
    })),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-navy text-2xl font-bold mb-6">My Collections</h1>

      <PortfolioStats
        collectionCount={collections.length}
        cardCount={cardCount}
        accountCreatedAt={user?.createdAt.toISOString() ?? new Date().toISOString()}
      />

      <CollectionsGrid collections={collections} />
    </div>
  );
}
