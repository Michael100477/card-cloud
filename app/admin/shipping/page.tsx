import { db } from "@/lib/db";
import { syncOrdersThrottled } from "@/lib/ebay-sync-cache";
import { ShippingClient } from "./ShippingClient";
import { getLowSupplies } from "@/lib/shipping-supplies";

interface Address {
  street1?: string; street2?: string; city?: string;
  state?: string; postalCode?: string; country?: string;
}

export default async function AdminShippingPage() {
  // Pull paid-or-shipped orders into the DB before rendering so the table reflects reality.
  await syncOrdersThrottled();

  const lowSupplies = await getLowSupplies();

  const [internal, consign] = await Promise.all([
    db.internalListing.findMany({
      where: { status: { in: ["paid", "shipped"] } },
      orderBy: { paidAt: "desc" },
    }),
    db.ebayListing.findMany({
      where: { status: { in: ["paid", "shipped"] } },
      include: {
        item: { select: { id: true, player: true, year: true, set: true } },
      },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const rows = [
    ...internal.map(l => ({
      key:           `internal-${l.id}`,
      kind:          "internal" as const,
      id:            l.id,
      player:        l.player,
      year:          l.year,
      set:           l.set,
      title:         l.title,
      status:        l.status,
      soldPrice:     l.soldPrice ? Number(l.soldPrice) : null,
      soldAt:        l.soldAt?.toISOString() ?? null,
      paidAt:        l.paidAt?.toISOString() ?? null,
      shippedAt:     l.shippedAt?.toISOString() ?? null,
      ebayOrderId:   l.ebayOrderId,
      ebayListingId: l.ebayListingId,
      buyerName:     l.buyerName,
      buyerUsername: l.buyerUsername,
      buyerAddress:  l.buyerAddress as Address | null,
      weightOz:      Number(l.weightOz),
      dimLength:     Number(l.dimLength),
      dimWidth:      Number(l.dimWidth),
      dimHeight:     Number(l.dimHeight),
      shippingLabelUrl: l.shippingLabelUrl,
      trackingNumber:   l.trackingNumber,
      shippingCarrier:  l.shippingCarrier,
    })),
    ...consign.map(l => ({
      key:           `consign-${l.id}`,
      kind:          "consignment" as const,
      id:            l.id,
      player:        l.item.player,
      year:          l.item.year,
      set:           l.item.set,
      title:         l.title,
      status:        l.status,
      soldPrice:     l.soldPrice ? Number(l.soldPrice) : null,
      soldAt:        l.soldAt?.toISOString() ?? null,
      paidAt:        l.paidAt?.toISOString() ?? null,
      shippedAt:     l.shippedAt?.toISOString() ?? null,
      ebayOrderId:   l.ebayOrderId,
      ebayListingId: l.ebayListingId,
      buyerName:     l.buyerName,
      buyerUsername: l.buyerUsername,
      buyerAddress:  l.buyerAddress as Address | null,
      // Consignment listings don't carry their own weight/dims — use sensible defaults
      weightOz:      3,
      dimLength:     11,
      dimWidth:      6,
      dimHeight:     1,
      shippingLabelUrl: l.shippingLabelUrl,
      trackingNumber:   l.trackingNumber,
      shippingCarrier:  l.shippingCarrier,
    })),
  ].sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));

  const readyCount   = rows.filter(r => r.status === "paid").length;
  const shippedCount = rows.filter(r => r.status === "shipped").length;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Shipping</h1>
      <p className="text-slate-400 text-sm mb-6">
        {readyCount} ready to ship · {shippedCount} shipped
      </p>
      <ShippingClient rows={rows} lowSupplies={lowSupplies.map(s => ({ label: s.label, count: s.count, threshold: s.threshold }))} />
    </div>
  );
}
