import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { emailInboundReceived } from "@/lib/trade-emails";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const { side } = await req.json();
  if (side !== "initiator" && side !== "target") return NextResponse.json({ error: "side must be 'initiator' or 'target'" }, { status: 400 });

  const trade = await db.trade.findUnique({
    where: { id },
    select: { status: true, initiatorInboundReceivedAt: true, targetInboundReceivedAt: true },
  });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["inbound", "accepted"].includes(trade.status)) {
    return NextResponse.json({ error: `Cannot mark inbound received in status "${trade.status}"` }, { status: 400 });
  }

  const now = new Date();
  const data: Record<string, unknown> = side === "initiator"
    ? { initiatorInboundReceivedAt: now }
    : { targetInboundReceivedAt:    now };

  // If both sides will now be received, flip status to received_both
  const otherDone = side === "initiator" ? trade.targetInboundReceivedAt : trade.initiatorInboundReceivedAt;
  if (otherDone) data.status = "received_both";
  else if (trade.status === "accepted") data.status = "inbound";

  await db.trade.update({ where: { id }, data });
  void emailInboundReceived(id, side);
  return NextResponse.json({ ok: true });
}
