import { db } from "@/lib/db";
import { getLivePrices } from "@/lib/ebay-live-prices";
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
