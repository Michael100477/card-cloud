import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getPageLayout } from "@/lib/layout";
import { getEbayListingDefaults } from "@/lib/ebay-listing-defaults";
import { InternalListingEditor } from "../new/InternalListingEditor";

interface Props { params: Promise<{ id: string }> }

export default async function EditInternalListingPage({ params }: Props) {
  const { id } = await params;

  const [listing, ebayLayout, ebayDefaults] = await Promise.all([
    db.internalListing.findUnique({ where: { id } }),
    getPageLayout("ebay_listing"),
    getEbayListingDefaults(),
  ]);

  if (!listing) notFound();

  // Bad eBay import — was created before the import fixes (empty player, or
  // description still contains literal HTML entities). Delete and re-import cleanly.
  const badImport = !!listing.ebayListingId && (
    !listing.player?.trim() ||
    listing.description.includes("&lt;") ||
    listing.description.includes("<div>") ||
    listing.description.includes("<br>") ||
    Number(listing.startPrice) === 0 ||
    listing.shippingCostType === "Flat: Specify your own postage costs" ||
    (listing.listingType === "fixed" && !listing.buyItNowPrice)
  );
  if (badImport) {
    await db.internalListing.delete({ where: { id } });
    redirect("/admin/listings?tab=internal&reimport=1");
  }

  const ebaySection = ebayLayout.map((w: { widgetKey: string }) => w.widgetKey);

  // Serialize Decimal fields
  const serialized = {
    ...listing,
    purchasePrice:   listing.purchasePrice   ? Number(listing.purchasePrice)   : null,
    startPrice:      Number(listing.startPrice),
    buyItNowPrice:   listing.buyItNowPrice   ? Number(listing.buyItNowPrice)   : null,
    reservePrice:    listing.reservePrice    ? Number(listing.reservePrice)    : null,
    minimumOffer:    listing.minimumOffer    ? Number(listing.minimumOffer)    : null,
    autoAcceptOffer: listing.autoAcceptOffer ? Number(listing.autoAcceptOffer) : null,
    flatRateShipping:listing.flatRateShipping? Number(listing.flatRateShipping): null,
    weightOz:        Number(listing.weightOz),
    dimLength:       Number(listing.dimLength),
    dimWidth:        Number(listing.dimWidth),
    dimHeight:       Number(listing.dimHeight),
    soldPrice:       listing.soldPrice       ? Number(listing.soldPrice)       : null,
    scheduledTime:   listing.scheduledTime?.toISOString()  ?? null,
    listedAt:        listing.listedAt?.toISOString()       ?? null,
    soldAt:          listing.soldAt?.toISOString()         ?? null,
    createdAt:       listing.createdAt.toISOString(),
    updatedAt:       listing.updatedAt.toISOString(),
  };

  return (
    <div className="p-8 max-w-4xl">
      <InternalListingEditor
        key={listing.id}
        ebaySection={ebaySection}
        ebayDefaults={ebayDefaults}
        existing={serialized}
      />
    </div>
  );
}
