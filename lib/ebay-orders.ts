// Pulls orders from eBay's Fulfillment API and syncs paid/shipped status into our DB.
// Covers both Internal listings and Consignment (EbayListing) rows by matching on
// the line items' listingId.

import { db } from "./db";
import { getAccessToken, getEbayConnectionStatus } from "./ebay-auth";
import { getSoldListings } from "./ebay-live-prices";

// ── Trading API credential helpers (mirrored from ebay-live-prices.ts) ─────
async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}
function ek(base: string, isSandbox: boolean): string {
  return isSandbox ? base : `${base}_prod`;
}

// ── GetItemTransactions — buyer info for ended auctions ────────────────────
// eBay's GetMyeBaySelling SoldList response does NOT include buyer info.
// To populate buyer username/name on rows whose order hasn't materialized
// in the Fulfillment API yet, we call GetItemTransactions per item.
interface BuyerInfo { username: string | null; name: string | null }

async function fetchBuyerInfo(itemId: string): Promise<BuyerInfo | null> {
  const status = await getEbayConnectionStatus();
  if (!status.connected) return null;
  let token: string;
  try { token = await getAccessToken(); } catch { return null; }

  const isSandbox = status.environment !== "production";
  const apiBase = isSandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  const [appId, devId, certId] = await Promise.all([
    getCred(ek("ebay_app_id", isSandbox)),
    getCred("ebay_dev_id"),
    getCred(ek("ebay_cert_id", isSandbox)),
  ]);

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <Pagination><EntriesPerPage>1</EntriesPerPage><PageNumber>1</PageNumber></Pagination>
</GetItemTransactionsRequest>`;

  const r = await fetch(`${apiBase}/ws/api.dll`, {
    method: "POST",
    headers: {
      "X-EBAY-API-CALL-NAME":           "GetItemTransactions",
      "X-EBAY-API-SITEID":              "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-APP-NAME":            appId  ?? "",
      "X-EBAY-API-DEV-NAME":            devId  ?? "",
      "X-EBAY-API-CERT-NAME":           certId ?? "",
      "Content-Type":                   "text/xml;charset=utf-8",
    },
    body: xml,
  });
  if (!r.ok) return null;
  const text = await r.text();

  const ack = text.match(/<Ack>(\w+)<\/Ack>/)?.[1];
  if (ack !== "Success" && ack !== "Warning") {
    console.warn(`[buyer-fetch ${itemId}] ack=${ack}`);
    return null;
  }

  const buyerSection = text.match(/<Buyer[^>]*>([\s\S]*?)<\/Buyer>/)?.[1] ?? "";
  if (!buyerSection) return null;

  const username = buyerSection.match(/<UserID[^>]*>([^<]+)<\/UserID>/)?.[1]?.trim() ?? null;
  // Name lives inside <RegistrationAddress><Name>…</Name></RegistrationAddress>.
  const regSection = buyerSection.match(/<RegistrationAddress[^>]*>([\s\S]*?)<\/RegistrationAddress>/)?.[1] ?? buyerSection;
  const name = regSection.match(/<Name[^>]*>([^<]+)<\/Name>/)?.[1]?.trim() ?? null;

  return { username, name };
}

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
  lineItemCost?: { value?: string; currency?: string };
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

/** Fetch all orders from the past 60 days. The window must match SoldList's
 *  60-day window so importUnmatchedSoldListings doesn't over-import older
 *  paid/shipped items as "sold" just because their orders fell outside our
 *  fetch range. */
async function fetchRecentOrders(token: string, sandbox: boolean): Promise<EbayOrder[]> {
  const apiBase = sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
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
    const buyerName     = shipTo?.fullName ?? order.buyer?.username ?? null;
    const buyerUsername = order.buyer?.username ?? null;

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

      // Per-line-item sale price (eBay reports it on lineItemCost). Falls
      // back to undefined for older orders where eBay didn't include it.
      const linePriceStr = li.lineItemCost?.value;
      const linePrice    = linePriceStr ? parseFloat(linePriceStr) : null;

      const commonData = {
        ebayOrderId:  order.orderId,
        buyerName,
        buyerUsername,
        buyerAddress: buyerAddress as object | null,
        paidAt:       paidAt ?? undefined,
        soldAt:       order.creationDate ? new Date(order.creationDate) : undefined,
        ...(trackingNumber  ? { trackingNumber }                 : {}),
        ...(shippingCarrier ? { shippingCarrier }                : {}),
        ...(shippedAt       ? { shippedAt }                      : {}),
        ...(linePrice != null && !isNaN(linePrice) ? { soldPrice: linePrice } : {}),
      };

      // Don't ever downgrade status — but always sync tracking + carrier
      // + shippedAt even if we already marked it shipped, because those
      // come from eBay after the initial mark-shipped action.
      const dataWithStatus    = { ...commonData, status: nextStatus };
      const dataWithoutStatus = { ...commonData };
      // remove status key from the no-status variant
      delete (dataWithoutStatus as { status?: string }).status;

      // Update Internal listing if it matches
      const internal = await db.internalListing.findFirst({
        where: { ebayListingId: legacyListingId },
        select: { id: true, status: true },
      });
      if (internal) {
        await db.internalListing.update({
          where: { id: internal.id },
          data:  internal.status === "shipped" ? dataWithoutStatus : dataWithStatus,
        });
        result.rowsUpdated++;
      }

      // Update Consignment EbayListing if it matches
      const consign = await db.ebayListing.findFirst({
        where: { ebayListingId: legacyListingId },
        select: { id: true, status: true },
      });
      if (consign) {
        await db.ebayListing.update({
          where: { id: consign.id },
          data:  consign.status === "shipped" ? dataWithoutStatus : dataWithStatus,
        });
        result.rowsUpdated++;
      }

      // No matching row in either table — this is a listing the admin
      // created directly on eBay (or one whose original row was lost).
      // Auto-create an internal_listing so the order surfaces in the
      // right tab. The schema's many defaults cover the eBay-config
      // fields we don't have; we set what the order actually tells us.
      if (!internal && !consign) {
        await db.internalListing.create({
          data: {
            ebayListingId:  legacyListingId,
            title:          li.title ?? "",
            player:         "",                 // unknown — admin can fill in later
            status:         nextStatus,
            startPrice:     linePrice != null && !isNaN(linePrice) ? linePrice : 0,
            ebayOrderId:    order.orderId,
            buyerName,
            buyerUsername,
            buyerAddress:   buyerAddress as object | null,
            paidAt:         paidAt ?? undefined,
            soldAt:         order.creationDate ? new Date(order.creationDate) : undefined,
            ...(trackingNumber  ? { trackingNumber }  : {}),
            ...(shippingCarrier ? { shippingCarrier } : {}),
            ...(shippedAt       ? { shippedAt }       : {}),
            ...(linePrice != null && !isNaN(linePrice) ? { soldPrice: linePrice } : {}),
          },
        });
        result.rowsUpdated++;
      }
    }
  }

  return result;
}

/** Sync items in eBay's SoldList into our DB. Two roles:
 *   (1) create internal_listing rows for SoldList items absent from both
 *       listings tables (auctions that ended before we knew about them
 *       OR ended after the syncOrders 60-day window),
 *   (2) backfill missing buyer/soldAt on rows we already had — e.g. a
 *       Card-Cloud-created listing that auto-demoted active→sold but
 *       never got buyer info because no order has materialized yet.
 *  We never overwrite existing fields — only fill in nulls. */
export async function syncSoldListings(): Promise<{ created: number; updated: number; buyersFetched: number }> {
  const sold = await getSoldListings();
  if (sold.size === 0) return { created: 0, updated: 0, buyersFetched: 0 };

  const ids = [...sold.keys()];
  const [internal, consign] = await Promise.all([
    db.internalListing.findMany({
      where:  { ebayListingId: { in: ids } },
      select: { id: true, ebayListingId: true, buyerUsername: true, soldAt: true, soldPrice: true, title: true, status: true },
    }),
    db.ebayListing.findMany({
      where:  { ebayListingId: { in: ids } },
      select: { id: true, ebayListingId: true, buyerUsername: true, soldAt: true, status: true },
    }),
  ]);
  const internalByEbay = new Map(internal.map(l => [l.ebayListingId!, l]));
  const consignByEbay  = new Map(consign.map(l  => [l.ebayListingId!, l]));

  let created = 0;
  let updated = 0;
  for (const [itemId, info] of sold) {
    const endTimeDate = info.endTime ? new Date(info.endTime) : null;

    // If SoldList returned the item, eBay says it sold. Promote our row
    // from active / draft / ended to "sold" so the Waiting-for-Payment tab
    // matches eBay's reality. Don't downgrade rows that are already further
    // along the funnel (paid, shipped) — syncOrders handles those.
    const needsPromote = (currentStatus: string) =>
      currentStatus === "active" || currentStatus === "draft" || currentStatus === "ended";

    const i = internalByEbay.get(itemId);
    if (i) {
      const patch: Record<string, unknown> = {};
      if (!i.buyerUsername && info.buyerUsername) patch.buyerUsername = info.buyerUsername;
      if (!i.soldAt        && endTimeDate)        patch.soldAt        = endTimeDate;
      if (!i.soldPrice     && info.price > 0)     patch.soldPrice     = info.price;
      if (!i.title         && info.title)         patch.title         = info.title;
      if (needsPromote(i.status))                 patch.status        = "sold";
      if (Object.keys(patch).length > 0) {
        await db.internalListing.update({ where: { id: i.id }, data: patch });
        updated++;
      }
      continue;
    }
    const c = consignByEbay.get(itemId);
    if (c) {
      const patch: Record<string, unknown> = {};
      if (!c.buyerUsername && info.buyerUsername) patch.buyerUsername = info.buyerUsername;
      if (!c.soldAt        && endTimeDate)        patch.soldAt        = endTimeDate;
      if (needsPromote(c.status))                 patch.status        = "sold";
      if (Object.keys(patch).length > 0) {
        await db.ebayListing.update({ where: { id: c.id }, data: patch });
        updated++;
      }
      continue;
    }

    // Neither table has this item — create an internal_listing row.
    await db.internalListing.create({
      data: {
        ebayListingId: itemId,
        title:         info.title ?? "",
        player:        "",
        status:        "sold",
        startPrice:    0,
        soldPrice:     info.price > 0 ? info.price : undefined,
        buyerUsername: info.buyerUsername ?? undefined,
        soldAt:        endTimeDate ?? undefined,
      },
    });
    created++;
  }

  // ── Buyer fill-in via GetItemTransactions ────────────────────────────
  // For rows still without buyer info AND without a Fulfillment-API
  // order, call GetItemTransactions per item. Capped per run so a sync
  // pass can't blow up eBay's call quota.
  const BUYER_FETCH_LIMIT = 25;
  const [needInternal, needConsign] = await Promise.all([
    db.internalListing.findMany({
      where: {
        ebayListingId: { in: ids },
        status:        "sold",
        buyerUsername: null,
        ebayOrderId:   null,
      },
      select: { id: true, ebayListingId: true },
      take: BUYER_FETCH_LIMIT,
    }),
    db.ebayListing.findMany({
      where: {
        ebayListingId: { in: ids },
        status:        "sold",
        buyerUsername: null,
        ebayOrderId:   null,
      },
      select: { id: true, ebayListingId: true },
      take: BUYER_FETCH_LIMIT,
    }),
  ]);

  let buyersFetched = 0;
  for (const row of needInternal) {
    const b = await fetchBuyerInfo(row.ebayListingId!);
    if (!b?.username) continue;
    await db.internalListing.update({
      where: { id: row.id },
      data:  {
        buyerUsername: b.username,
        ...(b.name ? { buyerName: b.name } : {}),
      },
    });
    buyersFetched++;
  }
  for (const row of needConsign) {
    const b = await fetchBuyerInfo(row.ebayListingId!);
    if (!b?.username) continue;
    await db.ebayListing.update({
      where: { id: row.id },
      data:  {
        buyerUsername: b.username,
        ...(b.name ? { buyerName: b.name } : {}),
      },
    });
    buyersFetched++;
  }

  return { created, updated, buyersFetched };
}

/** @deprecated kept for compatibility — call syncSoldListings instead. */
export const importUnmatchedSoldListings = syncSoldListings;
