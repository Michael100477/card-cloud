// Rate-limits eBay order sync so we don't hammer their API on every page load.
import { syncOrders } from "./ebay-orders";

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
}
