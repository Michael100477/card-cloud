import { NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { syncOrdersThrottled } from "@/lib/ebay-sync-cache";

/** Force a fresh sync against eBay's Fulfillment + SoldList + Finances APIs,
 *  bypassing the 60-second throttle. Used by the Shipping page's "Refresh
 *  from eBay" button when the seller ships through eBay's seller hub
 *  directly — the order changes status on eBay's side, but the throttled
 *  background sync may not have run since. */
export async function POST() {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  await syncOrdersThrottled({ forceFresh: true });
  return NextResponse.json({ ok: true });
}
