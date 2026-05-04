import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CollectionView } from "@/components/cards/CollectionView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CollectionDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const collection = await db.collection.findUnique({
    where: { id },
    include: {
      _count: { select: { cards: true } },
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
  });

  if (!collection || collection.ownerId !== session.user.id) notFound();

  // Serialize Decimal fields — Prisma Decimal can't cross the server→client boundary
  const cards = collection.cards.map(({ card }) => ({
    ...card,
    estimatedValue: card.estimatedValue ? Number(card.estimatedValue) : null,
    createdAt: card.createdAt.toISOString(),
  }));

  return (
    <div>
      {/* Collection hero */}
      <div className="bg-navy px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sky-highlight/70 hover:text-sky-highlight text-sm mb-4 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            My Collections
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-white text-2xl sm:text-3xl font-bold">{collection.name}</h1>
              {collection.description && (
                <p className="text-sky-highlight text-sm mt-1">{collection.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sky-highlight/70 text-sm">
                  {collection._count.cards} {collection._count.cards === 1 ? "card" : "cards"}
                </span>
                <span className="text-sky-highlight/40">·</span>
                <span className="text-sky-highlight/70 text-sm">Est. $—</span>
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

            <Link
              href={`/dashboard/cards/new?collection=${id}`}
              className="bg-amber text-amber-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:brightness-105 transition-all whitespace-nowrap self-start sm:self-auto"
            >
              + Add card
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <CollectionView cards={cards} collectionId={id} />
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
