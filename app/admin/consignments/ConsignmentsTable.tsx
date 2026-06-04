"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Order {
  id: string; status: string; receiptCode: string | null;
  submittedAt: string; receivedAt: string | null;
  user: { email: string; displayName: string | null; username: string | null };
  items: { id: string; status: string; player: string; listing: { status: string } | null }[];
}

const STATUS_STYLE: Record<string, string> = {
  pending:     "bg-amber-100 text-amber-700",
  received:    "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed:   "bg-green-100 text-green-700",
  cancelled:   "bg-slate-100 text-slate-500",
};

export function ConsignmentsTable({ orders: initial }: { orders: Order[] }) {
  const [orders,       setOrders]   = useState(initial);
  const [search,       setSearch]   = useState("");
  const [statusFilter, setStatus]   = useState("all");
  const [deleting,     setDeleting] = useState<string | null>(null);
  const router = useRouter();

  async function deleteOrder(id: string, userName: string) {
    if (!confirm(`Delete ${userName}'s consignment order? This cannot be undone.`)) return;
    setDeleting(id);
    const r = await fetch(`/api/admin/consignments/${id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(d.error ?? "Failed to delete order");
    } else {
      setOrders(prev => prev.filter(o => o.id !== id));
      router.refresh();
    }
    setDeleting(null);
  }

  const q = search.trim().toLowerCase();

  const filtered = orders.filter((o: Order) => {
    // Status filter
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    // Text search — seller name/email or any card player name
    if (!q) return true;
    const userName = (o.user.displayName ?? o.user.username ?? "").toLowerCase();
    return (
      userName.includes(q) ||
      o.user.email.toLowerCase().includes(q) ||
      (o.receiptCode?.toLowerCase().includes(q) ?? false) ||
      o.id.toLowerCase().includes(q) ||
      o.items.some(i => i.player.toLowerCase().includes(q))
    );
  });

  return (
    <>
      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by seller, email, player name, or receipt code…"
          className="flex-1 min-w-64 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {["all","pending","received","in_progress","completed"].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"
              }`}>
              {s === "in_progress" ? "In Progress" : s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {q && (
        <p className="text-slate-400 text-sm mb-4">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-navy font-semibold mb-1">No orders found</p>
          {q && (
            <p className="text-slate-400 text-sm">
              Try searching by the seller&apos;s name, email address, a player name from their order, or the receipt code you assigned.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3">Seller</th>
                <th className="text-left px-5 py-3">Cards</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Receipt</th>
                <th className="text-left px-5 py-3">Submitted</th>
                <th className="text-left px-5 py-3">Received</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const userName = o.user.displayName ?? o.user.username ?? o.user.email;
                const listed   = o.items.filter(x => x.listing?.status === "active" || x.listing?.status === "draft").length;
                const players  = o.items.map(x => x.player).slice(0, 3).join(", ") + (o.items.length > 3 ? "…" : "");
                return (
                  <tr key={o.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-5 py-3">
                      <p className="text-navy font-medium">{userName}</p>
                      <p className="text-slate-400 text-xs">{o.user.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-600 text-xs">
                        {o.items.length} card{o.items.length !== 1 ? "s" : ""}
                        {listed > 0 && <span className="text-blue-600"> · {listed} listed</span>}
                      </p>
                      <p className="text-slate-400 text-xs truncate max-w-48">{players}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {o.status.replace("_"," ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs font-mono">
                      {o.receiptCode ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {new Date(o.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {o.receivedAt ? new Date(o.receivedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/admin/consignments/${o.id}`}
                          className="text-brand text-xs hover:underline font-medium whitespace-nowrap">
                          View →
                        </Link>
                        <button
                          onClick={() => deleteOrder(o.id, userName)}
                          disabled={deleting === o.id}
                          className="text-slate-400 hover:text-red-500 text-xs transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {deleting === o.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
