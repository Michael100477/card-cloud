import { getPageLayout } from "@/lib/layout";
import { getEbayListingDefaults } from "@/lib/ebay-listing-defaults";
import { InternalListingEditor } from "./InternalListingEditor";

export default async function NewInternalListingPage() {
  const [ebayLayout, ebayDefaults] = await Promise.all([
    getPageLayout("ebay_listing"),
    getEbayListingDefaults(),
  ]);
  const ebaySection = ebayLayout.map((w: { widgetKey: string }) => w.widgetKey);
  return (
    <div className="p-8 max-w-4xl">
      <InternalListingEditor ebaySection={ebaySection} ebayDefaults={ebayDefaults} />
    </div>
  );
}
