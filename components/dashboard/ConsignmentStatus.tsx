import Link from "next/link";

const STATUS_STYLE: Record<string, string> = {
  pending:     "bg-amber-100 text-amber-700",
  received:    "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed:   "bg-green-100 text-green-700",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending receipt", received: "Received",
  in_progress: "In progress", completed: "Complete",
};

interface ConsignOrder {
  id:         string;
  status:     string;
  receiptCode:string | null;
  submittedAt:string;
  items:      { player: string; status: string; listing: { url: string | null } | null }[];
}

export function ConsignmentStatus({ orders }: { orders: ConsignOrder[] }) {
  if (orders.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-navy text-lg font-bold mb-3">Your Consignments</h2>
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <TagIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-navy font-semibold mb-1">No active consignments</p>
          <p className="text-slate-400 text-sm mb-4">
            Consign your cards and we&apos;ll list them on eBay for you.
          </p>
          <Link href="/dashboard/consign"
            className="inline-block bg-amber text-amber-dark text-sm font-semibold px-5 py-2.5 rounded-xl hover:brightness-105 transition-all">
            Start a consignment
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-navy text-lg font-bold">Your Consignments</h2>
        <Link href="/dashboard/consignments" className="text-brand text-sm font-medium hover:underline">
          View all →
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {orders.map(order => {
          const orderRef = `CC-${order.id.slice(-8).toUpperCase()}`;
          const listed   = order.items.filter(i => i.listing).length;
          return (
            <Link key={order.id} href={`/dashboard/consignments/${order.id}`}
              className="bg-white rounded-2xl border border-slate-100 px-5 py-4 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[order.status] ?? "bg-slate-100 text-slate-500"}`}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
                <div className="min-w-0">
                  <p className="text-navy text-sm font-medium font-mono">{orderRef}</p>
                  <p className="text-slate-400 text-xs truncate">
                    {order.items.slice(0, 3).map(i => i.player).join(", ")}
                    {order.items.length > 3 ? ` +${order.items.length - 3} more` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-slate-400 text-xs">{new Date(order.submittedAt).toLocaleDateString()}</p>
                {listed > 0 && <p className="text-blue-600 text-xs">{listed} on eBay</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function TagIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
