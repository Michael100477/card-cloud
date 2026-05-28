import { getEbayListingDefaults } from "@/lib/ebay-listing-defaults";
import { EbayDefaultsClient } from "./EbayDefaultsClient";

export default async function EbayDefaultsPage() {
  const defaults = await getEbayListingDefaults();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">eBay Listing Defaults</h1>
      <p className="text-slate-400 text-sm mb-8">
        These values pre-fill the listing form for every new consignment listing.
        You can override any field on a per-listing basis.
      </p>
      <EbayDefaultsClient defaults={defaults} />
    </div>
  );
}

