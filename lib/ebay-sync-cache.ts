// Rate-limits eBay order + SoldList sync so we don't hammer their API on every page load.
import { syncOrders, syncSoldListings } from "./ebay-orders";

let lastSyncAt = 0;
const SYNC_TTL_MS = 60_000; // sync at most once per minute

export async function syncOrdersThrottled(): Promise<void> {
  if (Date.now() - lastSyncAt < SYNC_TTL_MS) return;
  lastSyncAt = Date.now();
  try {
    const r = await syncOrders();
    console.log(`[order-sync] fetched ${r.ordersFetched} orders, updated ${r.rowsUpdated} rows`);
  } catch (e) {
    console.error("[order-sync] failed:", e);
  }
  // Pick up listings that ended on eBay but haven't generated an order yet —
  // syncOrders can't see them (no order = no Fulfillment-API entry). Also
  // backfills buyer/soldAt on existing rows whose order hasn't materialized.
  try {
    const s = await syncSoldListings();
    if (s.created > 0 || s.updated > 0 || s.buyersFetched > 0) {
      console.log(`[soldlist-sync] created ${s.created}, updated ${s.updated}, buyers fetched ${s.buyersFetched}`);
    }
  } catch (e) {
    console.error("[soldlist-sync] failed:", e);
  }
}
