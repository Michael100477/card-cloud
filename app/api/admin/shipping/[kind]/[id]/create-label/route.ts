import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { getAccessToken, getEbayConnectionStatus } from "@/lib/ebay-auth";
import { logger } from "@/lib/logger";
import { buyLabel, carrierCodeForEbay, computeSupplyCost } from "@/lib/easypost";

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

  // 1. Load the primary record + buyer address + package size
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

  // Find every sibling listing in the same eBay order so a multi-item
  // purchase ships under ONE label and is marked shipped atomically.
  // Siblings can be a mix of internal_listings and ebay_listings (Mike sells
  // his own inventory alongside consignments under the same seller account).
  const [internalSiblings, consignSiblings] = await Promise.all([
    db.internalListing.findMany({ where: { ebayOrderId: record.ebayOrderId, status: "paid" } }),
    db.ebayListing.findMany({     where: { ebayOrderId: record.ebayOrderId, status: "paid" } }),
  ]);

  // Combine package: sum weights (safer overestimate for postage), keep the
  // largest per-axis dimension (items stacked flat in a single bubble mailer).
  // Consignment rows don't carry weight/dims, so fall back to single-card
  // graded defaults for them.
  type PkgFields = { weightLbs?: number | null; weightOz?: number | unknown; dimLength?: number | unknown; dimWidth?: number | unknown; dimHeight?: number | unknown };
  function pkg(r: PkgFields) {
    return {
      lbs: r.weightLbs ?? 0,
      oz:  Number(r.weightOz  ?? 3),
      l:   Number(r.dimLength ?? 11),
      w:   Number(r.dimWidth  ?? 6),
      h:   Number(r.dimHeight ?? 1),
    };
  }
  const allPackages = [
    ...internalSiblings.map(s => pkg(s)),
    ...consignSiblings.map(() => pkg({ weightOz: 3, dimLength: 11, dimWidth: 6, dimHeight: 1 })),
  ];
  if (allPackages.length === 0) allPackages.push(pkg(record as PkgFields));
  const totalOz   = allPackages.reduce((s, p) => s + p.lbs * 16 + p.oz, 0);
  const dimLength = Math.max(...allPackages.map(p => p.l));
  const dimWidth  = Math.max(...allPackages.map(p => p.w));
  const dimHeight = Math.max(...allPackages.map(p => p.h));

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

  // 3. Save back to DB and flip status to shipped for EVERY sibling in the
  // order. The label cost is divided equally across the items so the Payout
  // tab's per-item net profit reflects each item's share of postage. Supply
  // cost is also divided so it's not double-counted across siblings.
  const supplyCost = await computeSupplyCost();
  const siblingCount = internalSiblings.length + consignSiblings.length;
  const totalItems = Math.max(siblingCount, 1);
  const postagePerItem = Math.round((label.cost / totalItems) * 100) / 100;
  const supplyPerItem  = Math.round((supplyCost  / totalItems) * 100) / 100;
  const updateData = {
    status:              "shipped" as const,
    shippedAt:           new Date(),
    shippingLabelUrl:    label.labelUrl,
    trackingNumber:      label.trackingNumber,
    shippingCarrier:     label.carrier,
    shippingPostageCost: postagePerItem,
    shippingSupplyCost:  supplyPerItem,
  };
  await Promise.all([
    ...internalSiblings.map(s => db.internalListing.update({ where: { id: s.id }, data: updateData })),
    ...consignSiblings.map(s  => db.ebayListing.update({     where: { id: s.id }, data: updateData })),
  ]);
  // Fallback: if no siblings were found (defensive — record should always be
  // in the sibling list since we filtered by its own ebayOrderId), update
  // the primary record so the user-facing flow still completes.
  if (siblingCount === 0) {
    if (kind === "internal") await db.internalListing.update({ where: { id }, data: { ...updateData, shippingPostageCost: label.cost, shippingSupplyCost: supplyCost } });
    else                     await db.ebayListing.update({     where: { id }, data: { ...updateData, shippingPostageCost: label.cost, shippingSupplyCost: supplyCost } });
  }

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
