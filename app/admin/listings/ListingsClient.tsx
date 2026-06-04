"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageBuyerModal } from "./MessageBuyerModal";

// US dollar formatter — always two decimals (so $17.5 displays as $17.50).
const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Compact "how long until X" string, e.g. "5d 2h left", "47m left", "ending soon", "ended".
// Pass `now` so all rows render against the same client-ticked clock — see the
// `now` useState in ListingsClient that bumps every 30s.
function timeLeft(endTime: string | null, now: number): string | null {
  if (!endTime) return null;
  const diffMs = new Date(endTime).getTime() - now;
  if (diffMs <= 0) return "ended";
  const m = Math.floor(diffMs / 60_000);
  if (m < 1)  return "ending soon";
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m left`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h left`;
}

// Build a tracking URL from a carrier code + tracking number, falling back
// to a universal tracker when we don't recognise the carrier.
function trackingUrl(carrier: string | null, tracking: string): string {
  const c = (carrier ?? "").toUpperCase();
  if (c.includes("USPS"))  return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${tracking}`;
  if (c.includes("UPS"))   return `https://www.ups.com/track?tracknum=${tracking}`;
  if (c.includes("FEDEX")) return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  if (c.includes("DHL"))   return `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
  // Unknown carrier — 17track auto-detects across major carriers.
  return `https://www.17track.net/en/track?nums=${tracking}`;
}

// Absolute end-time label, e.g. "Sun, May 31, 10:00 PM" — local time of the admin.
function endLabel(endTime: string | null): string | null {
  if (!endTime) return null;
  return new Date(endTime).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour:    "numeric", minute: "2-digit",
  });
}

interface Listing {
  id: string; title: string; status: string; url: string | null;
  startPrice: number; buyItNowPrice: number | null; soldPrice: number | null;
  listedAt: string | null; orderId: string; itemId: string;
  ebayListingId: string | null;
  player: string; year: number | null; set: string | null;
  grade: string | null; gradeCompany: string | null; ownerName: string;
  currentBid: number | null; bidCount: number | null; watchCount: number | null;
  endTime: string | null; questionCount: number;
  trackingNumber: string | null; shippedAt: string | null;
  shippingLabelUrl: string | null; buyerName: string | null;
  paidAt: string | null;
  shippingCarrier: string | null;
  buyerUsername: string | null;
}

interface InternalListing {
  id: string; title: string; status: string; url: string | null;
  ebayListingId: string | null;
  listingType: string;
  startPrice: number; buyItNowPrice: number | null; soldPrice: number | null;
  listedAt: string | null; scheduledTime: string | null;
  player: string; year: number | null;
  set: string | null; grade: string | null; gradeCompany: string | null;
  currentBid: number | null; bidCount: number | null; watchCount: number | null;
  endTime: string | null; questionCount: number;
  trackingNumber: string | null; shippedAt: string | null;
  shippingLabelUrl: string | null; buyerName: string | null;
  paidAt: string | null;
  shippingCarrier: string | null;
  buyerUsername: string | null;
}

interface DirectListing {
  ebayItemId: string; title: string | null;
  startPrice: number; currentPrice: number; binPrice: number | null;
  quantitySold: number; bidCount: number; watchCount: number;
  startTime: string | null; endTime: string | null;
  url: string | null; questionCount: number;
}

interface DirectDetail {
  photos: string[];
  specifics: { name: string; value: string }[];
  description: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-500",
  scheduled: "bg-amber-100 text-amber-700",
  active:    "bg-green-100 text-green-700",
  sold:      "bg-blue-100 text-blue-700",
  ended:     "bg-red-100 text-red-500",
};

