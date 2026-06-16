"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageBuyerModal } from "./MessageBuyerModal";
import { trackingUrl } from "@/lib/tracking";

// US dollar formatter — always two decimals (so $17.5 displays as $17.50).
const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Shared column widths for the Internal listings table and the Direct-on-
// eBay table so the two tables line up visually across the page boundary.
// Total = 100%; tweaks should keep them summing to 100.
const FIVE_COL_GROUP = (
  <colgroup>
    <col style={{ width: "38%" }} />
    <col style={{ width: "18%" }} />
    <col style={{ width: "12%" }} />
    <col style={{ width: "16%" }} />
    <col style={{ width: "16%" }} />
  </colgroup>
);

// Six-column variant used on the Internal tab (both internal_listings and
// direct-on-eBay tables) so the Watchers column slot stays consistent across
// them. Card / Price / Watchers / Status / Listed / Actions.
const SIX_COL_GROUP = (
  <colgroup>
    <col style={{ width: "35%" }} />
    <col style={{ width: "16%" }} />
    <col style={{ width:  "9%" }} />
    <col style={{ width: "11%" }} />
    <col style={{ width: "15%" }} />
    <col style={{ width: "14%" }} />
  </colgroup>
);

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
  grade: string | null; gradeCompany: string | null; graded: boolean; ownerName: string;
  currentBid: number | null; bidCount: number | null; watchCount: number | null;
  endTime: string | null; questionCount: number;
  trackingNumber: string | null; shippedAt: string | null;
  shippingLabelUrl: string | null; buyerName: string | null;
  paidAt: string | null;
  soldAt: string | null;
  shippingCarrier: string | null;
  buyerUsername: string | null;
  shippingPostageCost: number | null;
  shippingSupplyCost:  number | null;
  ebayPayoutAmount:    number | null;
  ebayFeeAmount:       number | null;
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
  soldAt: string | null;
  shippingCarrier: string | null;
  buyerUsername: string | null;
  shippingPostageCost: number | null;
  shippingSupplyCost:  number | null;
  ebayPayoutAmount:    number | null;
  ebayFeeAmount:       number | null;
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
  pending:   "bg-amber-100 text-amber-700",
  scheduled: "bg-amber-100 text-amber-700",
  active:    "bg-green-100 text-green-700",
  sold:      "bg-blue-100 text-blue-700",
  ended:     "bg-red-100 text-red-500",
};

interface BatchProgressItem {
  kind:        "consignment" | "internal";
  listingDbId: string;
  title:       string;
  state:       "queued" | "publishing" | "success" | "failed";
  url?:        string;
  error?:      string;
}

