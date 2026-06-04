// Pulls orders from eBay's Fulfillment API and syncs paid/shipped status into our DB.
// Covers both Internal listings and Consignment (EbayListing) rows by matching on
// the line items' listingId.

import { db } from "./db";
import { getAccessToken, getEbayConnectionStatus } from "./ebay-auth";

interface EbayAddress {
  fullName?: string;
  contactAddress?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateOrProvince?: string;
    postalCode?: string;
    countryCode?: string;
  };
}

interface EbayOrderLineItem {
  lineItemId: string;
  legacyItemId: string;
  title: string;
  sku?: string;
}

interface EbayOrder {
  orderId: string;
  legacyOrderId?: string;
  orderPaymentStatus?: string;        // PENDING | PAID | FAILED | REFUNDED | PARTIALLY_REFUNDED
  orderFulfillmentStatus?: string;    // NOT_STARTED | IN_PROGRESS | FULFILLED
  paymentSummary?: {
    payments?: Array<{ paymentStatus?: string; paymentDate?: string }>;
  };
  fulfillmentStartInstructions?: Array<{
    shippingStep?: {
      shipTo?: EbayAddress;
      shippingCarrierCode?: string;
    };
  }>;
  fulfillmentHrefs?: string[];   // last URL segment is the tracking number
  buyer?: { username?: string };
  lineItems?: EbayOrderLineItem[];
  creationDate?: string;
  lastModifiedDate?: string;
}

export interface OrderSyncResult {
  ordersFetched: number;
  rowsUpdated: number;
  ordersByListing: Map<string, EbayOrder>;
}

/** Fetch all orders from the past 30 days (covers most active fulfillment work). */
async function fetchRecentOrders(token: string, sandbox: boolean): Promise<EbayOrder[]> {
  const apiBase = sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  // Filter to orders created in the last 30 days. Sort newest first.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const filter = encodeURIComponent(`creationdate:[${since}..]`);
  const url = `${apiBase}/sell/fulfillment/v1/order?filter=${filter}&limit=200`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!r.ok) {
    console.error(`[ebay-orders] fetch failed (${r.status}):`, (await r.text()).slice(0, 300));
    return [];
  }
  const data = await r.json();
  return (data.orders ?? []) as EbayOrder[];
}

/** Sync sold/paid/shipped status from eBay into both InternalListing and EbayListing rows. */
export async function syncOrders(): Promise<OrderSyncResult> {
  const result: OrderSyncResult = { ordersFetched: 0, rowsUpdated: 0, ordersByListing: new Map() };

  const status = await getEbayConnectionStatus();
  if (!status.connected) return result;

  let token: string;
  try { token = await getAccessToken(); }
  catch { return result; }

  const sandbox = status.environment !== "production";
  const orders = await fetchRecentOrders(token, sandbox);
  result.ordersFetched = orders.length;

  for (const order of orders) {
    const isPaid = order.orderPaymentStatus === "PAID";
    const isFulfilled = order.orderFulfillmentStatus === "FULFILLED";
    const paidAt = isPaid
      ? new Date(order.paymentSummary?.payments?.find(p => p.paymentStatus === "PAID")?.paymentDate ?? Date.now())
      : null;
    const shipTo = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
    const buyerAddress = shipTo?.contactAddress ? {
      street1:    shipTo.contactAddress.addressLine1 ?? "",
      street2:    shipTo.contactAddress.addressLine2 ?? "",
      city:       shipTo.contactAddress.city ?? "",
      state:      shipTo.contactAddress.stateOrProvince ?? "",
      postalCode: shipTo.contactAddress.postalCode ?? "",
      country:    shipTo.contactAddress.countryCode ?? "US",
    } : null;
    const buyerName = shipTo?.fullName ?? order.buyer?.username ?? null;

    // Tracking + carrier — present once the seller has uploaded a label
    // to eBay. `fulfillmentHrefs[0]` ends in the tracking number; the
    // carrier code lives on the shipping step.
    const trackingNumber = (() => {
      const href = order.fulfillmentHrefs?.[0];
      if (!href) return null;
      const m = href.match(/shipping_fulfillment\/([^/?]+)/);
      return m?.[1] ?? null;
    })();
    const shippingCarrier = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shippingCarrierCode ?? null;
    const shippedAt = isFulfilled
      ? (order.lastModifiedDate ? new Date(order.lastModifiedDate) : new Date())
      : null;

    for (const li of order.lineItems ?? []) {
      const legacyListingId = li.legacyItemId;
      if (!legacyListingId) continue;
      result.ordersByListing.set(legacyListingId, order);

      // Pick the right status string for our internal flow
      const nextStatus =
        isFulfilled ? "shipped"
        : isPaid    ? "paid"
        :             "sold";

      const commonData = {
        ebayOrderId:  order.orderId,
        buyerName,
        buyerAddress: buyerAddress as object | null,
        paidAt:       paidAt ?? undefined,
        soldAt:       order.creationDate ? new Date(order.creationDate) : undefined,
        ...(trackingNumber  ? { trackingNumber }                 : {}),
        ...(shippingCarrier ? { shippingCarrier }                : {}),
        ...(shippedAt       ? { shippedAt }                      : {}),
      };

      // Update Internal listing if it matches
      const internal = await db.internalListing.findFirst({
        where: { ebayListingId: legacyListingId },
        select: { id: true, status: true },
      });
      if (internal) {
        // Don't downgrade — if user already marked shipped, leave alone.
        if (internal.status !== "shipped") {
          await db.internalListing.update({
            where: { id: internal.id },
            data:  { ...commonData, status: nextStatus },
          });
          result.rowsUpdated++;
        }
      }

      // Update Consignment EbayListing if it matches
      const consign = await db.ebayListing.findFirst({
        where: { ebayListingId: legacyListingId },
        select: { id: true, status: true },
      });
      if (consign) {
        if (consign.status !== "shipped") {
          await db.ebayListing.update({
            where: { id: consign.id },
            data:  { ...commonData, status: nextStatus },
          });
          result.rowsUpdated++;
        }
      }
    }
  }

  return result;
}
