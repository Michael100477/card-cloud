import { db } from "@/lib/db";
import { getLivePrices, getSoldItemIds } from "@/lib/ebay-live-prices";
import { getQuestionCounts } from "@/lib/ebay-question-counts";
import { syncOrdersThrottled } from "@/lib/ebay-sync-cache";
import { ListingsClient } from "./ListingsClient";

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; reimport?: string }> }) {
  const sp = await searchParams;

  // Auto-promote: any listing scheduled for the past should now be "active" on eBay.
  // eBay flips its end internally — we mirror that on every page load so the badge in the
  // table reflects reality without a cron job.
  const now = new Date();
  await Promise.all([
    db.internalListing.updateMany({
      where: { status: "scheduled", scheduledTime: { lte: now }, ebayListingId: { not: null } },
      data:  { status: "active" },
    }),
    db.ebayListing.updateMany({
      where: { status: "scheduled", scheduledTime: { lte: now }, ebayListingId: { not: null } },
      data:  { status: "active" },
    }),
    // Pull sold/paid/shipped status from eBay's Fulfillment API (rate-limited to 1/min)
    syncOrdersThrottled(),
  ]);
  const [listings, internalListings, livePrices, questionCounts] = await Promise.all([
    db.ebayListing.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        item: {
          select: {
            id: true, player: true, year: true, set: true, grade: true, gradeCompany: true,
            order: { select: { id: true, user: { select: { displayName: true, username: true, email: true } } } },
          },
        },
      },
    }),
    db.internalListing.findMany({ orderBy: { createdAt: "desc" } }),
    getLivePrices(),
    getQuestionCounts(),
  ]);

  // Reconcile active listings against eBay's live state on every page load.
  // eBay returns three buckets for each listing: ActiveList (still live),
  // SoldList (ended with a winner), and absent (ended without a winner).
  // We promote active→sold for the second bucket and active→ended for the
  // third. Skip if ActiveList is empty (eBay temp outage — don't nuke rows).
  if (livePrices.size > 0) {
    const liveIds = new Set(livePrices.keys());
    const soldIds = await getSoldItemIds();
    type Row = { id: string; status: string; ebayListingId: string | null; soldPrice: unknown };
    const classify = (l: Row): "sold" | "ended" | null => {
      if (l.status !== "active" || !l.ebayListingId || l.soldPrice) return null;
      if (liveIds.has(l.ebayListingId)) return null;
      return soldIds.has(l.ebayListingId) ? "sold" : "ended";
    };
    const sortRow = (rows: Row[], to: "sold" | "ended") =>
      rows.filter(l => classify(l) === to).map(l => l.id);
    const endedInternal = sortRow(internalListings, "ended");
    const soldInternal  = sortRow(internalListings, "sold");
    const endedEbay     = sortRow(listings,         "ended");
    const soldEbay      = sortRow(listings,         "sold");
    if (endedInternal.length || soldInternal.length || endedEbay.length || soldEbay.length) {
      await Promise.all([
        endedInternal.length ? db.internalListing.updateMany({ where: { id: { in: endedInternal } }, data: { status: "ended" } }) : null,
        soldInternal.length  ? db.internalListing.updateMany({ where: { id: { in: soldInternal  } }, data: { status: "sold"  } }) : null,
        endedEbay.length     ? db.ebayListing.updateMany({     where: { id: { in: endedEbay     } }, data: { status: "ended" } }) : null,
        soldEbay.length      ? db.ebayListing.updateMany({     where: { id: { in: soldEbay      } }, data: { status: "sold"  } }) : null,
      ]);
      // Mirror the updates into the in-memory rows so this page render reflects them.
      for (const l of internalListings) {
        if (endedInternal.includes(l.id)) l.status = "ended";
        if (soldInternal.includes(l.id))  l.status = "sold";
      }
      for (const l of listings) {
        if (endedEbay.includes(l.id)) l.status = "ended";
        if (soldEbay.includes(l.id))  l.status = "sold";
      }
    }
  }

  // Hide imports the admin hasn't actually saved yet — they belong in the
  // "Listed Directly on eBay" section until first save.
  const savedInternalListings = internalListings.filter(l =>
    !l.ebayListingId || l.updatedAt.getTime() > l.createdAt.getTime() + 1000
  );

  const active    = listings.filter(l => l.status === "active").length;
  const sold      = listings.filter(l => l.status === "sold").length;
  const totalSold = listings.filter(l => l.soldPrice).reduce((s, l) => s + Number(l.soldPrice), 0);

  const serialized = listings.map(l => ({
    id:           l.id,
    title:        l.title,
    status:       l.status,
    url:          l.url,
    startPrice:   Number(l.startPrice),
    buyItNowPrice: l.buyItNowPrice ? Number(l.buyItNowPrice) : null,
    soldPrice:    l.soldPrice ? Number(l.soldPrice) : null,
    listedAt:     l.listedAt?.toISOString() ?? null,
    orderId:      l.item.order.id,
    itemId:       l.item.id,
    player:       l.item.player,
    year:         l.item.year,
    set:          l.item.set,
    grade:        l.item.grade,
    gradeCompany: l.item.gradeCompany,
    ownerName:    l.item.order.user.displayName ?? l.item.order.user.username ?? l.item.order.user.email,
    currentBid:    l.ebayListingId ? (livePrices.get(l.ebayListingId)?.currentPrice ?? null) : null,
    bidCount:      l.ebayListingId ? (livePrices.get(l.ebayListingId)?.bidCount     ?? null) : null,
    watchCount:    l.ebayListingId ? (livePrices.get(l.ebayListingId)?.watchCount   ?? null) : null,
    endTime:       l.ebayListingId ? (livePrices.get(l.ebayListingId)?.endTime      ?? null) : null,
    questionCount: l.ebayListingId ? (questionCounts.get(l.ebayListingId)             ?? 0)  : 0,
    trackingNumber:   l.trackingNumber,
    shippedAt:        l.shippedAt?.toISOString() ?? null,
    shippingLabelUrl: l.shippingLabelUrl,
    buyerName:        l.buyerName,
    paidAt:           l.paidAt?.toISOString() ?? null,
  }));

  const serializedInternal = savedInternalListings.map(l => ({
    id:            l.id,
    title:         l.title,
    status:        l.status,
    url:           l.url,
    ebayListingId: l.ebayListingId,
    listingType:   l.listingType,
    startPrice:    Number(l.startPrice),
    buyItNowPrice: l.buyItNowPrice ? Number(l.buyItNowPrice) : null,
    soldPrice:     l.soldPrice ? Number(l.soldPrice) : null,
    listedAt:      l.listedAt?.toISOString() ?? null,
    scheduledTime: l.scheduledTime?.toISOString() ?? null,
    player:        l.player,
    year:          l.year,
    set:           l.set,
    grade:         l.grade,
    gradeCompany:  l.gradeCompany,
    currentBid:    l.ebayListingId ? (livePrices.get(l.ebayListingId)?.currentPrice ?? null) : null,
    bidCount:      l.ebayListingId ? (livePrices.get(l.ebayListingId)?.bidCount     ?? null) : null,
    watchCount:    l.ebayListingId ? (livePrices.get(l.ebayListingId)?.watchCount   ?? null) : null,
    endTime:       l.ebayListingId ? (livePrices.get(l.ebayListingId)?.endTime      ?? null) : null,
    questionCount: l.ebayListingId ? (questionCounts.get(l.ebayListingId)             ?? 0)  : 0,
    trackingNumber:   l.trackingNumber,
    shippedAt:        l.shippedAt?.toISOString() ?? null,
    shippingLabelUrl: l.shippingLabelUrl,
    buyerName:        l.buyerName,
    paidAt:           l.paidAt?.toISOString() ?? null,
  }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">eBay Listings</h1>
      <p className="text-slate-400 text-sm mb-6">
        {listings.length} total · {active} active · {sold} sold
        {totalSold > 0 && ` · $${totalSold.toLocaleString()} total sold`}
      </p>
      {sp.reimport === "1" && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          That listing was an incomplete import. It&#39;s been removed — click <strong>Edit listing</strong> below to re-import it with all fields filled in.
        </div>
      )}
      <ListingsClient listings={serialized} internalListings={serializedInternal} />
    </div>
  );
}
