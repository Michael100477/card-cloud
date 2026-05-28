import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getLockedCardIds } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function TradesBrowsePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const myId = session.user.id;

  const cards = await db.card.findMany({
    where: { isTradeable: true, ownerId: { not: myId } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true, player: true, year: true, manufacturer: true, set: true,
      subset: true, cardNumber: true, sport: true, grade: true, gradeCompany: true,
      photos: true, estimatedValue: true, isTradeable: true,
      owner: { select: { id: true, displayName: true, username: true } },
    },
  });

  // Strip out any cards already locked in an open trade
  const locked = await getLockedCardIds(cards.map(c => c.id));
  const available = cards.filter(c => !locked.has(c.id));

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Trade with other collectors</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Cards other users have marked as available for trade. Pick one to propose a swap.
          </p>
        </div>
        <Link href="/trades/my" className="text-brand text-sm font-medium hover:underline">
          My trades →
        </Link>
      </div>

      {available.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-navy font-semibold mb-2">No cards available for trade right now</p>
          <p className="text-slate-400 text-sm">
            When other collectors mark cards as tradeable they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {available.map(card => (
            <Link
              key={card.id}
              href={`/trades/propose/${card.id}`}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:border-purple-200 transition-all group"
            >
              <div className="aspect-[3/4] bg-slate-50 relative overflow-hidden">
                {card.photos[0] ? (
                  <img src={card.photos[0]} alt={card.player} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl">🃏</div>
                )}
                {card.grade && (
                  <span className="absolute top-2 right-2 bg-navy text-white text-xs font-bold px-2 py-0.5 rounded">
                    {card.gradeCompany} {card.grade}
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-navy font-semibold text-sm truncate">{card.player}</p>
                <p className="text-slate-400 text-xs truncate">
                  {card.year} · {card.manufacturer} {card.set}
                  {card.cardNumber ? ` · #${card.cardNumber}` : ""}
                </p>
                <p className="text-slate-500 text-xs mt-1 truncate">
                  Owned by {card.owner.displayName ?? card.owner.username ?? "Anon"}
                </p>
                <button className="w-full mt-2 text-xs font-semibold text-purple-600 group-hover:text-purple-700">
                  Propose trade →
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
