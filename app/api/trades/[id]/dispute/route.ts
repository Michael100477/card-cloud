import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { emailDisputeOpened } from "@/lib/trade-emails";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = session.user.id;
  const { id } = await params;
  const body = await req.json();
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "Reason required (describe what's wrong)" }, { status: 400 });
  if (reason.length > 2000) return NextResponse.json({ error: "Reason is too long (max 2000 chars)" }, { status: 400 });

  const trade = await db.trade.findUnique({
    where: { id },
    select: {
      initiatorId: true, targetId: true, status: true,
      initiatorOutboundShippedAt: true, targetOutboundShippedAt: true,
      initiatorReceivedAt: true, targetReceivedAt: true,
    },
  });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trade.initiatorId !== myId && trade.targetId !== myId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  // Disputes can only be opened after the outbound shipment to ME has gone out.
  // (Before that, there's nothing to dispute on receipt.)
  const iAmInitiator = trade.initiatorId === myId;
  const myShipmentShipped = iAmInitiator ? trade.initiatorOutboundShippedAt : trade.targetOutboundShippedAt;
  if (!myShipmentShipped) {
    return NextResponse.json({ error: "Can only open a dispute once Card Cloud has shipped your cards." }, { status: 400 });
  }
  if (trade.status === "disputed") return NextResponse.json({ error: "A dispute is already open on this trade." }, { status: 400 });
  if (trade.status === "complete") return NextResponse.json({ error: "Trade is already complete." }, { status: 400 });

  await db.trade.update({
    where: { id },
    data: {
      status: "disputed",
      disputeOpenedById: myId,
      disputeReason: reason,
      disputeOpenedAt: new Date(),
    },
  });
  void emailDisputeOpened(id, myId, reason);
  return NextResponse.json({ ok: true });
}
