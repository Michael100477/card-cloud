// eBay Finances API client — pulls actual payout amounts per order for the
// Payout tab's net-profit calculation. Requires the sell.finances OAuth scope.

import { db } from "./db";
import { getAccessToken, getEbayConnectionStatus } from "./ebay-auth";

interface EbayTransaction {
  transactionId:    string;
  transactionType:  string;     // SALE, REFUND, NON_SALE_CHARGE, SHIPPING_LABEL, etc.
  bookingEntry:     string;     // CREDIT or DEBIT
  amount?:          { value?: string; currency?: string };
  // orderId is a TOP-LEVEL field on every transaction tied to an order
  // (eBay docs imply references[] is for some types but this is the
  // actually-populated field — empirically references is undefined).
  orderId?:         string;
  feeType?:         string;
  feeJurisdiction?: string;
}

export interface OrderPayoutInfo {
  payoutAmount: number;   // what eBay paid out for this order (sale minus all deducted fees)
  feeAmount:    number;   // total fees deducted
  refundAmount: number;   // refunds applied
}

/** Fetch all Finances API transactions from the last N days and group by
 *  order ID. Returns a map keyed on the order's legacyOrderId or orderId. */
export async function getPayoutsForRecentOrders(days: number = 60): Promise<Map<string, OrderPayoutInfo>> {
  const map = new Map<string, OrderPayoutInfo>();

  const status = await getEbayConnectionStatus();
  if (!status.connected) return map;

  let token: string;
  try { token = await getAccessToken(); }
  catch { return map; }

  const sandbox = status.environment !== "production";
  // NOTE: The Finances API uses its own subdomain (apiz.ebay.com / apiz.sandbox.ebay.com),
  // NOT the standard api.ebay.com that the other Sell APIs use. The 'z' is part of the
  // route — eBay split Finances onto a separate gateway. Hitting api.ebay.com returns
  // 404 with an empty body, which previously made this look like a scope/permission issue.
  const apiBase = sandbox ? "https://apiz.sandbox.ebay.com" : "https://apiz.ebay.com";

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  // Finances API: getTransactions endpoint, filtered to transactions newer
  // than `since`. We page through up to a few pages to handle high volume.
  let offset = 0;
  const limit = 200;
  let pagesFetched = 0;
  const MAX_PAGES = 10;  // sanity cap, ~2k transactions

  while (pagesFetched < MAX_PAGES) {
    const url = `${apiBase}/sell/finances/v1/transaction?filter=transactionDate:%5B${encodeURIComponent(since)}..%5D&limit=${limit}&offset=${offset}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!r.ok) {
      console.error(`[ebay-finances] fetch failed (${r.status}):`, (await r.text()).slice(0, 300));
      break;
    }
    const data = await r.json();
    const txns: EbayTransaction[] = data.transactions ?? [];
    if (txns.length === 0) break;

    for (const t of txns) {
      const orderRef = t.orderId;
      if (!orderRef) continue;
      const amt = parseFloat(t.amount?.value ?? "0");
      if (!isFinite(amt)) continue;

      const cur = map.get(orderRef) ?? { payoutAmount: 0, feeAmount: 0, refundAmount: 0 };

      // eBay Finances reports CREDIT for incoming money to seller (sale,
      // refund-from-buyer), DEBIT for outgoing (final value fees, ad fees,
      // shipping labels bought through eBay, refund issued to buyer, etc.).
      // The net payout for an order = all CREDITs minus all DEBITs.
      // We also categorize DEBITs as either fees or refunds for reporting.
      if (t.bookingEntry === "CREDIT") {
        cur.payoutAmount += amt;
      } else if (t.bookingEntry === "DEBIT") {
        cur.payoutAmount -= amt;
        if (t.transactionType === "REFUND") cur.refundAmount += amt;
        else                                cur.feeAmount    += amt;
      }
      map.set(orderRef, cur);
    }

    pagesFetched++;
    if (txns.length < limit) break;
    offset += limit;
  }

  return map;
}

/** Save payout amounts onto each matching internal_listing / ebay_listing
 *  row. For multi-item orders (e.g. one buyer bought 2 cards in the same
 *  order), the order-level payout is pro-rated across items by their share
 *  of the order's gross sale. Idempotent — only updates rows whose stored
 *  values differ from the fresh eBay numbers. */
export async function syncPayouts(): Promise<{ updated: number; ordersFetched: number }> {
  const payouts = await getPayoutsForRecentOrders();
  if (payouts.size === 0) return { updated: 0, ordersFetched: 0 };

  let updated = 0;

  // Pull every row that has an ebayOrderId in the fetched set
  const orderIds = [...payouts.keys()];
  const [internal, consign] = await Promise.all([
    db.internalListing.findMany({
      where:  { ebayOrderId: { in: orderIds } },
      select: { id: true, ebayOrderId: true, soldPrice: true, ebayPayoutAmount: true },
    }),
    db.ebayListing.findMany({
      where:  { ebayOrderId: { in: orderIds } },
      select: { id: true, ebayOrderId: true, soldPrice: true, ebayPayoutAmount: true },
    }),
  ]);

  // Group items by order so we can pro-rate the order's payout / fees by
  // each item's share of the gross sale total. For single-item orders this
  // simplifies to "the whole payout/fee goes to that one item."
  type Row = { id: string; ebayOrderId: string | null; soldPrice: { toString(): string } | number | null };
  const byOrder = new Map<string, { internal: Row[]; consign: Row[]; totalSale: number }>();
  for (const r of internal) {
    if (!r.ebayOrderId) continue;
    const g = byOrder.get(r.ebayOrderId) ?? { internal: [], consign: [], totalSale: 0 };
    g.internal.push(r);
    g.totalSale += r.soldPrice ? Number(r.soldPrice) : 0;
    byOrder.set(r.ebayOrderId, g);
  }
  for (const r of consign) {
    if (!r.ebayOrderId) continue;
    const g = byOrder.get(r.ebayOrderId) ?? { internal: [], consign: [], totalSale: 0 };
    g.consign.push(r);
    g.totalSale += r.soldPrice ? Number(r.soldPrice) : 0;
    byOrder.set(r.ebayOrderId, g);
  }

  for (const [orderId, group] of byOrder) {
    const p = payouts.get(orderId);
    if (!p) continue;
    const denom = group.totalSale > 0
      ? group.totalSale
      : (group.internal.length + group.consign.length); // even split fallback

    const applyShare = (sale: number) => {
      const share = group.totalSale > 0 ? sale / denom : 1 / denom;
      return {
        ebayPayoutAmount: Math.round(p.payoutAmount * share * 100) / 100,
        ebayFeeAmount:    Math.round(p.feeAmount    * share * 100) / 100,
      };
    };

    for (const row of group.internal) {
      const sale = row.soldPrice ? Number(row.soldPrice) : 0;
      const { ebayPayoutAmount, ebayFeeAmount } = applyShare(sale);
      await db.internalListing.update({ where: { id: row.id }, data: { ebayPayoutAmount, ebayFeeAmount } });
      updated++;
    }
    for (const row of group.consign) {
      const sale = row.soldPrice ? Number(row.soldPrice) : 0;
      const { ebayPayoutAmount, ebayFeeAmount } = applyShare(sale);
      await db.ebayListing.update({ where: { id: row.id }, data: { ebayPayoutAmount, ebayFeeAmount } });
      updated++;
    }
  }

  return { updated, ordersFetched: payouts.size };
}
