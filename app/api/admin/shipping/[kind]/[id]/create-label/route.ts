import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { getAccessToken, getEbayConnectionStatus } from "@/lib/ebay-auth";
import { logger } from "@/lib/logger";

/**
 * Create a shipping label for a paid order via eBay's Sell Logistics API.
 * Flow:
 *   1. POST /sell/logistics/v1/shipping_quote  → returns a list of carrier/service options
 *   2. POST /sell/logistics/v1/shipment        → buys the label using the cheapest option
 *      (prefers eBay Standard Envelope when item ≤ $50 and US destination)
 *   3. Save label URL + tracking number; flip status → shipped
 *
 * Heads up: eBay's Logistics API requires the seller's eBay account to be linked to a
 * Managed Payments balance with sufficient funds. The first call may also require enabling
 * shipping label purchasing in the eBay seller dashboard.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { kind, id } = await params;

  // 1. Load the record + buyer address + package size
  const record = kind === "internal"
    ? await db.internalListing.findUnique({ where: { id } })
    : kind === "consignment"
      ? await db.ebayListing.findUnique({ where: { id } })
      : null;
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (record.status !== "paid") {
    return NextResponse.json({ error: `Cannot create label — status is "${record.status}", expected "paid"` }, { status: 400 });
  }
  if (!record.ebayOrderId)  return NextResponse.json({ error: "No eBay order ID on record yet — try again in a minute after the order sync runs." }, { status: 400 });
  if (!record.buyerAddress) return NextResponse.json({ error: "No buyer address on record yet — try again in a minute after the order sync runs." }, { status: 400 });

  type Addr = { street1?: string; street2?: string; city?: string; state?: string; postalCode?: string; country?: string };
  const addr = record.buyerAddress as Addr;

  const status = await getEbayConnectionStatus();
  if (!status.connected) return NextResponse.json({ error: "eBay account not connected" }, { status: 400 });
  let token: string;
  try { token = await getAccessToken(); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
  const sandbox = status.environment !== "production";
  const apiBase = sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

  // Package dimensions — use the listing's saved values; only InternalListing has these
  // as columns. For consignment, fall back to standard trading-card defaults.
  // Type the optional package fields so TypeScript knows about them on consignment rows.
  type PkgFields = { weightLbs?: number; weightOz?: number | unknown; dimLength?: number | unknown; dimWidth?: number | unknown; dimHeight?: number | unknown };
  const rec = record as typeof record & PkgFields;
  const weightLbs = rec.weightLbs ?? 0;
  const weightOz  = Number(rec.weightOz  ?? 3);
  const dimLength = Number(rec.dimLength ?? 11);
  const dimWidth  = Number(rec.dimWidth  ?? 6);
  const dimHeight = Number(rec.dimHeight ?? 1);

  const soldPrice = record.soldPrice ? Number(record.soldPrice) : 0;

  // 2. Request a shipping quote from eBay
  const quoteBody = {
    accountCurrency: "USD",
    packageSpecification: {
      dimensions: { length: dimLength, width: dimWidth, height: dimHeight, unit: "INCH" },
      weight:     { value: weightLbs * 16 + weightOz, unit: "OUNCE" },
    },
    shipFrom: {
      // eBay pulls the actual return address from the seller account; we just need a hint.
      contactAddress: { postalCode: "00000", countryCode: "US" }, // overridden by account
    },
    shipTo: {
      contactAddress: {
        addressLine1:    addr.street1 ?? "",
        addressLine2:    addr.street2 ?? undefined,
        city:            addr.city ?? "",
        stateOrProvince: addr.state ?? "",
        postalCode:      addr.postalCode ?? "",
        countryCode:     addr.country ?? "US",
      },
    },
  };
  const quoteR = await fetch(`${apiBase}/sell/logistics/v1/shipping_quote`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(quoteBody),
  });
  const quoteData = await quoteR.json().catch(() => ({}));
  if (!quoteR.ok) {
    logger.error({ category: "ebay", action: "ebay.label.quote.failed", message: `Shipping quote failed: ${quoteR.status}`, data: { quoteData } });
    return NextResponse.json({
      error: `Shipping quote failed (${quoteR.status}): ${quoteData?.errors?.[0]?.message ?? JSON.stringify(quoteData).slice(0, 250)}`,
    }, { status: 500 });
  }

  // 3. Pick the right rate
  // Prefer eBay Standard Envelope (eligible: trading cards ≤ $50, US destination).
  type Rate = { rateId: string; shippingCarrierCode?: string; shippingServiceCode?: string; baseShippingCost?: { value: string; currency: string } };
  const rates: Rate[] = quoteData.rates ?? [];
  const isUS = (addr.country ?? "US") === "US";
  const eseEligible = soldPrice <= 50 && isUS;
  const ese = rates.find(r => /ENVELOPE/i.test(r.shippingServiceCode ?? ""));
  const cheapest = [...rates].sort((a, b) => parseFloat(a.baseShippingCost?.value ?? "999") - parseFloat(b.baseShippingCost?.value ?? "999"))[0];
  const chosen = (eseEligible && ese) ? ese : cheapest;
  if (!chosen) {
    return NextResponse.json({ error: "eBay returned no shipping rates for this address/package." }, { status: 500 });
  }

  // 4. Create the shipment (buy the label)
  const shipmentBody = {
    rateId: chosen.rateId,
    labelCustomMessage: `Card Cloud — eBay order ${record.ebayOrderId}`,
  };
  const shipR = await fetch(`${apiBase}/sell/logistics/v1/shipment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(shipmentBody),
  });
  const shipData = await shipR.json().catch(() => ({}));
  if (!shipR.ok) {
    logger.error({ category: "ebay", action: "ebay.label.create.failed", message: `Label create failed: ${shipR.status}`, data: { shipData, chosen } });
    return NextResponse.json({
      error: `Label creation failed (${shipR.status}): ${shipData?.errors?.[0]?.message ?? JSON.stringify(shipData).slice(0, 250)}`,
    }, { status: 500 });
  }

  const labelUrl       = shipData.labelDownloadUrl ?? null;
  const trackingNumber = shipData.trackingNumber   ?? shipData.shipmentTrackingNumber ?? null;

  // 5. Save back to DB and flip status to shipped
  const updateData = {
    status: "shipped",
    shippedAt: new Date(),
    shippingLabelUrl: labelUrl,
    trackingNumber,
  };
  if (kind === "internal") await db.internalListing.update({ where: { id }, data: updateData });
  else                     await db.ebayListing.update({ where: { id }, data: updateData });

  // 6. Tell eBay the order is fulfilled (this notifies the buyer)
  if (record.ebayOrderId && trackingNumber) {
    await fetch(`${apiBase}/sell/fulfillment/v1/order/${record.ebayOrderId}/shipping_fulfillment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        lineItems: [],   // empty = all line items on the order
        trackingNumber,
        shippingCarrierCode: chosen.shippingCarrierCode,
      }),
    }).catch(() => null);
  }

  logger.info({
    category: "ebay", action: "ebay.label.created",
    message: `Shipping label created via ${chosen.shippingServiceCode}: ${trackingNumber}`,
    data: { ebayOrderId: record.ebayOrderId, labelUrl, trackingNumber, cost: chosen.baseShippingCost?.value },
  });

  return NextResponse.json({ ok: true, labelUrl, trackingNumber, service: chosen.shippingServiceCode });
}
