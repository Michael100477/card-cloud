import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { decrementShippingSupplies } from "@/lib/shipping-supplies";

interface MarkShippedBody {
  trackingNumber?:  string;
  carrier?:         string;
  /** True = decrement supply inventory (envelope, label, packing slip) once.
   *  Default true. Combined-order groups call mark-shipped per item but
   *  consume one set of supplies total, so the UI sends false for items 2..N
   *  in the same group. */
  consumeSupplies?: boolean;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { kind, id } = await params;
  // Body is optional — older callers post nothing. New callers can pass
  // tracking + carrier to record a shipment bought outside Card Cloud.
  let body: MarkShippedBody = {};
  try { body = (await req.json()) as MarkShippedBody; } catch { /* empty body is fine */ }

  const trackingNumber = body.trackingNumber?.trim() || null;
  const carrier        = body.carrier?.trim() || (trackingNumber ? "USPS" : null);

  const data = {
    status: "shipped" as const,
    shippedAt: new Date(),
    ...(trackingNumber ? { trackingNumber, shippingCarrier: carrier } : {}),
  };
  if (kind === "internal")           await db.internalListing.update({ where: { id }, data });
  else if (kind === "consignment")   await db.ebayListing.update({ where: { id }, data });
  else return NextResponse.json({ error: "Unknown kind" }, { status: 400 });

  // Decrement supply inventory unless caller explicitly opted out (combined
  // order groups send consumeSupplies=false on items 2..N).
  if (body.consumeSupplies !== false) {
    await decrementShippingSupplies();
  }
  return NextResponse.json({ ok: true });
}
