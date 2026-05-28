import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { emailOutboundShipped } from "@/lib/trade-emails";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const { side, tracking } = await req.json();
  if (side !== "initiator" && side !== "target")          return NextResponse.json({ error: "side must be 'initiator' or 'target'" }, { status: 400 });
  if (typeof tracking !== "string" || !tracking.trim())   return NextResponse.json({ error: "tracking required" }, { status: 400 });

  const trade = await db.trade.findUnique({
    where: { id },
    select: { status: true, initiatorOutboundShippedAt: true, targetOutboundShippedAt: true },
  });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["received_both", "outbound"].includes(trade.status)) {
    return NextResponse.json({ error: `Cannot mark outbound shipped in status "${trade.status}". Both inbound shipments must arrive first.` }, { status: 400 });
  }

  const now = new Date();
  const data: Record<string, unknown> = side === "initiator"
    ? { initiatorOutboundTracking: tracking.trim(), initiatorOutboundShippedAt: now }
    : { targetOutboundTracking:    tracking.trim(), targetOutboundShippedAt:    now };

  // If this is the first outbound, flip status. If both will be shipped, stay outbound until receipt.
  if (trade.status === "received_both") data.status = "outbound";

  await db.trade.update({ where: { id }, data });
  // Email the side this shipment is going TO. Note: when side="initiator", we ship
  // the TARGET's cards to the INITIATOR (they're getting what target sent). So the
  // recipient of THIS shipment is `side` itself.
  void emailOutboundShipped(id, side, tracking.trim());
  return NextResponse.json({ ok: true });
}
