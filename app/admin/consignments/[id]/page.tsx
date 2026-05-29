import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getPageLayout } from "@/lib/layout";
import { getEbayListingDefaults } from "@/lib/ebay-listing-defaults";
import { getLivePrices } from "@/lib/ebay-live-prices";
import { ConsignmentOrderAdmin } from "./ConsignmentOrderAdmin";

interface Props { params: Promise<{ id: string }> }

export default async function AdminConsignmentDetailPage({ params }: Props) {
  const { id } = await params;

  const [order, ebayLayout, ebayDefaults, livePrices] = await Promise.all([
    db.consignmentOrder.findUnique({
    where:   { id },
      include: {
        user:  { select: { id: true, email: true, displayName: true, username: true } },
        items: { include: { listing: true }, orderBy: { id: "asc" } },
      },
    }),
    getPageLayout("ebay_listing"),
    getEbayListingDefaults(),
    getLivePrices(),
  ]);

  if (!order) notFound();

  const ebaySection = ebayLayout.map(w => w.widgetKey);

  const serialized = {
    ...order,
    submittedAt: order.submittedAt.toISOString(),
    updatedAt:   order.updatedAt.toISOString(),
    receivedAt:  order.receivedAt?.toISOString() ?? null,
    items: order.items.map(item => ({
      ...item,
      // Convert all Decimal fields to numbers
      desiredPrice:   item.desiredPrice   ? Number(item.desiredPrice)   : null,
      askingPrice:    item.askingPrice    ? Number(item.askingPrice)    : null,
      estimatedValue: item.estimatedValue ? Number(item.estimatedValue) : null,
      minimumOffer:   item.minimumOffer   ? Number(item.minimumOffer)   : null,
      freeShipping:   item.freeShipping,
      listing: item.listing ? {
        ...item.listing,
        // Scalar Decimal → number
        startPrice:      Number(item.listing.startPrice),
        buyItNowPrice:   item.listing.buyItNowPrice   ? Number(item.listing.buyItNowPrice)   : null,
        soldPrice:       item.listing.soldPrice       ? Number(item.listing.soldPrice)       : null,
        minimumOffer:    item.listing.minimumOffer    ? Number(item.listing.minimumOffer)    : null,
        autoAcceptOffer: item.listing.autoAcceptOffer ? Number(item.listing.autoAcceptOffer) : null,
        reservePrice:    item.listing.reservePrice    ? Number(item.listing.reservePrice)    : null,
        flatRateShipping:item.listing.flatRateShipping? Number(item.listing.flatRateShipping): null,
        weightOz:        item.listing.weightOz        ? Number(item.listing.weightOz)        : null,
        dimLength:       item.listing.dimLength       ? Number(item.listing.dimLength)       : null,
        dimWidth:        item.listing.dimWidth        ? Number(item.listing.dimWidth)        : null,
        dimHeight:       item.listing.dimHeight       ? Number(item.listing.dimHeight)       : null,
        // Dates → ISO strings
        scheduledTime:   item.listing.scheduledTime?.toISOString() ?? null,
        createdAt:       item.listing.createdAt.toISOString(),
        updatedAt:       item.listing.updatedAt.toISOString(),
        listedAt:        item.listing.listedAt?.toISOString() ?? null,
        soldAt:          item.listing.soldAt?.toISOString()   ?? null,
        // Live data from eBay (same 60s cache as the admin/listings page)
        currentBid:  item.listing.ebayListingId ? (livePrices.get(item.listing.ebayListingId)?.currentPrice ?? null) : null,
        bidCount:    item.listing.ebayListingId ? (livePrices.get(item.listing.ebayListingId)?.bidCount     ?? null) : null,
        watchCount:  item.listing.ebayListingId ? (livePrices.get(item.listing.ebayListingId)?.watchCount   ?? null) : null,
        endTime:     item.listing.ebayListingId ? (livePrices.get(item.listing.ebayListingId)?.endTime      ?? null) : null,
      } : null,
    })),
  };

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/admin/consignments" className="text-slate-400 text-sm hover:text-navy mb-4 inline-block">← All consignments</Link>
      <ConsignmentOrderAdmin order={serialized} ebaySection={ebaySection} ebayDefaults={ebayDefaults} />
    </div>
  );
}
