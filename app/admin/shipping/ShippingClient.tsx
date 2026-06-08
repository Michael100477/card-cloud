"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Address {
  street1?: string; street2?: string; city?: string;
  state?: string; postalCode?: string; country?: string;
}

export interface ShippingRow {
  key: string;
  kind: "internal" | "consignment";
  id: string;
  player: string;
  year: number | null;
  set: string | null;
  title: string | null;
  status: string;
  soldPrice: number | null;
  paidAt: string | null;
  shippedAt: string | null;
  ebayOrderId: string | null;
  ebayListingId: string | null;
  buyerName: string | null;
  buyerAddress: Address | null;
  weightOz: number;
  dimLength: number;
  dimWidth: number;
  dimHeight: number;
  shippingLabelUrl: string | null;
  trackingNumber: string | null;
}

const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ShippingClient({ rows }: { rows: ShippingRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ready" | "shipped">("ready");
  const [busy, setBusy] = useState<string | null>(null);
  const [err,  setErr]  = useState<Record<string, string>>({});

  const filtered = rows.filter(r => filter === "ready" ? r.status === "paid" : r.status === "shipped");

  async function createLabel(row: ShippingRow) {
    setBusy(row.key);
    setErr(p => ({ ...p, [row.key]: "" }));
    try {
      const r = await fetch(`/api/admin/shipping/${row.kind}/${row.id}/create-label`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `Failed (${r.status})`);
      router.refresh();
    } catch (e) {
      setErr(p => ({ ...p, [row.key]: String(e) }));
    }
    setBusy(null);
  }

  async function markShipped(row: ShippingRow) {
    if (!confirm("Mark this item as shipped? Use this if you bought the label outside Card Cloud.")) return;
    setBusy(row.key);
    try {
      const r = await fetch(`/api/admin/shipping/${row.kind}/${row.id}/mark-shipped`, { method: "POST" });
      if (r.ok) router.refresh();
      else { const d = await r.json().catch(() => ({})); alert(d.error ?? "Failed"); }
    } catch (e) {
      alert(String(e));
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["ready", "shipped"] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === t ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
            {t === "ready" ? `Ready to ship (${rows.filter(r => r.status === "paid").length})` : `Shipped (${rows.filter(r => r.status === "shipped").length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-slate-400 text-sm">
            {filter === "ready"
              ? "Nothing waiting to ship. Items appear here once a buyer pays for an eBay auction or Buy It Now."
              : "No shipped items yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3">Card</th>
                <th className="text-left px-5 py-3">Buyer</th>
                <th className="text-left px-5 py-3">Package</th>
                <th className="text-left px-5 py-3">Sale</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.key} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="px-5 py-3 align-top">
                    <p className="text-navy font-medium break-words">{r.title || <span className="italic">Draft</span>}</p>
                    {r.ebayListingId && (
                      <p className="text-slate-400 text-xs mt-0.5">
                        eBay #{r.ebayListingId}{" "}
                        <a href={`https://www.ebay.com/itm/${r.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 align-top text-xs">
                    <p className="text-navy font-medium">{r.buyerName ?? "—"}</p>
                    {r.buyerAddress ? (
                      <>
                        <p className="text-slate-500">{r.buyerAddress.street1}{r.buyerAddress.street2 ? `, ${r.buyerAddress.street2}` : ""}</p>
                        <p className="text-slate-500">
                          {r.buyerAddress.city}{r.buyerAddress.state ? `, ${r.buyerAddress.state}` : ""} {r.buyerAddress.postalCode}
                          {r.buyerAddress.country && r.buyerAddress.country !== "US" ? ` · ${r.buyerAddress.country}` : ""}
                        </p>
                      </>
                    ) : <p className="text-slate-400">Address not yet synced</p>}
                  </td>
                  <td className="px-5 py-3 align-top text-xs">
                    <p className="text-navy">{r.weightOz} oz</p>
                    <p className="text-slate-400">{r.dimLength}″ × {r.dimWidth}″ × {r.dimHeight}″</p>
                    <p className="text-slate-400 mt-0.5">{(r.soldPrice ?? 0) <= 50 ? "→ eBay Standard Envelope" : "→ USPS Ground Advantage"}</p>
                  </td>
                  <td className="px-5 py-3 align-top text-xs">
                    {r.soldPrice != null ? <p className="text-navy font-medium">${usd(r.soldPrice)}</p> : null}
                    {r.paidAt    ? <p className="text-slate-400">Paid {new Date(r.paidAt).toLocaleDateString()}</p> : null}
                    {r.shippedAt ? <p className="text-green-600">Shipped {new Date(r.shippedAt).toLocaleDateString()}</p> : null}
                  </td>
                  <td className="px-5 py-3 align-top">
                    <div className="flex flex-col gap-1.5 items-start">
                      {filter === "ready" && (
                        <>
                          <button onClick={() => createLabel(r)} disabled={busy === r.key}
                            className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50">
                            {busy === r.key ? "Working…" : "Create label"}
                          </button>
                          <button onClick={() => markShipped(r)} disabled={busy === r.key}
                            className="text-slate-400 text-xs hover:text-navy">
                            Mark as shipped
                          </button>
                          {err[r.key] && <p className="text-red-500 text-xs max-w-[200px] leading-tight">{err[r.key].slice(0, 200)}</p>}
                        </>
                      )}
                      {r.shippingLabelUrl && (
                        <a href={r.shippingLabelUrl} target="_blank" rel="noopener noreferrer"
                           className="text-brand text-xs hover:underline font-medium">
                          ↓ Print label
                        </a>
                      )}
                      {r.trackingNumber && (
                        <p className="text-slate-400 text-xs">Tracking: <span className="text-navy font-mono">{r.trackingNumber}</span></p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


