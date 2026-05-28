import Link from "next/link";
import { db } from "@/lib/db";
import { ConsignmentsTable } from "./ConsignmentsTable";

export default async function AdminConsignmentsPage() {
  const orders = await db.consignmentOrder.findMany({
    orderBy: { submittedAt: "desc" },
    include: {
      user:  { select: { email: true, displayName: true, username: true } },
      items: {
        select: {
          id: true, status: true, player: true,
          listing: { select: { status: true } },
        },
      },
    },
  });

  const pending  = orders.filter(o => o.status === "pending").length;
  const received = orders.filter(o => o.status === "received" || o.status === "in_progress").length;

  const serialized = orders.map(o => ({
    ...o,
    submittedAt: o.submittedAt.toISOString(),
    receivedAt:  o.receivedAt?.toISOString() ?? null,
  }));

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Consignments</h1>
          <p className="text-slate-400 text-sm">
            {orders.length} orders · {pending} pending · {received} in hand
          </p>
        </div>
        <Link href="/admin/listings" className="text-brand text-sm hover:underline">
          View eBay listings →
        </Link>
      </div>

      <ConsignmentsTable orders={serialized} />
    </div>
  );
}
