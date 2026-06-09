import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { getAccessToken, getEbayConnectionStatus } from "@/lib/ebay-auth";
import { logger } from "@/lib/logger";
import { buyLabel, carrierCodeForEbay } from "@/lib/easypost";

/**
 * Create a shipping label for a paid order. Two-step flow:
 *   1. Buy the label via EasyPost (USPS Commercial Plus rates)
 *   2. Tell eBay the order is fulfilled (so eBay emails the buyer with tracking)
 *
 * Step 2 fails non-fatally — the label is still saved locally even if eBay
 * notification couldn't be sent; the admin can mark shipped manually later.
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

  // Package dimensions — only InternalListing has these as columns; consignment
  // falls back to standard trading-card defaults.
  type PkgFields = { weightLbs?: number; weightOz?: number | unknown; dimLength?: number | unknown; dimWidth?: number | unknown; dimHeight?: number | unknown };
  const rec = record as typeof record & PkgFields;
  const weightLbs = rec.weightLbs ?? 0;
  const weightOz  = Number(rec.weightOz  ?? 3);
  const dimLength = Number(rec.dimLength ?? 11);
  const dimWidth  = Number(rec.dimWidth  ?? 6);
  const dimHeight = Number(rec.dimHeight ?? 1);
  const totalOz   = weightLbs * 16 + weightOz;

  // 2. Buy label via EasyPost
  let label: Awaited<ReturnType<typeof buyLabel>>;
  try {
    label = await buyLabel({
      to: {
        name:    record.buyerName    ?? record.buyerUsername ?? "Buyer",
        street1: addr.street1        ?? "",
        street2: addr.street2        || undefined,
        city:    addr.city           ?? "",
        state:   addr.state          ?? "",
        zip:     addr.postalCode     ?? "",
        country: addr.country        ?? "US",
      },
      parcel: { length: dimLength, width: dimWidth, height: dimHeight, weight: totalOz },
      insuranceValue: record.soldPrice ? Number(record.soldPrice) : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error({ category: "shipping", action: "shipping.label.buy.failed", message: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 3. Save back to DB and flip status to shipped
  const updateData = {
    status:           "shipped" as const,
    shippedAt:        new Date(),
    shippingLabelUrl: label.labelUrl,
    trackingNumber:   label.trackingNumber,
    shippingCarrier:  label.carrier,
  };
  if (kind === "internal") await db.internalListing.update({ where: { id }, data: updateData });
  else                     await db.ebayListing.update({ where: { id }, data: updateData });

  // 4. Tell eBay the order is fulfilled (this notifies the buyer with tracking).
  // Non-fatal — if this fails the label is already saved and admin can paste
  // the tracking number into eBay's seller hub manually.
  const ebayStatus = await getEbayConnectionStatus();
  let ebayNotified = false;
  let ebayWarning: string | null = null;
  if (ebayStatus.connected && record.ebayOrderId) {
    try {
      const token = await getAccessToken();
      const apiBase = ebayStatus.environment === "production" ? "https://api.ebay.com" : "https://api.sandbox.ebay.com";
      const r = await fetch(`${apiBase}/sell/fulfillment/v1/order/${record.ebayOrderId}/shipping_fulfillment`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems: [],   // empty = all line items on the order
          trackingNumber:      label.trackingNumber,
          shippingCarrierCode: carrierCodeForEbay(label.carrier),
        }),
      });
      if (r.ok) ebayNotified = true;
      else {
        const body = await r.text();
        ebayWarning = `eBay fulfillment POST returned ${r.status}: ${body.slice(0, 150)}`;
        logger.warn({ category: "shipping", action: "shipping.ebay.notify.failed", message: ebayWarning });
      }
    } catch (e) {
      ebayWarning = `eBay fulfillment POST threw: ${e instanceof Error ? e.message : String(e)}`;
      logger.warn({ category: "shipping", action: "shipping.ebay.notify.failed", message: ebayWarning });
    }
  }

  logger.info({
    category: "shipping",
    action:   "shipping.label.created",
    message:  `Shipping label created via EasyPost: ${label.trackingNumber}`,
    data: {
      ebayOrderId:  record.ebayOrderId,
      labelUrl:     label.labelUrl,
      trackingNumber: label.trackingNumber,
      carrier:      label.carrier,
      service:      label.service,
      cost:         label.cost,
      ebayNotified,
    },
  });

  return NextResponse.json({
    ok:               true,
    labelUrl:         label.labelUrl,
    trackingNumber:   label.trackingNumber,
    carrier:          label.carrier,
    service:          label.service,
    cost:             label.cost,
    ebayNotified,
    ebayWarning,
  });
}