export function ListingsClient({
  listings: initialListings,
  internalListings: initialInternal,
}: {
  listings: Listing[];
  internalListings: InternalListing[];
}) {
  const params = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<"consignment" | "internal" | "waiting" | "paid" | "shipped">(
    params.get("tab") === "internal" ? "internal"
    : params.get("tab") === "waiting" ? "waiting"
    : params.get("tab") === "paid"    ? "paid"
    : params.get("tab") === "shipped" ? "shipped"
    : "consignment"
  );
  const [listings,  setListings]  = useState(initialListings);
  const [internal,  setInternal]  = useState(initialInternal);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [listing,   setListing]   = useState<string | null>(null);
  const [listError, setListError] = useState<Record<string, string>>({});
  const [ending,    setEnding]    = useState<string | null>(null);
  const [endError,  setEndError]  = useState<Record<string, string>>({});
  const [deletingInt, setDeletingInt] = useState<string | null>(null);
  const [endingInt,   setEndingInt]   = useState<string | null>(null);
  const [endErrInt,   setEndErrInt]   = useState<Record<string, string>>({});

  // Direct eBay listings (loaded when Internal tab opens)
  const [directListings, setDirectListings] = useState<DirectListing[] | null>(null);
  const [directLoading,  setDirectLoading]  = useState(false);
  const [directError,    setDirectError]    = useState<string | null>(null);
  const [endingDirect,   setEndingDirect]   = useState<string | null>(null);
  const [endDirectError, setEndDirectError] = useState<Record<string, string>>({});

  // Expandable detail rows for direct listings
  const [expandedItem,   setExpandedItem]   = useState<string | null>(null);

  // Ticking clock for "time left" labels — bumps every 30s so the
  // countdown stays accurate without a full page refresh.
  const [now, setNow] = useState(() => Date.now());

  // Buyer-message modal — opened from any clickable buyer name on the
  // sold / paid / shipped tabs.
  const [msgTarget, setMsgTarget] = useState<{ itemId: string; recipientId: string; cardTitle: string } | null>(null);
  const openMessage = (itemId: string | null, recipientId: string | null, cardTitle: string) => {
    if (!itemId || !recipientId) return;
    setMsgTarget({ itemId, recipientId, cardTitle });
  };
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const [detailCache,    setDetailCache]    = useState<Record<string, DirectDetail>>({});
  const [detailLoading,  setDetailLoading]  = useState<string | null>(null);
  const [detailError,    setDetailError]    = useState<Record<string, string>>({});
  const [importingItem,  setImportingItem]  = useState<string | null>(null);
  const [importError,    setImportError]    = useState<Record<string, string>>({});

  useEffect(() => {
    if (tab !== "internal" || directListings !== null || directLoading) return;
    setDirectLoading(true);
    setDirectError(null);
    fetch("/api/admin/ebay/direct-listings")
      .then(r => r.json())
      .then(d => {
        if (d.error) setDirectError(d.error);
        else setDirectListings(d.listings ?? []);
      })
      .catch(e => setDirectError(String(e)))
      .finally(() => setDirectLoading(false));
  }, [tab, directListings, directLoading]);

  async function toggleDetail(ebayItemId: string) {
    if (expandedItem === ebayItemId) { setExpandedItem(null); return; }
    setExpandedItem(ebayItemId);
    if (detailCache[ebayItemId]) return;
    setDetailLoading(ebayItemId);
    try {
      const r = await fetch(`/api/admin/ebay/direct-listings/${ebayItemId}`);
      const d = await r.json();
      if (d.error) setDetailError(prev => ({ ...prev, [ebayItemId]: d.error }));
      else setDetailCache(prev => ({ ...prev, [ebayItemId]: d }));
    } catch (e) {
      setDetailError(prev => ({ ...prev, [ebayItemId]: String(e) }));
    }
    setDetailLoading(null);
  }

  async function importAndEdit(ebayItemId: string) {
    setImportingItem(ebayItemId);
    setImportError(prev => ({ ...prev, [ebayItemId]: "" }));
    try {
      const r = await fetch("/api/admin/ebay/import-direct", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebayItemId }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setImportError(prev => ({ ...prev, [ebayItemId]: d.error ?? `Error ${r.status}` }));
      } else {
        router.push(`/admin/internal-listings/${d.id}`);
      }
    } catch (e) {
      setImportError(prev => ({ ...prev, [ebayItemId]: String(e) }));
    }
    setImportingItem(null);
  }

  // ── Consignment actions ─────────────────────────────────────────────────────

  async function listOnEbay(l: Listing) {
    setListing(l.id);
    setListError(prev => ({ ...prev, [l.id]: "" }));
    try {
      const r = await fetch("/api/admin/ebay/list", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingDbId: l.id }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) {
        setListError(prev => ({ ...prev, [l.id]: d?.error ?? `Error ${r.status}` }));
      } else {
        setListings(prev => prev.map(item => item.id === l.id ? { ...item, status: "active", url: d.url } : item));
        router.refresh();
      }
    } catch (e) { setListError(prev => ({ ...prev, [l.id]: String(e) })); }
    setListing(null);
  }

  async function endListing(id: string) {
    if (!confirm("End this eBay listing? The item will be reset to draft so you can edit and relist it.")) return;
    setEnding(id);
    setEndError(prev => ({ ...prev, [id]: "" }));
    try {
      const r = await fetch("/api/admin/ebay/end", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingDbId: id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setEndError(prev => ({ ...prev, [id]: d?.error ?? `Error ${r.status}` }));
      else { setListings(prev => prev.map(l => l.id === id ? { ...l, status: "ended", url: null } : l)); router.refresh(); }
    } catch (e) { setEndError(prev => ({ ...prev, [id]: String(e) })); }
    setEnding(null);
  }

  async function deleteListing(id: string) {
    if (!confirm("Delete this draft listing? The consignment item will be reset to 'received' so it can be listed again.")) return;
    setDeleting(id);
    const r = await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
    if (r.ok) { setListings(prev => prev.filter(l => l.id !== id)); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); alert(d.error ?? "Failed to delete listing"); }
    setDeleting(null);
  }

  // ── Internal actions ────────────────────────────────────────────────────────

  async function endInternalListing(id: string) {
    if (!confirm("End this eBay listing?")) return;
    setEndingInt(id);
    setEndErrInt(prev => ({ ...prev, [id]: "" }));
    try {
      const r = await fetch("/api/admin/ebay/end-internal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingDbId: id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setEndErrInt(prev => ({ ...prev, [id]: d?.error ?? `Error ${r.status}` }));
      else setInternal(prev => prev.map(l => l.id === id ? { ...l, status: "ended", url: null } : l));
    } catch (e) { setEndErrInt(prev => ({ ...prev, [id]: String(e) })); }
    setEndingInt(null);
  }

  async function deleteInternalListing(id: string) {
    if (!confirm("Delete this internal listing? This cannot be undone.")) return;
    setDeletingInt(id);
    const r = await fetch(`/api/admin/internal-listings/${id}`, { method: "DELETE" });
    if (r.ok) setInternal(prev => prev.filter(l => l.id !== id));
    else { const d = await r.json().catch(() => ({})); alert(d.error ?? "Failed to delete"); }
    setDeletingInt(null);
  }

  async function endDirectListing(ebayItemId: string) {
    if (!confirm("End this eBay listing? This cannot be undone.")) return;
    setEndingDirect(ebayItemId);
    setEndDirectError(prev => ({ ...prev, [ebayItemId]: "" }));
    try {
      const r = await fetch("/api/admin/ebay/end-direct", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebayItemId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setEndDirectError(prev => ({ ...prev, [ebayItemId]: d?.error ?? `Error ${r.status}` }));
      else {
        setDirectListings(prev => prev?.filter(l => l.ebayItemId !== ebayItemId) ?? null);
        if (expandedItem === ebayItemId) setExpandedItem(null);
      }
    } catch (e) { setEndDirectError(prev => ({ ...prev, [ebayItemId]: String(e) })); }
    setEndingDirect(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          {(["consignment", "internal", "waiting", "paid", "shipped"] as const).map(t => {
            const label = t === "consignment" ? "Consignment"
                        : t === "internal"    ? "Internal"
                        : t === "waiting"     ? "Waiting for payment"
                        : t === "paid"        ? "Waiting to be Shipped"
                        : "Shipped";
            const waitingCount = [...listings, ...internal].filter(l => l.status === "sold").length;
            const paidCount    = [...listings, ...internal].filter(l => l.status === "paid").length;
            const shippedCount = [...listings, ...internal].filter(l => l.status === "shipped").length;
            const count = t === "waiting" ? waitingCount
                        : t === "paid"    ? paidCount
                        : t === "shipped" ? shippedCount : 0;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
                {label}{count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
        {tab === "internal" && (
          <Link href="/admin/internal-listings/new"
            className="bg-brand text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-blue-600 transition-colors">
            + New internal listing
          </Link>
        )}
      </div>

      {/* Consignment tab */}
      {tab === "consignment" && (
        listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <p className="text-slate-400 text-sm">No consignment listings yet. Open a received consignment order and generate a listing on any item.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Card</th>
                  <th className="text-left px-5 py-3">Consignor</th>
                  <th className="text-left px-5 py-3">Price</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Listed</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {listings.map((l, i) => (
                  <tr key={l.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-5 py-3">
                      <p className="text-navy font-medium">{l.player}</p>
                      <p className="text-slate-400 text-xs">{l.year} · {l.set}{l.grade ? ` · ${l.gradeCompany} ${l.grade}` : ""}</p>
                      <p className="text-slate-500 text-xs mt-0.5 break-words">{l.title}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{l.ownerName}</td>
                    <td className="px-5 py-3">
                      {l.currentBid != null && (l.bidCount ?? 0) > 0 && (
                        <p className="text-green-700 font-semibold text-xs">
                          ${usd(l.currentBid)} <span className="text-slate-500 font-normal">({l.bidCount} bid{l.bidCount === 1 ? "" : "s"})</span>
                        </p>
                      )}
                      <p className="text-navy font-medium text-xs">${usd(l.startPrice)} start</p>
                      {l.buyItNowPrice && <p className="text-slate-400 text-xs">BIN ${usd(l.buyItNowPrice)}</p>}
                      {l.soldPrice && <p className="text-green-600 font-semibold text-xs">Sold ${usd(l.soldPrice)}</p>}
                      {l.status === "active" && (l.watchCount ?? 0) > 0 && (
                        <p className="text-slate-500 text-xs mt-0.5" title="Watchers on eBay">👁 {l.watchCount} watching</p>
                      )}
                      {l.questionCount > 0 && (
                        <p className="text-amber-700 text-xs mt-0.5" title="Buyer questions in last 30 days">💬 {l.questionCount} question{l.questionCount === 1 ? "" : "s"}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[l.status] ?? "bg-slate-100 text-slate-500"}`}>{l.status}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {l.listedAt ? new Date(l.listedAt).toLocaleDateString() : "—"}
                      {l.status === "active" && timeLeft(l.endTime, now) && (
                        <>
                          <p className="text-navy text-xs mt-0.5">{timeLeft(l.endTime, now)}</p>
                          <p className="text-slate-500 text-xs">ends {endLabel(l.endTime)}</p>
                        </>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1.5 items-start">
                        {l.status === "draft" && (
                          <button onClick={() => listOnEbay(l)} disabled={listing === l.id}
                            className="flex items-center gap-1.5 bg-[#e43137] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#c0282d] disabled:opacity-50 transition-colors whitespace-nowrap">
                            {listing === l.id ? "Listing…" : "List on eBay"}
                          </button>
                        )}
                        {listError[l.id] && <p className="text-red-500 text-xs max-w-[200px] leading-tight">{listError[l.id].slice(0, 150)}</p>}
                        {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brand text-xs hover:underline font-medium">View on eBay →</a>}
                        <Link href={`/admin/consignments/${l.orderId}`} className="text-slate-400 text-xs hover:text-navy transition-colors">
                          {l.status === "draft" ? "Edit listing" : "View order"}
                        </Link>
                        {l.status === "active" && <Link href={`/admin/consignments/${l.orderId}`} className="text-brand text-xs hover:underline font-medium">Edit listing</Link>}
                        {l.status === "active" && (
                          <button onClick={() => endListing(l.id)} disabled={ending === l.id} className="text-red-400 hover:text-red-600 text-xs transition-colors disabled:opacity-50">
                            {ending === l.id ? "Ending…" : "End listing"}
                          </button>
                        )}
                        {endError[l.id] && <p className="text-red-500 text-xs max-w-[200px] leading-tight">{endError[l.id].slice(0, 150)}</p>}
                        {l.status === "draft" && (
                          <button onClick={() => deleteListing(l.id)} disabled={deleting === l.id} className="text-red-400 hover:text-red-600 text-xs transition-colors disabled:opacity-50">
                            {deleting === l.id ? "Deleting…" : "Delete draft"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Waiting for payment tab — sold but not yet paid (waiting for buyer to pay) */}
      {tab === "waiting" && (() => {
        const waitingConsign  = listings.filter(l => l.status === "sold");
        const waitingInternal = internal.filter(l => l.status === "sold");
        const total = waitingConsign.length + waitingInternal.length;
        if (total === 0) {
          return (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <p className="text-navy font-semibold mb-2">No items waiting for payment</p>
              <p className="text-slate-400 text-sm">Listings show up here after a buyer commits but before they pay. Once payment is received, they move to <Link href="/admin/shipping" className="text-brand hover:underline">Shipping</Link>.</p>
            </div>
          );
        }
        return (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Card</th>
                  <th className="text-left px-5 py-3">Buyer</th>
                  <th className="text-left px-5 py-3">Sale price</th>
                  <th className="text-left px-5 py-3">Sold</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {[...waitingConsign.map(l => ({ ...l, kind: "consignment" as const })),
                  ...waitingInternal.map(l => ({ ...l, kind: "internal"   as const }))]
                  .sort((a, b) => (b.listedAt ?? "").localeCompare(a.listedAt ?? ""))
                  .map((l, i) => (
                    <tr key={`${l.kind}-${l.id}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-5 py-3">
                        <p className="text-navy font-medium">{l.player}</p>
                        <p className="text-slate-400 text-xs">{l.year} · {l.set}</p>
                        <p className="text-slate-500 text-xs mt-0.5 break-words">{l.title}</p>
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {l.buyerName ? (
                          <button onClick={() => openMessage(l.ebayListingId, l.buyerUsername, l.title ?? l.player)}
                            disabled={!l.ebayListingId || !l.buyerUsername}
                            title={l.buyerUsername ? `Message ${l.buyerUsername} on eBay` : "Buyer username not yet synced"}
                            className="text-brand hover:underline disabled:text-navy disabled:no-underline disabled:cursor-default">
                            {l.buyerName}
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">not yet synced</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-navy font-medium">{l.soldPrice != null ? `$${usd(l.soldPrice)}` : <span className="text-slate-400 italic">price syncing…</span>}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{l.listedAt ? new Date(l.listedAt).toLocaleDateString() : "—"}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={async () => {
                            const r = await fetch(`/api/admin/${l.kind === "internal" ? "internal-listings" : "consignment-listings"}/${l.id}/mark-paid`, { method: "POST" });
                            if (r.ok) router.refresh();
                            else alert("Failed — see console.");
                          }}
                          className="text-brand text-xs font-medium hover:underline">
                          Mark as paid
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Waiting to be Shipped — paid but not yet shipped. Mirrors the
          "Ready to ship" filter on the Shipping admin page. */}
      {tab === "paid" && (() => {
        const paidConsign  = listings.filter(l => l.status === "paid");
        const paidInternal = internal.filter(l => l.status === "paid");
        const total = paidConsign.length + paidInternal.length;
        if (total === 0) {
          return (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <p className="text-navy font-semibold mb-2">Nothing waiting to ship</p>
              <p className="text-slate-400 text-sm">Listings show up here once a buyer pays. Create a label or mark them shipped on the <Link href="/admin/shipping" className="text-brand hover:underline">Shipping</Link> page.</p>
            </div>
          );
        }
        return (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Card</th>
                  <th className="text-left px-5 py-3">Buyer</th>
                  <th className="text-left px-5 py-3">Sale</th>
                  <th className="text-left px-5 py-3">Paid</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {[...paidConsign.map(l => ({ ...l, kind: "consignment" as const })),
                  ...paidInternal.map(l => ({ ...l, kind: "internal"   as const }))]
                  .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))
                  .map((l, i) => (
                    <tr key={`paid-${l.kind}-${l.id}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-5 py-3 align-top">
                        <p className="text-navy font-medium">{l.player}</p>
                        <p className="text-slate-400 text-xs">{l.year} · {l.set}{l.grade ? ` · ${l.gradeCompany} ${l.grade}` : ""}</p>
                        <p className="text-slate-500 text-xs mt-0.5 break-words">{l.title}</p>
                        {l.ebayListingId && (
                          <p className="text-slate-400 text-xs mt-0.5">
                            eBay #{l.ebayListingId}{" "}
                            {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top text-xs">
                        {l.buyerName ? (
                          <button onClick={() => openMessage(l.ebayListingId, l.buyerUsername, l.title ?? l.player)}
                            disabled={!l.ebayListingId || !l.buyerUsername}
                            title={l.buyerUsername ? `Message ${l.buyerUsername} on eBay` : "Buyer username not yet synced"}
                            className="text-brand hover:underline disabled:text-navy disabled:no-underline disabled:cursor-default">
                            {l.buyerName}
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top">
                        {l.soldPrice != null && <p className="text-navy font-medium text-xs">${usd(l.soldPrice)}</p>}
                      </td>
                      <td className="px-5 py-3 align-top text-xs">
                        {l.paidAt && <p className="text-green-700 font-semibold">Paid {new Date(l.paidAt).toLocaleDateString()}</p>}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <Link href="/admin/shipping" className="text-brand text-xs hover:underline font-medium whitespace-nowrap">
                          Create label →
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Shipped tab — listings whose status === "shipped". Mirrors the
          shipping admin page's "Shipped" filter so all flavours of listing
          (consignment + internal) appear together with tracking info. */}
      {tab === "shipped" && (() => {
        const shippedConsign  = listings.filter(l => l.status === "shipped");
        const shippedInternal = internal.filter(l => l.status === "shipped");
        const total = shippedConsign.length + shippedInternal.length;
        if (total === 0) {
          return (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <p className="text-navy font-semibold mb-2">No shipped items yet</p>
              <p className="text-slate-400 text-sm">Listings appear here once you create a shipping label or mark them shipped on the <Link href="/admin/shipping" className="text-brand hover:underline">Shipping</Link> page.</p>
            </div>
          );
        }
        return (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Card</th>
                  <th className="text-left px-5 py-3">Buyer</th>
                  <th className="text-left px-5 py-3">Sale</th>
                  <th className="text-left px-5 py-3">Shipping</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {[...shippedConsign.map(l => ({ ...l, kind: "consignment" as const })),
                  ...shippedInternal.map(l => ({ ...l, kind: "internal"   as const }))]
                  .sort((a, b) => (b.shippedAt ?? "").localeCompare(a.shippedAt ?? ""))
                  .map((l, i) => (
                    <tr key={`shipped-${l.kind}-${l.id}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-5 py-3 align-top">
                        <p className="text-navy font-medium">{l.player}</p>
                        <p className="text-slate-400 text-xs">{l.year} · {l.set}{l.grade ? ` · ${l.gradeCompany} ${l.grade}` : ""}</p>
                        <p className="text-slate-500 text-xs mt-0.5 break-words">{l.title}</p>
                        {l.ebayListingId && (
                          <p className="text-slate-400 text-xs mt-0.5">
                            eBay #{l.ebayListingId}{" "}
                            {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top text-xs">
                        {l.buyerName ? (
                          <button onClick={() => openMessage(l.ebayListingId, l.buyerUsername, l.title ?? l.player)}
                            disabled={!l.ebayListingId || !l.buyerUsername}
                            title={l.buyerUsername ? `Message ${l.buyerUsername} on eBay` : "Buyer username not yet synced"}
                            className="text-brand hover:underline disabled:text-navy disabled:no-underline disabled:cursor-default">
                            {l.buyerName}
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top">
                        {l.soldPrice != null && <p className="text-navy font-medium text-xs">${usd(l.soldPrice)}</p>}
                      </td>
                      <td className="px-5 py-3 align-top text-xs">
                        {l.shippedAt && <p className="text-green-700 font-semibold">Shipped {new Date(l.shippedAt).toLocaleDateString()}</p>}
                        {l.trackingNumber ? (
                          <p className="text-slate-500 mt-0.5">
                            {l.shippingCarrier ? `${l.shippingCarrier}: ` : "Tracking: "}
                            <a
                              href={trackingUrl(l.shippingCarrier, l.trackingNumber)}
                              target="_blank" rel="noopener noreferrer"
                              className="text-brand font-mono hover:underline"
                            >
                              {l.trackingNumber}
                            </a>
                          </p>
                        ) : (
                          <p className="text-slate-400 italic">No tracking #</p>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top">
                        {l.shippingLabelUrl && (
                          <a href={l.shippingLabelUrl} target="_blank" rel="noopener noreferrer"
                             className="text-brand text-xs hover:underline font-medium whitespace-nowrap">
                            ↓ Print label
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Internal tab — site-created listings */}
      {tab === "internal" && (() => {
        // Show only in-flight listings here. Once a listing flips to
        // sold / paid / shipped / ended it lives in its dedicated tab.
        const internalActive = internal.filter(l => ["draft", "scheduled", "active"].includes(l.status));
        return (
        <>
          {internalActive.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <p className="text-navy font-semibold mb-2">No active internal listings</p>
              <p className="text-slate-400 text-sm mb-4">Create a listing for cards from your own inventory.</p>
              <Link href="/admin/internal-listings/new"
                className="inline-block bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 transition-colors">
                + New internal listing
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3">Card</th>
                    <th className="text-left px-5 py-3">Price</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Listed</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {internalActive.map((l, i) => (
                    <tr key={l.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-5 py-3">
                        <p className="text-navy font-medium">{l.player}</p>
                        <p className="text-slate-400 text-xs">{l.year} · {l.set}{l.grade ? ` · ${l.gradeCompany} ${l.grade}` : ""}</p>
                        <p className="text-slate-500 text-xs mt-0.5 break-words">{l.title || <span className="italic">Draft</span>}</p>
                        {l.ebayListingId && (
                          <p className="text-slate-400 text-xs mt-0.5">
                            eBay #{l.ebayListingId}{" "}
                            {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {l.listingType === "auction" && l.currentBid != null && (l.bidCount ?? 0) > 0 ? (
                          <p className="text-green-700 font-semibold text-xs">
                            ${usd(l.currentBid)} <span className="text-slate-500 font-normal">({l.bidCount} bid{l.bidCount === 1 ? "" : "s"})</span>
                          </p>
                        ) : null}
                        <p className="text-navy font-medium text-xs">${usd(l.startPrice)} start</p>
                        {l.buyItNowPrice && <p className="text-slate-400 text-xs">BIN ${usd(l.buyItNowPrice)}</p>}
                        {l.soldPrice && <p className="text-green-600 font-semibold text-xs">Sold ${usd(l.soldPrice)}</p>}
                        {l.status === "active" && (l.watchCount ?? 0) > 0 && (
                          <p className="text-slate-500 text-xs mt-0.5" title="Watchers on eBay">👁 {l.watchCount} watching</p>
                        )}
                        {l.questionCount > 0 && (
                          <p className="text-amber-700 text-xs mt-0.5" title="Buyer questions in last 30 days">💬 {l.questionCount} question{l.questionCount === 1 ? "" : "s"}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {(() => {
                          const futureScheduled = l.scheduledTime && new Date(l.scheduledTime).getTime() > Date.now();
                          const displayStatus = futureScheduled && (l.status === "active" || l.status === "scheduled") ? "scheduled" : l.status;
                          return (
                            <>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[displayStatus] ?? "bg-slate-100 text-slate-500"}`}>{displayStatus}</span>
                              {displayStatus === "scheduled" && l.scheduledTime && (
                                <p className="text-amber-700 text-xs mt-0.5">Starts {new Date(l.scheduledTime).toLocaleString()}</p>
                              )}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {l.listedAt ? new Date(l.listedAt).toLocaleDateString() : "—"}
                        {l.status === "active" && timeLeft(l.endTime, now) && (
                          <>
                            <p className="text-navy text-xs mt-0.5">{timeLeft(l.endTime, now)}</p>
                            <p className="text-slate-500 text-xs">ends {endLabel(l.endTime)}</p>
                          </>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1.5 items-start">
                          <Link href={`/admin/internal-listings/${l.id}`} className="text-brand text-xs hover:underline font-medium">
                            {l.status === "draft" ? "Edit listing" : "View / Edit listing"}
                          </Link>
                          {(l.status === "active" || l.status === "scheduled") && l.ebayListingId && (
                            <button onClick={() => endInternalListing(l.id)} disabled={endingInt === l.id}
                              className="text-red-400 hover:text-red-600 text-xs transition-colors disabled:opacity-50">
                              {endingInt === l.id ? "Ending…" : "End listing"}
                            </button>
                          )}
                          {endErrInt[l.id] && <p className="text-red-500 text-xs max-w-[200px] leading-tight">{endErrInt[l.id].slice(0, 150)}</p>}
                          {/* Allow delete unless the listing is actually live on eBay */}
                          {!((l.status === "active" || l.status === "scheduled") && l.ebayListingId) && (
                            <button onClick={() => deleteInternalListing(l.id)} disabled={deletingInt === l.id}
                              className="text-red-400 hover:text-red-600 text-xs transition-colors disabled:opacity-50">
                              {deletingInt === l.id ? "Deleting…" : "Delete"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Direct eBay listings section */}
          <div className="mt-2">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Listed directly on eBay</p>
            {directLoading ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <p className="text-slate-400 text-sm">Loading from eBay…</p>
              </div>
            ) : directError ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
                <p className="text-red-500 text-sm mb-2">Could not load eBay listings</p>
                <p className="text-slate-400 text-xs">{directError}</p>
                <button onClick={() => { setDirectListings(null); setDirectError(null); }}
                  className="mt-3 text-brand text-xs hover:underline">Retry</button>
              </div>
            ) : directListings === null ? null
              : directListings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
                <p className="text-slate-400 text-sm">No listings found that were created directly on eBay.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3">Card</th>
                      <th className="text-left px-5 py-3">Price</th>
                      <th className="text-left px-5 py-3">Status</th>
                      <th className="text-left px-5 py-3">Listed</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {directListings.map((l, i) => {
                      const isExpanded = expandedItem === l.ebayItemId;
                      const detail     = detailCache[l.ebayItemId];
                      const loading    = detailLoading === l.ebayItemId;
                      return (
                        <Fragment key={l.ebayItemId}>
                          <tr className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                            <td className="px-5 py-3">
                              <p className="text-navy font-medium break-words">{l.title ?? l.ebayItemId}</p>
                              <p className="text-slate-400 text-xs mt-0.5">
                                eBay #{l.ebayItemId}{" "}
                                {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>}
                              </p>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-navy font-medium text-xs">${usd(l.currentPrice)}{l.bidCount > 0 && <span className="text-slate-500 font-normal"> ({l.bidCount} bid{l.bidCount === 1 ? "" : "s"})</span>}</p>
                              {l.binPrice !== null && <p className="text-slate-400 text-xs">BIN ${usd(l.binPrice)}</p>}
                              {l.quantitySold > 0 && <p className="text-green-600 text-xs">{l.quantitySold} sold</p>}
                              {l.watchCount > 0 && (
                                <p className="text-slate-500 text-xs mt-0.5" title="Watchers on eBay">👁 {l.watchCount} watching</p>
                              )}
                              {l.questionCount > 0 && (
                                <p className="text-amber-700 text-xs mt-0.5" title="Buyer questions in last 30 days">💬 {l.questionCount} question{l.questionCount === 1 ? "" : "s"}</p>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE.active}`}>active</span>
                            </td>
                            <td className="px-5 py-3 text-slate-400 text-xs">
                              {l.startTime ? new Date(l.startTime).toLocaleDateString() : "—"}
                              {timeLeft(l.endTime, now) && (
                                <>
                                  <p className="text-navy text-xs mt-0.5">{timeLeft(l.endTime, now)}</p>
                                  <p className="text-slate-500 text-xs">ends {endLabel(l.endTime)}</p>
                                </>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex flex-col gap-1.5 items-start">
                                <button onClick={() => importAndEdit(l.ebayItemId)}
                                  disabled={importingItem === l.ebayItemId}
                                  className="text-brand text-xs hover:underline font-medium disabled:opacity-50">
                                  {importingItem === l.ebayItemId ? "Loading…" : "Edit listing"}
                                </button>
                                <button onClick={() => toggleDetail(l.ebayItemId)}
                                  className="text-slate-400 text-xs hover:text-navy">
                                  {loading ? "Loading…" : isExpanded ? "▲ Hide preview" : "▼ Preview"}
                                </button>
                                <button onClick={() => endDirectListing(l.ebayItemId)} disabled={endingDirect === l.ebayItemId}
                                  className="text-red-400 hover:text-red-600 text-xs transition-colors disabled:opacity-50">
                                  {endingDirect === l.ebayItemId ? "Ending…" : "End listing"}
                                </button>
                                {importError[l.ebayItemId] && (
                                  <p className="text-red-500 text-xs max-w-[200px] leading-tight">{importError[l.ebayItemId].slice(0, 150)}</p>
                                )}
                                {endDirectError[l.ebayItemId] && (
                                  <p className="text-red-500 text-xs max-w-[200px] leading-tight">{endDirectError[l.ebayItemId].slice(0, 150)}</p>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${l.ebayItemId}-detail`} className="bg-slate-50/80 border-t border-slate-100">
                              <td colSpan={5} className="px-5 py-5">
                                {detailError[l.ebayItemId] ? (
                                  <p className="text-red-500 text-sm">{detailError[l.ebayItemId]}</p>
                                ) : !detail ? (
                                  <p className="text-slate-400 text-sm">Loading listing details…</p>
                                ) : (
                                  <div className="flex flex-col gap-4">
                                    {/* Photos */}
                                    {detail.photos.length > 0 && (
                                      <div className="flex gap-2 flex-wrap">
                                        {detail.photos.slice(0, 8).map((url, pi) => (
                                          <img key={pi} src={url} alt={`Photo ${pi + 1}`}
                                            className="h-24 w-24 object-contain rounded-lg border border-slate-200 bg-white" />
                                        ))}
                                      </div>
                                    )}
                                    {/* Item specifics */}
                                    {detail.specifics.length > 0 && (
                                      <div>
                                        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Item details</p>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                                          {detail.specifics.map((s, si) => (
                                            <div key={si} className="flex gap-2">
                                              <span className="text-slate-400 shrink-0 w-32">{s.name}</span>
                                              <span className="text-navy">{s.value}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Description */}
                                    {detail.description && (
                                      <div>
                                        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Description</p>
                                        <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{detail.description}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
        );
      })()}

      <MessageBuyerModal
        open={msgTarget != null}
        onClose={() => setMsgTarget(null)}
        itemId={msgTarget?.itemId ?? ""}
        recipientId={msgTarget?.recipientId ?? ""}
        cardTitle={msgTarget?.cardTitle ?? ""}
      />
    </div>
  );
}

