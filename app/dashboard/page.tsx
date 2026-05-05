import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CollectionsGrid } from "@/components/collections/CollectionsGrid";
import { PortfolioStats } from "@/components/dashboard/PortfolioStats";

export default async function DashboardPage() {
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
          include: {
            card: { select: { photos: true, player: true, estimatedValue: true } },
          },
        },
      },
    }),
    db.card.count({ where: { ownerId: session.user.id } }),
    db.user.findUnique({
      where:  { id: session.user.id },
      select: { createdAt: true },
    }),
  ]);

  // Serialise Prisma Decimal → number before passing to client components
  const collections = rawCollections.map(col => ({
    ...col,
    cards: col.cards.map(cc => ({
      ...cc,
      card: {
        ...cc.card,
        estimatedValue: cc.card.estimatedValue ? Number(cc.card.estimatedValue) : null,
      },
    })),
  }));

  const accountCreatedAt = user?.createdAt.toISOString() ?? new Date().toISOString();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <PortfolioStats
        collectionCount={collections.length}
        cardCount={cardCount}
        accountCreatedAt={accountCreatedAt}
      />

      {/* Collections grid */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-navy text-xl font-bold">My Collections</h1>
      </div>

      <CollectionsGrid collections={collections} />
    </div>
  );
}
