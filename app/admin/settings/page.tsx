import { db } from "@/lib/db";
import { getEbayConnectionStatus } from "@/lib/ebay-auth";
import { getShippingRates } from "@/lib/shipping";
import { seedLinks, SECTION_ORDER } from "@/lib/links";
import { CMS_SLOTS } from "@/app/admin/content/page";
import { WIDGET_REGISTRY, seedPageLayout } from "@/lib/layout";
import { SettingsTabs } from "./SettingsTabs";

const LAYOUT_PAGES = ["dashboard", "explore", "landing", "ebay_listing"] as const;

export default async function AdminSettingsPage() {
  await Promise.all([
    seedLinks(),
    ...LAYOUT_PAGES.map(p => seedPageLayout(p)),
  ]);

  const [allSettingsRows, ebay, shipping, links, sitePages, layoutRows] = await Promise.all([
    db.siteSetting.findMany(), // fetch all — needed for both rates and content cms
    getEbayConnectionStatus(),
    getShippingRates(),
    db.siteLink.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] }),
    db.sitePage.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] }),
    db.pageLayout.findMany({ orderBy: [{ page: "asc" }, { order: "asc" }] }),
  ]);

  const layoutByPage: Record<string, typeof layoutRows> = {};
  for (const p of LAYOUT_PAGES) layoutByPage[p] = layoutRows.filter(r => r.page === p);

  const map = new Map(allSettingsRows.map(r => [r.key, r.value]));
  const cmsValueMap: Record<string, string> = {};
  for (const r of allSettingsRows) cmsValueMap[r.key] = r.value;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Settings</h1>
      <p className="text-slate-400 text-sm mb-6">
        Platform-wide configuration. Changes apply everywhere instantly.
      </p>
      <SettingsTabs
        withPhotos={map.get("commission_with_photos")        ?? "15"}
        withoutPhotos={map.get("commission_without_photos")  ?? "20"}
        exchangeStandard={map.get("exchange_commission_standard")   ?? "7"}
        exchangePremier={map.get("exchange_commission_premier")     ?? "5"}
        exchangePremierThreshold={map.get("exchange_premier_threshold") ?? "100"}
        ebay={ebay}
        shipping={shipping}
        trackFreeLimit={map.get("track_free_limit")       ?? "100"}
        trackMonthly={map.get("track_monthly_price")      ?? "2.99"}
        trackYearly={map.get("track_yearly_price")        ?? "25"}
        offerFee={map.get("offer_fee")                    ?? "0"}
        tradeCostPerSide={map.get("trade_cost_per_side")  ?? "17"}
        tradeServiceFee={map.get("trade_service_fee")     ?? "10"}
        tradeShippingFee={map.get("trade_shipping_fee")   ?? "7"}
        ebayDefaultListingType={map.get("ebay_ld_listing_type")            ?? "auction"}
        ebayDefaultAuctionDuration={map.get("ebay_ld_auction_duration")    ?? "7"}
        ebayDefaultStartPrice={map.get("ebay_ld_default_start_price")      ?? "0.99"}
        ebayDefaultScheduledTime={map.get("ebay_ld_default_scheduled_time") ?? "22:00"}
        tradeShipName={map.get("trade_ship_name")           ?? "The Card Cloud"}
        tradeShipStreet1={map.get("trade_ship_street1")     ?? ""}
        tradeShipStreet2={map.get("trade_ship_street2")     ?? ""}
        tradeShipCity={map.get("trade_ship_city")           ?? ""}
        tradeShipState={map.get("trade_ship_state")         ?? ""}
        tradeShipPostalCode={map.get("trade_ship_postal")   ?? ""}
        supplyCostEnvelope={map.get("supply_cost_envelope")               ?? "0.20"}
        supplyCostLabel={map.get("supply_cost_label")                     ?? "0.10"}
        supplyCostPackingSlip={map.get("supply_cost_packing_slip")        ?? "0.02"}
        supplyCostTapePerInch={map.get("supply_cost_tape_per_inch")       ?? "0"}
        supplyTapeInchesPerOrder={map.get("supply_tape_inches_per_order") ?? "0"}
        supplyInvEnvelope={map.get("supply_inventory_envelope")                       ?? "0"}
        supplyInvEnvelopeThreshold={map.get("supply_inventory_envelope_threshold")    ?? "10"}
        supplyInvLabel={map.get("supply_inventory_label")                             ?? "0"}
        supplyInvLabelThreshold={map.get("supply_inventory_label_threshold")          ?? "10"}
        supplyInvPackingSlip={map.get("supply_inventory_packing_slip")                ?? "0"}
        supplyInvPackingSlipThreshold={map.get("supply_inventory_packing_slip_threshold") ?? "10"}
        defaultShippingType={map.get("default_shipping_type") ?? "flat"}
        links={links}
        sitePages={sitePages.map(p => ({ id: p.id, path: p.path, label: p.label }))}
        sectionOrder={SECTION_ORDER}
        cmsSections={CMS_SLOTS}
        cmsValueMap={cmsValueMap}
        layoutPages={LAYOUT_PAGES as unknown as string[]}
        layoutByPage={layoutByPage}
        layoutRegistry={WIDGET_REGISTRY}
      />
    </div>
  );
}
