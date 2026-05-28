import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const STATUS_STYLE: Record<string, string> = {
  pending:     "bg-amber-100 text-amber-700",
  received:    "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed:   "bg-green-100 text-green-700",
  cancelled:   "bg-slate-100 text-slate-500",
};
const STATUS_LABEL: Record<string, string> = {
  pending:     "Pending",
  received:    "Received",
  in_progress: "In Progress",
  completed:   "Completed",
  cancelled:   "Cancelled",
};

export default async function ConsignmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orders = await db.consignmentOrder.findMany({
    where:   { userId: session.user.id },
    orderBy: { submittedAt: "desc" },
    include: {
      items: {
        select: { id: true, player: true, status: true, listing: { select: { status: true, url: true } } },
      },
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-navy text-2xl font-bold">My Consignments</h1>
          <p className="text-slate-400 text-sm mt-1">Track your cards from drop-off to sale</p>
        </div>
        <Link href="/dashboard/consign"
          className="bg-amber text-amber-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:brightness-105 transition-all">
          + New consignment
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-navy font-semibold mb-2">No consignments yet</p>
          <p className="text-slate-400 text-sm mb-6">Ready to sell? Submit your cards and we&apos;ll list them on eBay.</p>
          <Link href="/dashboard/consign"
            className="inline-block bg-amber text-amber-dark font-semibold px-6 py-3 rounded-xl text-sm hover:brightness-105 transition-all">
            Start a consignment
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map(order => {
            const listed = order.items.filter(i => i.listing).length;
            const sold   = order.items.filter(i => i.listing?.status === "sold").length;
            return (
              <Link key={order.id} href={`/dashboard/consignments/${order.id}`}
                className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-shadow block">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[order.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                      {order.receiptCode && (
                        <span className="text-xs text-slate-400 font-mono">#{order.receiptCode}</span>
                      )}
                    </div>
                    <p className="text-navy font-semibold">
                      {order.items.length} card{order.items.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-slate-400 text-sm mt-0.5 truncate">
                      {order.items.slice(0, 3).map(i => i.player).join(", ")}
                      {order.items.length > 3 ? ` +${order.items.length - 3} more` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-slate-400 text-xs">{new Date(order.submittedAt).toLocaleDateString()}</p>
                    {listed > 0 && <p className="text-blue-600 text-xs mt-1">{listed} listed</p>}
                    {sold > 0   && <p className="text-green-600 text-xs">{sold} sold</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
