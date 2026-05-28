import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  proposed:      "bg-amber-100 text-amber-700",
  counter:       "bg-amber-100 text-amber-700",
  accepted:      "bg-blue-100 text-blue-700",
  inbound:       "bg-blue-100 text-blue-700",
  received_both: "bg-blue-100 text-blue-700",
  outbound:      "bg-blue-100 text-blue-700",
  complete:      "bg-green-100 text-green-700",
  declined:      "bg-slate-100 text-slate-500",
  cancelled:     "bg-slate-100 text-slate-500",
  disputed:      "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  proposed:      "Awaiting response",
  counter:       "Counter-offer made",
  accepted:      "Accepted",
  inbound:       "Cards shipping to Card Cloud",
  received_both: "Card Cloud has both shipments",
  outbound:      "Shipping out from Card Cloud",
  complete:      "Complete",
  declined:      "Declined",
  cancelled:     "Cancelled",
  disputed:      "Dispute open",
};

export default async function MyTradesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const myId = session.user.id;

  const trades = await db.trade.findMany({
    where: { OR: [{ initiatorId: myId }, { targetId: myId }] },
    orderBy: { updatedAt: "desc" },
    include: {
      initiator: { select: { id: true, displayName: true, username: true } },
      target:    { select: { id: true, displayName: true, username: true } },
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { cards: { include: { card: { select: { id: true, player: true, year: true, photos: true } } } } },
      },
    },
  });

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">My trades</h1>
          <p className="text-slate-400 text-sm mt-0.5">All trades you&apos;ve initiated or received.</p>
        </div>
        <Link href="/trades" className="text-brand text-sm font-medium hover:underline">Browse tradeable cards →</Link>
      </div>

      {trades.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-navy font-semibold mb-2">No trades yet</p>
          <p className="text-slate-400 text-sm mb-4">
            Browse other collectors&apos; tradeable cards to send your first proposal.
          </p>
          <Link href="/trades" className="inline-block bg-purple-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-purple-700">
            Browse trades
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trades.map(trade => {
            const iAmInitiator = trade.initiatorId === myId;
            const other = iAmInitiator ? trade.target : trade.initiator;
            const rev   = trade.revisions[0];
            const myCards    = rev?.cards.filter(c => c.side === (iAmInitiator ? "initiator" : "target")) ?? [];
            const theirCards = rev?.cards.filter(c => c.side === (iAmInitiator ? "target" : "initiator")) ?? [];
            return (
              <Link
                key={trade.id}
                href={`/trades/${trade.id}`}
                className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-md transition-shadow flex gap-4 items-center"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[trade.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {STATUS_LABEL[trade.status] ?? trade.status}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {iAmInitiator ? "You proposed" : `${other.displayName ?? other.username ?? "Anon"} proposed`} ·{" "}
                      {new Date(trade.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-navy font-semibold text-sm">
                    Trade with {other.displayName ?? other.username ?? "Anon"}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    You give {myCards.length} card{myCards.length === 1 ? "" : "s"} → you get {theirCards.length} card{theirCards.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex -space-x-3">
                  {[...myCards.slice(0, 3), ...theirCards.slice(0, 3)].map((c, i) => (
                    <div key={`${c.cardId}-${i}`} className="w-12 aspect-[3/4] bg-slate-50 rounded-md border border-white overflow-hidden flex-shrink-0">
                      {c.card.photos[0]
                        ? <img src={c.card.photos[0]} alt={c.card.player} className="w-full h-full object-contain" />
                        : <div className="w-full h-full flex items-center justify-center text-slate-300">🃏</div>}
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
