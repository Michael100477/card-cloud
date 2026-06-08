import { db } from "@/lib/db";
import { getLivePrices, getSoldPrices, hasFreshEbaySnapshot } from "@/lib/ebay-live-prices";
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
  // third. Gate on whether we got a fresh successful eBay snapshot, NOT on
  // whether it returned any active items — a user with zero live auctions
  // is a normal state, and would otherwise strand any "active" rows forever.
  if (await hasFreshEbaySnapshot()) {
    const liveIds    = new Set(livePrices.keys());
    const soldPrices = await getSoldPrices();
    type Row = { id: string; status: string; ebayListingId: string | null; soldPrice: unknown };
    const classify = (l: Row): "sold" | "ended" | null => {
      if (l.status !== "active" || !l.ebayListingId || l.soldPrice) return null;
      if (liveIds.has(l.ebayListingId)) return null;
      return soldPrices.has(l.ebayListingId) ? "sold" : "ended";
    };
    const endedInternal = internalListings.filter(l => classify(l) === "ended");
    const soldInternal  = internalListings.filter(l => classify(l) === "sold");
    const endedEbay     = listings.filter(l => classify(l) === "ended");
    const soldEbay      = listings.filter(l => classify(l) === "sold");
    const ops: Promise<unknown>[] = [];
    if (endedInternal.length) ops.push(db.internalListing.updateMany({ where: { id: { in: endedInternal.map(l => l.id) } }, data: { status: "ended" } }));
    if (endedEbay.length)     ops.push(db.ebayListing.updateMany({     where: { id: { in: endedEbay.map(l => l.id)     } }, data: { status: "ended" } }));
    // Each sold listing gets its own update because each carries a different price.
    for (const l of soldInternal) {
      const price = soldPrices.get(l.ebayListingId!);
      ops.push(db.internalListing.update({ where: { id: l.id }, data: { status: "sold", soldPrice: price ?? undefined } }));
    }
    for (const l of soldEbay) {
      const price = soldPrices.get(l.ebayListingId!);
      ops.push(db.ebayListing.update({ where: { id: l.id }, data: { status: "sold", soldPrice: price ?? undefined } }));
    }
    if (ops.length) {
      await Promise.all(ops);
      // Mirror the updates into the in-memory rows so this page render reflects them.
      for (const l of internalListings) {
        if (endedInternal.find(x => x.id === l.id)) l.status = "ended";
        const sold = soldInternal.find(x => x.id === l.id);
        if (sold) { l.status = "sold"; l.soldPrice = soldPrices.get(l.ebayListingId!) as never ?? l.soldPrice; }
      }
      for (const l of listings) {
        if (endedEbay.find(x => x.id === l.id)) l.status = "ended";
        const sold = soldEbay.find(x => x.id === l.id);
        if (sold) { l.status = "sold"; l.soldPrice = soldPrices.get(l.ebayListingId!) as never ?? l.soldPrice; }
      }
    }
  }

  // Hide imports the admin hasn't actually saved yet — they belong in the
  // "Listed Directly on eBay" section until first save. "Saved" means the
  // row has lifecycle data the admin or eBay sync wrote (a status past
  // draft, a buyer, a paid/shipped timestamp, etc.) — using updatedAt vs
  // createdAt was brittle because Prisma can write both equal on insert.
  const savedInternalListings = internalListings.filter(l =>
    !l.ebayListingId
    || l.status !== "draft"
    || l.buyerUsername != null
    || l.paidAt != null
    || l.shippedAt != null
    || l.soldPrice != null
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
    ebayListingId: l.ebayListingId,
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
    buyerUsername:    l.buyerUsername,
    paidAt:           l.paidAt?.toISOString() ?? null,
    soldAt:           l.soldAt?.toISOString() ?? null,
    shippingCarrier:  l.shippingCarrier,
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
    buyerUsername:    l.buyerUsername,
    paidAt:           l.paidAt?.toISOString() ?? null,
    soldAt:           l.soldAt?.toISOString() ?? null,
    shippingCarrier:  l.shippingCarrier,
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
