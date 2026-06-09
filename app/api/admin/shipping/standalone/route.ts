import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { getRates, buyRate } from "@/lib/easypost";
import { logger } from "@/lib/logger";

/**
 * Standalone label flow — two modes:
 *
 *  Mode A (quote, no shipmentId in body):
 *    Body: { to, parcel, insuranceValue? }
 *    Returns: { shipmentId, rates: [{ id, carrier, service, rate, … }] }
 *    Side effect: creates a shipment in EasyPost; nothing is bought.
 *
 *  Mode B (buy, with shipmentId + rateId):
 *    Body: { shipmentId, rateId }
 *    Returns: { labelUrl, trackingNumber, carrier, service, cost }
 *    Side effect: buys the label.
 */
export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  let body: {
    shipmentId?: string;
    rateId?: string;
    to?: { name?: string; street1?: string; street2?: string; city?: string; state?: string; zip?: string; country?: string; phone?: string };
    parcel?: { length?: number; width?: number; height?: number; weight?: number };
    insuranceValue?: number;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  // ── Mode B — buy ──────────────────────────────────────────────────────
  if (body.shipmentId && body.rateId) {
    try {
      const label = await buyRate(body.shipmentId, body.rateId);
      logger.info({
        category: "shipping",
        action:   "shipping.standalone.bought",
        message:  `Standalone label bought via EasyPost: ${label.trackingNumber}`,
        data:     label,
      });
      return NextResponse.json({ ok: true, ...label });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error({ category: "shipping", action: "shipping.standalone.buy.failed", message: msg });
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── Mode A — quote ────────────────────────────────────────────────────
  const required: [string, unknown][] = [
    ["to.name",       body.to?.name],
    ["to.street1",    body.to?.street1],
    ["to.city",       body.to?.city],
    ["to.state",      body.to?.state],
    ["to.zip",        body.to?.zip],
    ["parcel.length", body.parcel?.length],
    ["parcel.width",  body.parcel?.width],
    ["parcel.height", body.parcel?.height],
    ["parcel.weight", body.parcel?.weight],
  ];
  const missing = required.filter(([, v]) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v)));
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.map(([k]) => k).join(", ")}` }, { status: 400 });
  }

  try {
    const quote = await getRates({
      to: {
        name:    body.to!.name!,
        street1: body.to!.street1!,
        street2: body.to!.street2 || undefined,
        city:    body.to!.city!,
        state:   body.to!.state!,
        zip:     body.to!.zip!,
        country: body.to!.country || "US",
        phone:   body.to!.phone || undefined,
      },
      parcel: {
        length: Number(body.parcel!.length),
        width:  Number(body.parcel!.width),
        height: Number(body.parcel!.height),
        weight: Number(body.parcel!.weight),
      },
      insuranceValue: body.insuranceValue,
    });
    logger.info({
      category: "shipping",
      action:   "shipping.standalone.quoted",
      message:  `Standalone quote: ${quote.rates.length} rate(s)`,
      data:     { shipmentId: quote.shipmentId, rateCount: quote.rates.length },
    });
    return NextResponse.json({ ok: true, ...quote });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error({ category: "shipping", action: "shipping.standalone.quote.failed", message: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
