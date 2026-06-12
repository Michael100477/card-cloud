"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trackingUrl } from "@/lib/tracking";

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
  soldAt: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  ebayOrderId: string | null;
  ebayListingId: string | null;
  buyerName: string | null;
  buyerUsername: string | null;
  buyerAddress: Address | null;
  weightOz: number;
  dimLength: number;
  dimWidth: number;
  dimHeight: number;
  shippingLabelUrl: string | null;
  trackingNumber: string | null;
  shippingCarrier: string | null;
}

const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ShippingClient({ rows }: { rows: ShippingRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ready" | "shipped">("ready");
  const [busy, setBusy] = useState<string | null>(null);
  const [err,  setErr]  = useState<Record<string, string>>({});

  const [refreshing, setRefreshing] = useState(false);
  const filtered = rows.filter(r => filter === "ready" ? r.status === "paid" : r.status === "shipped");

  async function refreshFromEbay() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/admin/shipping/refresh", { method: "POST" });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error ?? "Failed"); }
      router.refresh();
    } catch (e) {
      alert(`Refresh failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setRefreshing(false);
  }

  // Group rows by ebayOrderId so items in the same eBay order ship together
  // as one combined label. Items without an order id (rare — usually a sync
  // gap) each get their own group keyed on row id so they still render.
  const groups: ShippingRow[][] = (() => {
    const map = new Map<string, ShippingRow[]>();
    for (const r of filtered) {
      const key = r.ebayOrderId || `__solo_${r.key}`;
      const existing = map.get(key) ?? [];
      existing.push(r);
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => {
      const latestA = a.reduce((m, x) => (x.paidAt ?? "") > m ? (x.paidAt ?? "") : m, "");
      const latestB = b.reduce((m, x) => (x.paidAt ?? "") > m ? (x.paidAt ?? "") : m, "");
      return latestB.localeCompare(latestA);
    });
  })();

  async function createLabel(group: ShippingRow[]) {
    // Use the first item in the group as the entry point. The backend cascades
    // by ebayOrderId to mark every sibling shipped under the same tracking.
    const primary = group[0];
    const groupKey = primary.ebayOrderId || primary.key;
    setBusy(groupKey);
    setErr(p => ({ ...p, [groupKey]: "" }));
    try {
      const r = await fetch(`/api/admin/shipping/${primary.kind}/${primary.id}/create-label`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `Failed (${r.status})`);
      router.refresh();
    } catch (e) {
      setErr(p => ({ ...p, [groupKey]: String(e) }));
    }
    setBusy(null);
  }

  async function markShipped(group: ShippingRow[]) {
    const itemDesc = group.length === 1 ? "this item" : `all ${group.length} items in this order`;
    const trackingNumber = prompt(`Paste the tracking number from the label you bought (eBay seller hub, Pirate Ship, etc.).\n\nLeave blank to just mark ${itemDesc} as shipped without tracking.`, "");
    if (trackingNumber === null) return; // user clicked Cancel
    const carrier = trackingNumber.trim()
      ? prompt("Carrier? (USPS, UPS, FedEx, DHL)", "USPS") ?? "USPS"
      : "";

    const primary = group[0];
    const groupKey = primary.ebayOrderId || primary.key;
    setBusy(groupKey);
    try {
      // mark-shipped is still single-item — call for each row in the group.
      // Same tracking + carrier applied to all siblings.
      for (const row of group) {
        const r = await fetch(`/api/admin/shipping/${row.kind}/${row.id}/mark-shipped`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingNumber: trackingNumber.trim() || undefined, carrier }),
        });
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error ?? "Failed"); }
      }
      router.refresh();
    } catch (e) {
      alert(String(e));
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs + new-label button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {(["ready", "shipped"] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === t ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
              {t === "ready" ? `Ready to ship (${rows.filter(r => r.status === "paid").length})` : `Shipped (${rows.filter(r => r.status === "shipped").length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refreshFromEbay} disabled={refreshing}
            className="border border-slate-200 text-navy text-xs font-semibold px-3 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap"
            title="Pull the latest fulfillment state from eBay (use this after shipping through eBay seller hub directly)"
          >
            {refreshing ? "Syncing…" : "↻ Refresh from eBay"}
          </button>
          <Link href="/admin/shipping/new"
            className="bg-brand text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-blue-600 transition-colors whitespace-nowrap">
            + Create new label
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
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
                <th className="text-left px-5 py-3">Cards</th>
                <th className="text-left px-5 py-3">Buyer</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Sold</th>
                <th className="text-left px-5 py-3">Package</th>
                <th className="text-left px-5 py-3">Sale</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {groups.map((group, i) => {
                const sample      = group[0];
                const groupKey    = sample.ebayOrderId || sample.key;
                const totalPrice  = group.reduce((s, r) => s + (r.soldPrice ?? 0), 0);
                // Combined package: sum weights (more conservative for postage
                // rate), keep the LARGEST per-axis dim — items stacked flat in
                // one bubble mailer.
                const combinedOz  = group.reduce((s, r) => s + (r.weightOz ?? 0), 0);
                const combinedL   = Math.max(...group.map(r => r.dimLength));
                const combinedW   = Math.max(...group.map(r => r.dimWidth));
                const combinedH   = Math.max(...group.map(r => r.dimHeight));
                const latestPaid  = group.reduce<string | null>((m, x) =>
                  x.paidAt && (!m || x.paidAt > m) ? x.paidAt : m, null);
                const latestShipped = group.reduce<string | null>((m, x) =>
                  x.shippedAt && (!m || x.shippedAt > m) ? x.shippedAt : m, null);
                const earliestSold  = group.reduce<string | null>((m, x) =>
                  x.soldAt && (!m || x.soldAt < m) ? x.soldAt : m, null);
                const sharedLabelUrl = group.find(r => r.shippingLabelUrl)?.shippingLabelUrl ?? null;
                const sharedTracking = group.find(r => r.trackingNumber)?.trackingNumber ?? null;
                const sharedCarrier  = group.find(r => r.shippingCarrier)?.shippingCarrier ?? null;
                return (
                  <tr key={`group-${groupKey}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-5 py-3 align-top">
                      {group.length > 1 && (
                        <p className="text-amber-700 text-xs font-semibold mb-1 uppercase tracking-wide">
                          Combined order — {group.length} items
                        </p>
                      )}
                      {group.map((r, j) => (
                        <div key={r.key} className={j > 0 ? "mt-2 pt-2 border-t border-slate-200" : ""}>
                          <p className="text-navy font-medium break-words">{r.title || <span className="italic">Draft</span>}</p>
                          {r.ebayListingId && (
                            <p className="text-slate-400 text-xs mt-0.5">
                              eBay #{r.ebayListingId}{" "}
                              <a href={`https://www.ebay.com/itm/${r.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
                            </p>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="px-5 py-3 align-top text-xs">
                      <p className="text-navy font-medium">{sample.buyerName ?? sample.buyerUsername ?? "—"}</p>
                      {sample.buyerAddress ? (
                        <>
                          <p className="text-slate-500">{sample.buyerAddress.street1}{sample.buyerAddress.street2 ? `, ${sample.buyerAddress.street2}` : ""}</p>
                          <p className="text-slate-500">
                            {sample.buyerAddress.city}{sample.buyerAddress.state ? `, ${sample.buyerAddress.state}` : ""} {sample.buyerAddress.postalCode}
                            {sample.buyerAddress.country && sample.buyerAddress.country !== "US" ? ` · ${sample.buyerAddress.country}` : ""}
                          </p>
                        </>
                      ) : <p className="text-slate-400">Address not yet synced</p>}
                    </td>
                    <td className="px-5 py-3 align-top text-xs text-slate-600 whitespace-nowrap">
                      {earliestSold ? new Date(earliestSold).toLocaleDateString() : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3 align-top text-xs">
                      <p className="text-navy">{combinedOz.toFixed(1)} oz</p>
                      <p className="text-slate-400">{combinedL}″ × {combinedW}″ × {combinedH}″</p>
                      <p className="text-slate-400 mt-0.5">{totalPrice <= 50 ? "→ eBay Standard Envelope" : "→ USPS Ground Advantage"}</p>
                    </td>
                    <td className="px-5 py-3 align-top text-xs">
                      <p className="text-navy font-medium">${usd(totalPrice)}</p>
                      {latestPaid    ? <p className="text-slate-400">Paid {new Date(latestPaid).toLocaleDateString()}</p> : null}
                      {latestShipped ? <p className="text-green-600">Shipped {new Date(latestShipped).toLocaleDateString()}</p> : null}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="flex flex-col gap-1.5 items-start">
                        {filter === "ready" && (
                          <>
                            <button onClick={() => createLabel(group)} disabled={busy === groupKey}
                              className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50">
                              {busy === groupKey ? "Working…" : group.length > 1 ? `Create label (${group.length} items)` : "Create label"}
                            </button>
                            <button onClick={() => markShipped(group)} disabled={busy === groupKey}
                              className="text-slate-400 text-xs hover:text-navy">
                              Mark as shipped
                            </button>
                            {err[groupKey] && <p className="text-red-500 text-xs max-w-[200px] leading-tight">{err[groupKey].slice(0, 200)}</p>}
                          </>
                        )}
                        {sharedLabelUrl && (
                          <a
                            href={`/print/label?label_url=${encodeURIComponent(sharedLabelUrl)}${sharedTracking ? `&tracking=${encodeURIComponent(sharedTracking)}` : ""}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-brand text-xs hover:underline font-medium"
                          >
                            ↓ Print label
                          </a>
                        )}
                        {sharedTracking && (
                          <p className="text-slate-400 text-xs">
                            {sharedCarrier ? `${sharedCarrier}: ` : "Tracking: "}
                            <a
                              href={trackingUrl(sharedCarrier, sharedTracking)}
                              target="_blank" rel="noopener noreferrer"
                              className="text-brand font-mono hover:underline"
                            >
                              {sharedTracking}
                            </a>
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