export function ListingsClient({
  listings: initialListings,
  internalListings: initialInternal,
  commissionRaw,
  commissionGraded,
}: {
  listings: Listing[];
  internalListings: InternalListing[];
  commissionRaw:    number;
  commissionGraded: number;
}) {
  const params = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<"drafts" | "consignment" | "internal" | "scheduled" | "waiting" | "paid" | "shipped" | "ended" | "payout">(
    params.get("tab") === "drafts"      ? "drafts"
    : params.get("tab") === "internal"   ? "internal"
    : params.get("tab") === "scheduled" ? "scheduled"
    : params.get("tab") === "waiting"   ? "waiting"
    : params.get("tab") === "paid"      ? "paid"
    : params.get("tab") === "shipped"   ? "shipped"
    : params.get("tab") === "ended"     ? "ended"
    : params.get("tab") === "payout"    ? "payout"
    : "consignment"
  );

  // Multi-select on the Drafts tab — checkbox state, keyed by `${kind}:${id}`
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const toggleSelected = (kind: "consignment" | "internal", id: string) => {
    const key = `${kind}:${id}`;
    setSelectedDrafts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  // Global search — when non-empty, overrides the tab view and shows
  // every listing that matches across both consignment + internal sets.
  const [search, setSearch] = useState("");
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

  // Per-row status flip "Add to batch" / "Remove from batch"
  const [batchToggling, setBatchToggling] = useState<string | null>(null);

  // Batch publish modal — null while idle, populated while running and afterward
  const [batchProgress, setBatchProgress] = useState<BatchProgressItem[] | null>(null);
  const [batchRunning,  setBatchRunning]  = useState(false);

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
    // Load direct-on-eBay listings on mount (was: only on Internal tab open)
    // so they're searchable from the global search box too.
    if (directListings !== null || directLoading) return;
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
  }, [directListings, directLoading]);

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

  async function setBatchStatus(kind: "consignment" | "internal", id: string, newStatus: "pending" | "draft") {
    setBatchToggling(id);
    setListError(prev => ({ ...prev, [id]: "" }));
    try {
      const url = kind === "internal" ? `/api/admin/internal-listings/${id}` : `/api/admin/listings/${id}`;
      const r = await fetch(url, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      if (r.ok) {
        if (kind === "internal") setInternal(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
        else                     setListings(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
      } else {
        setListError(prev => ({ ...prev, [id]: newStatus === "pending" ? "Failed to queue" : "Failed to remove" }));
      }
    } catch (e) { setListError(prev => ({ ...prev, [id]: String(e) })); }
    setBatchToggling(null);
  }

  const addToBatch       = (kind: "consignment" | "internal", l: { id: string }) => setBatchStatus(kind, l.id, "pending");
  const removeFromBatch  = (kind: "consignment" | "internal", l: { id: string }) => setBatchStatus(kind, l.id, "draft");

  async function listAllPending() {
    const pendingC = listings.filter(l => l.status === "pending").map(p => ({ kind: "consignment" as const, id: p.id, title: p.title }));
    const pendingI = internal.filter(l => l.status === "pending").map(p => ({ kind: "internal"     as const, id: p.id, title: p.title }));
    const all = [...pendingC, ...pendingI];
    if (all.length === 0) return;
    if (!confirm(`List all ${all.length} pending listing${all.length !== 1 ? "s" : ""} on eBay now?`)) return;

    const initial: BatchProgressItem[] = all.map(p => ({
      kind: p.kind, listingDbId: p.id, title: p.title, state: "queued",
    }));
    setBatchProgress(initial);
    setBatchRunning(true);
    setBatchProgress(initial.map(p => ({ ...p, state: "publishing" as const })));

    try {
      const r = await fetch("/api/admin/ebay/list-batch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ refs: all.map(p => ({ kind: p.kind, id: p.id })) }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.results) {
        setBatchProgress(initial.map(p => ({ ...p, state: "failed" as const, error: d?.error ?? `HTTP ${r.status}` })));
      } else {
        setBatchProgress(initial.map(p => {
          const res = d.results.find((x: { listingDbId: string; kind: string; ok: boolean; url?: string; error?: string }) =>
            x.listingDbId === p.listingDbId && x.kind === p.kind);
          if (!res) return { ...p, state: "failed", error: "No result returned" };
          return res.ok
            ? { ...p, state: "success", url: res.url }
            : { ...p, state: "failed",  error: res.error };
        }));
        const consignResults = d.results.filter((x: { kind: string }) => x.kind === "consignment");
        const internalResults = d.results.filter((x: { kind: string }) => x.kind === "internal");
        setListings(prev => prev.map(item => {
          const res = consignResults.find((x: { listingDbId: string; ok: boolean; url?: string }) => x.listingDbId === item.id);
          if (!res) return item;
          return res.ok ? { ...item, status: "active", url: res.url ?? item.url } : item;
        }));
        setInternal(prev => prev.map(item => {
          const res = internalResults.find((x: { listingDbId: string; ok: boolean; url?: string }) => x.listingDbId === item.id);
          if (!res) return item;
          return res.ok ? { ...item, status: "active", url: res.url ?? item.url } : item;
        }));
        router.refresh();
      }
    } catch (e) {
      setBatchProgress(initial.map(p => ({ ...p, state: "failed" as const, error: String(e) })));
    }
    setBatchRunning(false);
  }

  async function listSelected() {
    // Drafts-tab fast path: take the currently-selected rows, skip the
    // intermediate "pending" state, and fire /api/admin/ebay/list-batch
    // directly. Failures stay on the row's status (draft / pending) with
    // the error label so they can be fixed and retried.
    const refs: { kind: "consignment" | "internal"; id: string; title: string }[] = [];
    for (const key of selectedDrafts) {
      const [kind, id] = key.split(":") as ["consignment" | "internal", string];
      const row = kind === "internal"
        ? internal.find(l => l.id === id)
        : listings.find(l => l.id === id);
      if (row) refs.push({ kind, id, title: row.title });
    }
    if (refs.length === 0) return;
    if (!confirm(`List ${refs.length} selected listing${refs.length !== 1 ? "s" : ""} on eBay now?`)) return;

    const initial: BatchProgressItem[] = refs.map(r => ({
      kind: r.kind, listingDbId: r.id, title: r.title, state: "queued",
    }));
    setBatchProgress(initial);
    setBatchRunning(true);
    setBatchProgress(initial.map(p => ({ ...p, state: "publishing" as const })));

    try {
      const r = await fetch("/api/admin/ebay/list-batch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ refs: refs.map(r => ({ kind: r.kind, id: r.id })) }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.results) {
        setBatchProgress(initial.map(p => ({ ...p, state: "failed" as const, error: d?.error ?? `HTTP ${r.status}` })));
      } else {
        setBatchProgress(initial.map(p => {
          const res = d.results.find((x: { listingDbId: string; kind: string; ok: boolean; url?: string; error?: string }) =>
            x.listingDbId === p.listingDbId && x.kind === p.kind);
          if (!res) return { ...p, state: "failed", error: "No result returned" };
          return res.ok
            ? { ...p, state: "success", url: res.url }
            : { ...p, state: "failed",  error: res.error };
        }));
        const consignResults  = d.results.filter((x: { kind: string }) => x.kind === "consignment");
        const internalResults = d.results.filter((x: { kind: string }) => x.kind === "internal");
        setListings(prev => prev.map(item => {
          const res = consignResults.find((x: { listingDbId: string; ok: boolean; url?: string }) => x.listingDbId === item.id);
          if (!res) return item;
          return res.ok ? { ...item, status: "active", url: res.url ?? item.url } : item;
        }));
        setInternal(prev => prev.map(item => {
          const res = internalResults.find((x: { listingDbId: string; ok: boolean; url?: string }) => x.listingDbId === item.id);
          if (!res) return item;
          return res.ok ? { ...item, status: "active", url: res.url ?? item.url } : item;
        }));
        setSelectedDrafts(new Set());
        router.refresh();
      }
    } catch (e) {
      setBatchProgress(initial.map(p => ({ ...p, state: "failed" as const, error: String(e) })));
    }
    setBatchRunning(false);
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
          {(["drafts", "consignment", "internal", "scheduled", "waiting", "paid", "shipped", "ended", "payout"] as const).map(t => {
            const label = t === "drafts"      ? "Drafts"
                        : t === "consignment" ? "Consignment"
                        : t === "internal"    ? "Internal"
                        : t === "scheduled"   ? "Scheduled"
                        : t === "waiting"     ? "Waiting for payment"
                        : t === "paid"        ? "Waiting to be Shipped"
                        : t === "shipped"     ? "Shipped"
                        : t === "ended"       ? "Ended"
                        : "Payout";
            const draftCount     = [...listings, ...internal].filter(l => l.status === "draft" || l.status === "pending").length;
            const scheduledCount = [...listings, ...internal].filter(l => l.status === "scheduled").length;
            const waitingCount   = [...listings, ...internal].filter(l => l.status === "sold").length;
            const paidCount      = [...listings, ...internal].filter(l => l.status === "paid").length;
            const shippedCount   = [...listings, ...internal].filter(l => l.status === "shipped").length;
            const endedCount     = [...listings, ...internal].filter(l => l.status === "ended").length;
            const payoutCount    = [...listings, ...internal].filter(l => l.status === "shipped" && l.soldPrice != null).length;
            const count = t === "drafts"    ? draftCount
                        : t === "scheduled" ? scheduledCount
                        : t === "waiting"   ? waitingCount
                        : t === "paid"      ? paidCount
                        : t === "shipped"   ? shippedCount
                        : t === "ended"     ? endedCount
                        : t === "payout"    ? payoutCount : 0;
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

      {/* Global search — when filled, overrides the tab view with a single
          unified list of matching listings across both consignment + internal. */}
      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search all listings by title, player, eBay #, buyer…"
          className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand bg-white"
        />
      </div>

      {/* Search results — replaces every tab body when search is non-empty.
          Covers consignment, internal, and direct-on-eBay listings. */}
      {search.trim() && (() => {
        const q = search.trim().toLowerCase();
        const match = (l: { title?: string | null; player?: string; ebayListingId?: string | null; buyerName?: string | null }) =>
          (l.title           ?? "").toLowerCase().includes(q)
          || (l.player         ?? "").toLowerCase().includes(q)
          || (l.ebayListingId  ?? "").toLowerCase().includes(q)
          || (l.buyerName      ?? "").toLowerCase().includes(q);
        const matchDirect = (l: DirectListing) =>
          (l.title       ?? "").toLowerCase().includes(q)
          || (l.ebayItemId ?? "").toLowerCase().includes(q);
        const hits = [
          ...listings.filter(match).map(l => ({ ...l, kind: "consignment" as const })),
          ...internal.filter(match).map(l => ({ ...l, kind: "internal" as const, scheduledTime: l.scheduledTime })),
          ...(directListings ?? []).filter(matchDirect).map(l => ({
            id:            l.ebayItemId,
            title:         l.title,
            ebayListingId: l.ebayItemId,
            url:           l.url,
            startPrice:    l.startPrice,
            soldPrice:     null as number | null,
            buyItNowPrice: l.binPrice,
            status:        "active",
            buyerName:     null as string | null,
            listedAt:      l.startTime,
            orderId:       "",
            kind:          "direct" as const,
          })),
        ].sort((a, b) => (b.listedAt ?? "").localeCompare(a.listedAt ?? ""));
        if (hits.length === 0) {
          return (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <p className="text-slate-400 text-sm">No listings match <span className="font-mono text-navy">{search}</span>.</p>
            </div>
          );
        }
        return (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              {FIVE_COL_GROUP}
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Card</th>
                  <th className="text-left px-5 py-3">Price</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Buyer</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {hits.map((l, i) => (
                  <tr key={`search-${l.kind}-${l.id}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-5 py-3">
                      <p className="text-navy font-medium break-words">{l.title || <span className="italic">Draft</span>}</p>
                      {l.ebayListingId && (
                        <p className="text-slate-400 text-xs mt-0.5">
                          eBay #{l.ebayListingId}{" "}
                          <a href={l.url || `https://www.ebay.com/itm/${l.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-navy font-medium text-xs">{l.soldPrice != null ? `Sold $${usd(l.soldPrice)}` : `$${usd(l.startPrice)} start`}</p>
                      {l.buyItNowPrice && !l.soldPrice && <p className="text-slate-400 text-xs">BIN ${usd(l.buyItNowPrice)}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[l.status] ?? "bg-slate-100 text-slate-500"}`}>{l.status}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-navy break-words">{l.buyerName ?? <span className="text-slate-400 italic">—</span>}</td>
                    <td className="px-5 py-3">
                      {l.kind === "internal" ? (
                        <Link href={`/admin/internal-listings/${l.id}`} className="text-brand text-xs hover:underline font-medium">
                          Open
                        </Link>
                      ) : l.kind === "consignment" ? (
                        <Link href={`/admin/consignments/${(l as Listing).orderId}`} className="text-brand text-xs hover:underline font-medium">
                          Open order
                        </Link>
                      ) : l.url ? (
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brand text-xs hover:underline font-medium">
                          View on eBay →
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs italic">eBay direct</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Pending-batch banner — visible across BOTH the consignment and
          internal tabs whenever there are any listings staged for batch
          publish (of either kind). Counts consignment + internal together. */}
      {!search.trim() && (tab === "consignment" || tab === "internal") && (() => {
        const consignmentPending = listings.filter(l => l.status === "pending").length;
        const internalPending    = internal.filter(l => l.status === "pending").length;
        const total = consignmentPending + internalPending;
        if (total === 0) return null;
        const breakdown = consignmentPending > 0 && internalPending > 0
          ? ` (${consignmentPending} consignment, ${internalPending} internal)`
          : "";
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center">{total}</span>
              <p className="text-amber-900 text-sm font-medium">
                {total === 1 ? "1 listing queued for eBay" : `${total} listings queued for eBay`}{breakdown}
              </p>
            </div>
            <button onClick={listAllPending} disabled={batchRunning}
              className="bg-[#e43137] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#c0282d] disabled:opacity-50 transition-colors whitespace-nowrap">
              {batchRunning ? "Publishing…" : `List All Pending (${total})`}
            </button>
          </div>
        );
      })()}

      {/* Consignment tab — drafts and pending live in the Drafts tab now. */}
      {!search.trim() && tab === "consignment" && (() => {
        const consignmentLive = listings.filter(l => l.status !== "draft" && l.status !== "pending");
        return consignmentLive.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <p className="text-slate-400 text-sm">No live consignment listings. Drafts are in the Drafts tab; once published they appear here.</p>
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
                {consignmentLive.map((l, i) => (
                  <tr key={l.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-5 py-3">
                      <p className="text-navy font-medium break-words">{l.title || <span className="italic">Draft</span>}</p>
                      {l.ebayListingId && (
                        <p className="text-slate-400 text-xs mt-0.5">
                          eBay #{l.ebayListingId}{" "}
                          <a href={l.url || `https://www.ebay.com/itm/${l.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
                        </p>
                      )}
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
                        {(l.status === "draft" || l.status === "pending") && (
                          <button onClick={() => listOnEbay(l)} disabled={listing === l.id || batchRunning}
                            className="flex items-center gap-1.5 bg-[#e43137] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#c0282d] disabled:opacity-50 transition-colors whitespace-nowrap">
                            {listing === l.id ? "Listing…" : "List Now"}
                          </button>
                        )}
                        {l.status === "draft" && (
                          <button onClick={() => addToBatch("consignment", l)} disabled={batchToggling === l.id || batchRunning}
                            className="flex items-center gap-1.5 bg-white border border-amber-300 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                            {batchToggling === l.id ? "Adding…" : "Add to batch"}
                          </button>
                        )}
                        {l.status === "pending" && (
                          <button onClick={() => removeFromBatch("consignment", l)} disabled={batchToggling === l.id || batchRunning}
                            className="text-slate-500 hover:text-slate-700 text-xs transition-colors disabled:opacity-50">
                            {batchToggling === l.id ? "Removing…" : "Remove from batch"}
                          </button>
                        )}
                        {listError[l.id] && <p className="text-red-500 text-xs max-w-[200px] leading-tight">{listError[l.id].slice(0, 150)}</p>}
                        {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brand text-xs hover:underline font-medium">View on eBay →</a>}
                        <Link href={`/admin/consignments/${l.orderId}`} className="text-slate-400 text-xs hover:text-navy transition-colors">
                          {(l.status === "draft" || l.status === "pending") ? "Edit listing" : "View order"}
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
        );
      })()}

      {/* Drafts tab — every draft + pending listing from BOTH consignment
          and internal in one place. Multi-select with checkboxes; "List
          Selected" fires /api/admin/ebay/list-batch directly so the picked
          listings publish in parallel (up to 5 in-flight) without an
          intermediate pending stage. The single-row "Add to batch" flow
          (per-row button + banner + "List All Pending") still works for
          curated multi-session staging. */}
      {!search.trim() && tab === "drafts" && (() => {
        const draftsConsign = listings.filter(l => l.status === "draft" || l.status === "pending")
                                      .map(l => ({ ...l, kind: "consignment" as const }));
        const draftsInternal = internal.filter(l => l.status === "draft" || l.status === "pending")
                                       .map(l => ({ ...l, kind: "internal" as const }));
        const rows = [...draftsConsign, ...draftsInternal];

        if (rows.length === 0) {
          return (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <p className="text-navy font-semibold mb-2">No drafts</p>
              <p className="text-slate-400 text-sm mb-4">Generate a listing on a consignment item, or create an internal listing to start one.</p>
              <Link href="/admin/internal-listings/new"
                className="inline-block bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 transition-colors">
                + New internal listing
              </Link>
            </div>
          );
        }

        const allKeys     = rows.map(l => `${l.kind}:${l.id}`);
        const allSelected = allKeys.length > 0 && allKeys.every(k => selectedDrafts.has(k));
        const selectedCount = allKeys.filter(k => selectedDrafts.has(k)).length;

        const toggleAll = () => {
          if (allSelected) setSelectedDrafts(new Set());
          else             setSelectedDrafts(new Set(allKeys));
        };

        return (
          <>
            {selectedCount > 0 && (
              <div className="bg-navy text-white rounded-2xl px-5 py-3 mb-4 flex items-center justify-between gap-4 sticky top-2 z-10 shadow-lg">
                <p className="text-sm font-medium">
                  {selectedCount} selected
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedDrafts(new Set())} disabled={batchRunning}
                    className="text-xs text-slate-300 hover:text-white transition-colors disabled:opacity-50">
                    Clear
                  </button>
                  <button onClick={listSelected} disabled={batchRunning}
                    className="bg-[#e43137] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#c0282d] disabled:opacity-50 transition-colors whitespace-nowrap">
                    {batchRunning ? "Publishing…" : `List Selected (${selectedCount})`}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 w-8">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="cursor-pointer" aria-label="Select all drafts" />
                    </th>
                    <th className="text-left px-5 py-3">Card</th>
                    <th className="text-left px-5 py-3">Source</th>
                    <th className="text-left px-5 py-3">Price</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l, i) => {
                    const key = `${l.kind}:${l.id}`;
                    const checked = selectedDrafts.has(key);
                    return (
                      <tr key={key} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-5 py-3">
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleSelected(l.kind, l.id)}
                            disabled={batchRunning}
                            className="cursor-pointer" />
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-navy font-medium break-words">{l.title || <span className="italic">Untitled draft</span>}</p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {l.player}{l.year ? ` · ${l.year}` : ""}{l.set ? ` · ${l.set}` : ""}
                            {l.graded && l.gradeCompany && l.grade ? ` · ${l.gradeCompany} ${l.grade}` : ""}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${l.kind === "internal" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>
                            {l.kind === "internal" ? "Internal" : "Consignment"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600 text-sm">
                          ${usd(Number(l.startPrice))}
                          {l.buyItNowPrice ? <p className="text-slate-400 text-xs">BIN ${usd(Number(l.buyItNowPrice))}</p> : null}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[l.status] ?? "bg-slate-100 text-slate-500"}`}>{l.status}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-1.5 items-start">
                            <Link
                              href={l.kind === "internal"
                                ? `/admin/internal-listings/${l.id}`
                                : `/admin/consignments/${(l as Listing).orderId}`}
                              className="text-brand text-xs hover:underline font-medium">
                              Edit listing
                            </Link>
                            {l.status === "pending" && (
                              <button onClick={() => removeFromBatch(l.kind, l)} disabled={batchToggling === l.id || batchRunning}
                                className="text-slate-500 hover:text-slate-700 text-xs transition-colors disabled:opacity-50">
                                {batchToggling === l.id ? "Removing…" : "Remove from batch"}
                              </button>
                            )}
                            {listError[l.id] && <p className="text-red-500 text-xs max-w-[200px] leading-tight">{listError[l.id].slice(0, 150)}</p>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {/* Scheduled tab — listings whose status is "scheduled" (queued for
          eBay to flip live at scheduledTime). They auto-promote to "active"
          when scheduledTime passes — see page.tsx. */}
      {!search.trim() && tab === "scheduled" && (() => {
        const scheduledConsign  = listings.filter(l => l.status === "scheduled");
        const scheduledInternal = internal.filter(l => l.status === "scheduled");
        const total = scheduledConsign.length + scheduledInternal.length;
        if (total === 0) {
          return (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <p className="text-navy font-semibold mb-2">Nothing scheduled</p>
              <p className="text-slate-400 text-sm">Listings with a future start time live here until they go active on eBay.</p>
            </div>
          );
        }
        return (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              {FIVE_COL_GROUP}
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Card</th>
                  <th className="text-left px-5 py-3">Price</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Starts</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {[...scheduledConsign.map(l => ({ ...l, kind: "consignment" as const, scheduledTime: null as string | null })),
                  ...scheduledInternal.map(l => ({ ...l, kind: "internal"   as const }))]
                  .sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""))
                  .map((l, i) => (
                    <tr key={`sched-${l.kind}-${l.id}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-5 py-3">
                        <p className="text-navy font-medium break-words">{l.title || <span className="italic">Draft</span>}</p>
                        {l.ebayListingId && (
                          <p className="text-slate-400 text-xs mt-0.5">
                            eBay #{l.ebayListingId}{" "}
                            <a href={l.url || `https://www.ebay.com/itm/${l.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-navy font-medium text-xs">${usd(l.startPrice)} start</p>
                        {l.buyItNowPrice && <p className="text-slate-400 text-xs">BIN ${usd(l.buyItNowPrice)}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE.scheduled}`}>scheduled</span>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {l.scheduledTime ? new Date(l.scheduledTime).toLocaleString() : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {l.kind === "internal" ? (
                          <Link href={`/admin/internal-listings/${l.id}`} className="text-brand text-xs hover:underline font-medium">
                            Edit listing
                          </Link>
                        ) : (
                          <Link href={`/admin/consignments/${(l as Listing).orderId}`} className="text-brand text-xs hover:underline font-medium">
                            View order
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Waiting for payment tab — sold but not yet paid (waiting for buyer to pay) */}
      {!search.trim() && tab === "waiting" && (() => {
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
                        <p className="text-navy font-medium break-words">{l.title || <span className="italic">Draft</span>}</p>
                        {l.ebayListingId && (
                          <p className="text-slate-400 text-xs mt-0.5">
                            eBay #{l.ebayListingId}{" "}
                            <a href={l.url || `https://www.ebay.com/itm/${l.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {(l.buyerName || l.buyerUsername) ? (
                          <button onClick={() => openMessage(l.ebayListingId, l.buyerUsername, l.title ?? l.player)}
                            disabled={!l.ebayListingId || !l.buyerUsername}
                            title={l.buyerUsername ? `Message ${l.buyerUsername} on eBay` : "Buyer username not yet synced"}
                            className="text-brand hover:underline disabled:text-navy disabled:no-underline disabled:cursor-default">
                            {l.buyerName || l.buyerUsername}
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">not yet synced</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-navy font-medium">{l.soldPrice != null ? `$${usd(l.soldPrice)}` : <span className="text-slate-400 italic">price syncing…</span>}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{l.soldAt ? new Date(l.soldAt).toLocaleDateString() : l.listedAt ? new Date(l.listedAt).toLocaleDateString() : "—"}</td>
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
      {!search.trim() && tab === "paid" && (() => {
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
                {(() => {
                  // Group paid items by buyer so multi-item orders ship as one
                  // label. Items without a buyer username get their own group
                  // (keyed on their row id) so they still render individually.
                  const all = [...paidConsign.map(l => ({ ...l, kind: "consignment" as const })),
                               ...paidInternal.map(l => ({ ...l, kind: "internal"   as const }))];
                  const groups = new Map<string, typeof all>();
                  for (const item of all) {
                    const key = item.buyerUsername ?? `__no_buyer_${item.id}`;
                    const existing = groups.get(key) ?? [];
                    existing.push(item);
                    groups.set(key, existing);
                  }
                  const ordered = [...groups.values()].sort((a, b) => {
                    const latestA = a.reduce((m, x) => (x.paidAt ?? "") > m ? (x.paidAt ?? "") : m, "");
                    const latestB = b.reduce((m, x) => (x.paidAt ?? "") > m ? (x.paidAt ?? "") : m, "");
                    return latestB.localeCompare(latestA);
                  });
                  return ordered.map((items, i) => {
                    const sample      = items[0];
                    const totalPrice  = items.reduce((s, x) => s + (x.soldPrice ?? 0), 0);
                    const latestPaid  = items.reduce<string | null>((latest, x) =>
                      x.paidAt && (!latest || x.paidAt > latest) ? x.paidAt : latest, null);
                    const groupKey    = sample.buyerUsername ?? sample.id;
                    return (
                      <tr key={`paid-group-${groupKey}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-5 py-3 align-top">
                          {items.map((item, j) => (
                            <div key={item.id} className={j > 0 ? "mt-3 pt-3 border-t border-slate-100" : ""}>
                              <p className="text-navy font-medium break-words">{item.title || <span className="italic">Draft</span>}</p>
                              {item.ebayListingId && (
                                <p className="text-slate-400 text-xs mt-0.5">
                                  eBay #{item.ebayListingId}{" "}
                                  <a href={item.url || `https://www.ebay.com/itm/${item.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
                                </p>
                              )}
                            </div>
                          ))}
                          {items.length > 1 && (
                            <p className="text-amber-700 text-xs mt-2 font-semibold">📦 {items.length} items — ship together</p>
                          )}
                        </td>
                        <td className="px-5 py-3 align-top text-xs">
                          {sample.buyerName ? (
                            <button onClick={() => openMessage(sample.ebayListingId, sample.buyerUsername, sample.title ?? sample.player)}
                              disabled={!sample.ebayListingId || !sample.buyerUsername}
                              title={sample.buyerUsername ? `Message ${sample.buyerUsername} on eBay` : "Buyer username not yet synced"}
                              className="text-brand hover:underline disabled:text-navy disabled:no-underline disabled:cursor-default">
                              {sample.buyerName}
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 align-top">
                          {items.length === 1 ? (
                            sample.soldPrice != null && <p className="text-navy font-medium text-xs">${usd(sample.soldPrice)}</p>
                          ) : (
                            <>
                              <p className="text-navy font-medium text-xs">${usd(totalPrice)} total</p>
                              {items.map(item => (
                                <p key={item.id} className="text-slate-400 text-xs">${usd(item.soldPrice ?? 0)}</p>
                              ))}
                            </>
                          )}
                        </td>
                        <td className="px-5 py-3 align-top text-xs">
                          {latestPaid && <p className="text-green-700 font-semibold">Paid {new Date(latestPaid).toLocaleDateString()}</p>}
                        </td>
                        <td className="px-5 py-3 align-top">
                          <Link href="/admin/shipping" className="text-brand text-xs hover:underline font-medium whitespace-nowrap">
                            Create label →
                          </Link>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Shipped tab — listings whose status === "shipped". Mirrors the
          shipping admin page's "Shipped" filter so all flavours of listing
          (consignment + internal) appear together with tracking info. */}
      {!search.trim() && tab === "shipped" && (() => {
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
                  <th className="text-left px-5 py-3 whitespace-nowrap">Sold</th>
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
                        <p className="text-navy font-medium break-words">{l.title || <span className="italic">Draft</span>}</p>
                        {l.ebayListingId && (
                          <p className="text-slate-400 text-xs mt-0.5">
                            eBay #{l.ebayListingId}{" "}
                            <a href={l.url || `https://www.ebay.com/itm/${l.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
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
                      <td className="px-5 py-3 align-top text-xs whitespace-nowrap text-slate-600">
                        {l.soldAt ? new Date(l.soldAt).toLocaleDateString() : <span className="text-slate-400">—</span>}
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

      {/* Ended tab — listings that ended without selling. Most often
          auctions that expired with no winning bid; BIN listings that
          hit their end time; or items the seller manually ended.
          Auto-demoted into "ended" by page.tsx when they fall off eBay's
          ActiveList AND aren't in SoldList. */}
      {!search.trim() && tab === "ended" && (() => {
        const endedConsign  = listings.filter(l => l.status === "ended");
        const endedInternal = internal.filter(l => l.status === "ended");
        const total = endedConsign.length + endedInternal.length;
        if (total === 0) {
          return (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <p className="text-navy font-semibold mb-2">Nothing ended without selling</p>
              <p className="text-slate-400 text-sm">Auctions that expired with no winner and BIN listings that hit their end time land here.</p>
            </div>
          );
        }
        return (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              {FIVE_COL_GROUP}
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
                {[...endedConsign.map(l => ({ ...l, kind: "consignment" as const })),
                  ...endedInternal.map(l => ({ ...l, kind: "internal"   as const }))]
                  .sort((a, b) => (b.listedAt ?? "").localeCompare(a.listedAt ?? ""))
                  .map((l, i) => (
                    <tr key={`ended-${l.kind}-${l.id}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-5 py-3">
                        <p className="text-navy font-medium break-words">{l.title || <span className="italic">Draft</span>}</p>
                        {l.ebayListingId && (
                          <p className="text-slate-400 text-xs mt-0.5">
                            eBay #{l.ebayListingId}{" "}
                            <a href={l.url || `https://www.ebay.com/itm/${l.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-navy font-medium text-xs">${usd(l.startPrice)} start</p>
                        {l.buyItNowPrice && <p className="text-slate-400 text-xs">BIN ${usd(l.buyItNowPrice)}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE.ended}`}>ended</span>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {l.listedAt ? new Date(l.listedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {l.kind === "internal" ? (
                          <Link href={`/admin/internal-listings/${l.id}`} className="text-brand text-xs hover:underline font-medium">
                            Edit listing
                          </Link>
                        ) : (
                          <Link href={`/admin/consignments/${(l as Listing).orderId}`} className="text-brand text-xs hover:underline font-medium">
                            View order
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Payout tab — per-item net profit for shipped sales */}
      {!search.trim() && tab === "payout" && (() => {
        const all = [
          ...listings .filter(l => l.status === "shipped" && l.soldPrice != null).map(l => ({ ...l, kind: "consignment" as const })),
          ...internal.filter(l => l.status === "shipped" && l.soldPrice != null).map(l => ({ ...l, kind: "internal"   as const })),
        ].sort((a, b) => (b.shippedAt ?? "").localeCompare(a.shippedAt ?? ""));

        // Totals across all rows
        const totalSale     = all.reduce((s, l) => s + (l.soldPrice          ?? 0), 0);
        const totalPayout   = all.reduce((s, l) => s + (l.ebayPayoutAmount   ?? 0), 0);
        const totalPostage  = all.reduce((s, l) => s + (l.shippingPostageCost ?? 0), 0);
        const totalSupplies = all.reduce((s, l) => s + (l.shippingSupplyCost  ?? 0), 0);
        const totalCommission = all.reduce((s, l) => {
          if (l.kind !== "consignment") return s;
          const rate = (l as Listing).graded ? commissionGraded : commissionRaw;
          return s + ((l.soldPrice ?? 0) * rate / 100);
        }, 0);
        // Net Earnings = (internal: payout - postage - supplies) + (consignment: commission)
        const netEarnings = all.reduce((s, l) => {
          if (l.kind === "internal") {
            return s + ((l.ebayPayoutAmount ?? 0) - (l.shippingPostageCost ?? 0) - (l.shippingSupplyCost ?? 0));
          } else {
            const rate = (l as Listing).graded ? commissionGraded : commissionRaw;
            return s + ((l.soldPrice ?? 0) * rate / 100);
          }
        }, 0);

        if (all.length === 0) {
          return (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <p className="text-navy font-semibold mb-2">Nothing to payout yet</p>
              <p className="text-slate-400 text-sm">Items appear here once they ship and eBay pays out for them.</p>
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-4">
            {/* Totals summary */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div><p className="text-slate-400 text-xs uppercase tracking-wide">Sales</p>           <p className="text-navy font-semibold mt-0.5">${usd(totalSale)}</p></div>
              <div><p className="text-slate-400 text-xs uppercase tracking-wide">eBay payouts</p>     <p className="text-navy font-semibold mt-0.5">${usd(totalPayout)}</p></div>
              <div><p className="text-slate-400 text-xs uppercase tracking-wide">Postage</p>          <p className="text-navy font-semibold mt-0.5">${usd(totalPostage)}</p></div>
              <div><p className="text-slate-400 text-xs uppercase tracking-wide">Supplies</p>         <p className="text-navy font-semibold mt-0.5">${usd(totalSupplies)}</p></div>
              <div><p className="text-slate-400 text-xs uppercase tracking-wide">Net Earnings</p>      <p className="text-green-700 font-bold text-base mt-0.5">${usd(netEarnings)}</p></div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: "1000px" }}>
                <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left  px-4 py-3"                                style={{ whiteSpace: "normal"  }}>Card</th>
                    <th className="text-left  px-3 py-3 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>Sold</th>
                    <th className="text-right px-3 py-3 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>Sale</th>
                    <th className="text-right px-3 py-3 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>eBay payout</th>
                    <th className="text-right px-3 py-3 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>Postage</th>
                    <th className="text-right px-3 py-3 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>Supplies</th>
                    <th className="text-right px-3 py-3 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>Commission</th>
                    <th className="text-right px-3 py-3 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>Net Earnings</th>
                    <th className="text-right px-3 py-3 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>Consignor</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((l, i) => {
                    const sale     = l.soldPrice          ?? 0;
                    const payout   = l.ebayPayoutAmount   ?? null;     // null = not yet synced
                    const postage  = l.shippingPostageCost ?? 0;
                    const supplies = l.shippingSupplyCost  ?? 0;
                    const isConsign = l.kind === "consignment";
                    const rate = isConsign ? ((l as Listing).graded ? commissionGraded : commissionRaw) : 0;
                    const commission = isConsign ? sale * rate / 100 : 0;
                    const net = isConsign
                      ? commission
                      : (payout ?? 0) - postage - supplies;
                    const consignor = isConsign && payout != null
                      ? payout - postage - supplies - commission
                      : null;
                    return (
                      <tr key={`${l.kind}-${l.id}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-4 py-3 align-top">
                          <p className="text-navy font-medium break-words">{l.title}</p>
                          <p className="text-slate-400 text-xs mt-0.5">
                            {isConsign ? "Consignment" : "Internal"}{isConsign && (l as Listing).graded ? " · Graded" : isConsign ? " · Raw" : ""}
                            {l.ebayListingId ? ` · eBay #${l.ebayListingId}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-slate-600 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>
                          {l.soldAt ? new Date(l.soldAt).toLocaleDateString() : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-3 align-top text-right text-navy whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>${usd(sale)}</td>
                        <td className="px-3 py-3 align-top text-right text-navy whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>
                          {payout != null ? `$${usd(payout)}` : <span className="text-slate-400 italic text-xs">syncing…</span>}
                        </td>
                        <td className="px-3 py-3 align-top text-right text-slate-600 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>${usd(postage)}</td>
                        <td className="px-3 py-3 align-top text-right text-slate-600 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>${usd(supplies)}</td>
                        <td className="px-3 py-3 align-top text-right text-slate-600 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>
                          {isConsign ? `$${usd(commission)} (${rate}%)` : "—"}
                        </td>
                        <td className="px-3 py-3 align-top text-right text-green-700 font-semibold whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>${usd(net)}</td>
                        <td className="px-3 py-3 align-top text-right text-navy whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>
                          {consignor != null ? `$${usd(consignor)}` : isConsign ? <span className="text-slate-400 italic text-xs">syncing…</span> : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Internal tab — site-created listings */}
      {!search.trim() && tab === "internal" && (() => {
        // Drafts and pending live in the Drafts tab now. The Internal tab
        // shows only what's live or about to be: active.
        const internalActive = internal.filter(l => l.status === "active");
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
              <table className="w-full text-sm table-fixed">
                {SIX_COL_GROUP}
                <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3">Card</th>
                    <th className="text-left px-5 py-3">Price</th>
                    <th className="text-left px-3 py-3">Watchers</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Listed</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {internalActive.map((l, i) => (
                    <tr key={l.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-5 py-3">
                        <p className="text-navy font-medium break-words">{l.title || <span className="italic">Draft</span>}</p>
                        {l.ebayListingId && (
                          <p className="text-slate-400 text-xs mt-0.5">
                            eBay #{l.ebayListingId}{" "}
                            <a href={l.url || `https://www.ebay.com/itm/${l.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
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
                        {l.questionCount > 0 && (
                          <p className="text-amber-700 text-xs mt-0.5" title="Buyer questions in last 30 days">💬 {l.questionCount} question{l.questionCount === 1 ? "" : "s"}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {l.status === "active" && (l.watchCount ?? 0) > 0 ? (
                          <p className="text-navy text-sm font-medium" title="Watchers on eBay">
                            <span className="mr-1">👁</span>{l.watchCount}
                          </p>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
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
                            {l.status === "draft" || l.status === "pending" ? "Edit listing" : "View / Edit listing"}
                          </Link>
                          {l.status === "draft" && (
                            <button onClick={() => addToBatch("internal", l)} disabled={batchToggling === l.id || batchRunning}
                              className="flex items-center gap-1.5 bg-white border border-amber-300 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                              {batchToggling === l.id ? "Adding…" : "Add to batch"}
                            </button>
                          )}
                          {l.status === "pending" && (
                            <button onClick={() => removeFromBatch("internal", l)} disabled={batchToggling === l.id || batchRunning}
                              className="text-slate-500 hover:text-slate-700 text-xs transition-colors disabled:opacity-50">
                              {batchToggling === l.id ? "Removing…" : "Remove from batch"}
                            </button>
                          )}
                          {listError[l.id] && <p className="text-red-500 text-xs max-w-[200px] leading-tight">{listError[l.id].slice(0, 150)}</p>}
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
                <table className="w-full text-sm table-fixed">
                  {SIX_COL_GROUP}
                  <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3">Card</th>
                      <th className="text-left px-5 py-3">Price</th>
                      <th className="text-left px-3 py-3">Watchers</th>
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
                                <a href={l.url || `https://www.ebay.com/itm/${l.ebayListingId}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View →</a>
                              </p>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-navy font-medium text-xs">${usd(l.currentPrice)}{l.bidCount > 0 && <span className="text-slate-500 font-normal"> ({l.bidCount} bid{l.bidCount === 1 ? "" : "s"})</span>}</p>
                              {l.binPrice !== null && <p className="text-slate-400 text-xs">BIN ${usd(l.binPrice)}</p>}
                              {l.quantitySold > 0 && <p className="text-green-600 text-xs">{l.quantitySold} sold</p>}
                              {l.questionCount > 0 && (
                                <p className="text-amber-700 text-xs mt-0.5" title="Buyer questions in last 30 days">💬 {l.questionCount} question{l.questionCount === 1 ? "" : "s"}</p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {l.watchCount > 0 ? (
                                <p className="text-navy text-sm font-medium" title="Watchers on eBay">
                                  <span className="mr-1">👁</span>{l.watchCount}
                                </p>
                              ) : (
                                <span className="text-slate-300 text-sm">—</span>
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
                              <td colSpan={6} className="px-5 py-5">
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

      {/* Batch publish progress modal — shows during the run and after */}
      {batchProgress && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-navy">{batchRunning ? "Publishing to eBay…" : "Batch complete"}</h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  {(() => {
                    const ok   = batchProgress.filter(p => p.state === "success").length;
                    const fail = batchProgress.filter(p => p.state === "failed").length;
                    if (batchRunning) return `${batchProgress.length} listing${batchProgress.length !== 1 ? "s" : ""} in flight (up to 5 in parallel)`;
                    return `${ok} succeeded, ${fail} failed of ${batchProgress.length} total`;
                  })()}
                </p>
              </div>
              <button onClick={() => !batchRunning && setBatchProgress(null)} disabled={batchRunning}
                className="text-slate-400 hover:text-slate-700 text-2xl leading-none disabled:opacity-30">×</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-3">
              {batchProgress.map(p => (
                <div key={p.listingDbId} className="py-2 border-b border-slate-50 last:border-0 flex items-center gap-3">
                  <span className="shrink-0 w-5 text-center">
                    {p.state === "queued"      && <span className="text-slate-300">○</span>}
                    {p.state === "publishing"  && <span className="text-amber-500 animate-pulse">●</span>}
                    {p.state === "success"     && <span className="text-green-600">✓</span>}
                    {p.state === "failed"      && <span className="text-red-500">✗</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{p.title}</p>
                    {p.state === "failed" && p.error && (
                      <p className="text-xs text-red-500 mt-0.5">{p.error.slice(0, 200)}</p>
                    )}
                    {p.state === "success" && p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">View on eBay →</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!batchRunning && (
              <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
                <button onClick={() => setBatchProgress(null)}
                  className="bg-slate-100 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


