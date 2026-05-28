import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  proposed:      "bg-amber-100 text-amber-700",
  counter:       "bg-amber-100 text-amber-700",
  accepted:      "bg-blue-100 text-blue-700",
  inbound:       "bg-blue-100 text-blue-700",
  received_both: "bg-purple-100 text-purple-700",
  outbound:      "bg-blue-100 text-blue-700",
  complete:      "bg-green-100 text-green-700",
  declined:      "bg-slate-100 text-slate-500",
  cancelled:     "bg-slate-100 text-slate-500",
  disputed:      "bg-red-100 text-red-700",
};

export default async function AdminTradesPage() {
  const trades = await db.trade.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      initiator: { select: { displayName: true, username: true, email: true } },
      target:    { select: { displayName: true, username: true, email: true } },
      revisions: { orderBy: { createdAt: "desc" }, take: 1, include: { cards: true } },
    },
  });

  const name = (u: { displayName: string | null; username: string | null; email: string }) =>
    u.displayName ?? u.username ?? u.email;

  // Group by attention-needed first
  const needAttention = trades.filter(t => ["inbound", "received_both", "outbound", "disputed"].includes(t.status));
  const inProgress    = trades.filter(t => ["proposed", "counter", "accepted"].includes(t.status));
  const finished      = trades.filter(t => ["complete", "declined", "cancelled"].includes(t.status));

  function row(t: typeof trades[number]) {
    const r = t.revisions[0];
    const myCount = r?.cards.filter(c => c.side === "initiator").length ?? 0;
    const theirCount = r?.cards.filter(c => c.side === "target").length ?? 0;
    return (
      <Link key={t.id} href={`/admin/trades/${t.id}`}
        className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? "bg-slate-100 text-slate-500"}`}>{t.status}</span>
            <span className="text-slate-400 text-xs">{new Date(t.updatedAt).toLocaleString()}</span>
          </div>
          <p className="text-navy font-semibold text-sm">
            {name(t.initiator)} ↔ {name(t.target)}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">
            {myCount} card{myCount === 1 ? "" : "s"} for {theirCount} card{theirCount === 1 ? "" : "s"} · Trade #{t.id.slice(-8).toUpperCase()}
          </p>
        </div>
        <span className="text-brand text-xs font-medium">View →</span>
      </Link>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Trades</h1>
      <p className="text-slate-400 text-sm mb-6">{trades.length} total · {needAttention.length} need attention</p>

      {needAttention.length > 0 && (
        <>
          <h2 className="text-navy font-semibold text-sm uppercase tracking-wide mb-2">Need attention</h2>
          <div className="flex flex-col gap-2 mb-6">{needAttention.map(row)}</div>
        </>
      )}
      {inProgress.length > 0 && (
        <>
          <h2 className="text-navy font-semibold text-sm uppercase tracking-wide mb-2">In progress</h2>
          <div className="flex flex-col gap-2 mb-6">{inProgress.map(row)}</div>
        </>
      )}
      {finished.length > 0 && (
        <>
          <h2 className="text-slate-400 font-semibold text-sm uppercase tracking-wide mb-2">Finished</h2>
          <div className="flex flex-col gap-2 mb-6">{finished.map(row)}</div>
        </>
      )}
      {trades.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-slate-400 text-sm">No trades yet.</p>
        </div>
      )}
    </div>
  );
}
