import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CollectionsGrid } from "@/components/collections/CollectionsGrid";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [rawCollections, cardCount] = await Promise.all([
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

  const totalCollections = collections.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Portfolio stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Collections",     value: totalCollections.toString() },
          { label: "Total cards",     value: cardCount.toString() },
          { label: "Est. value",      value: "$—" },
          { label: "30-day change",   value: "—" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl px-5 py-4 border border-slate-100">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{stat.label}</p>
            <p className="text-navy text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Collections grid */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-navy text-xl font-bold">My Collections</h1>
      </div>

      <CollectionsGrid collections={collections} />
    </div>
  );
}

