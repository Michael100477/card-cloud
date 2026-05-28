import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { emailComplete } from "@/lib/trade-emails";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = session.user.id;
  const { id } = await params;

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
  if (trade.status !== "outbound") {
    return NextResponse.json({ error: `Cannot confirm receipt in status "${trade.status}"` }, { status: 400 });
  }

  const iAmInitiator = trade.initiatorId === myId;
  if (iAmInitiator && !trade.initiatorOutboundShippedAt) return NextResponse.json({ error: "Your outbound shipment hasn't gone out yet." }, { status: 400 });
  if (!iAmInitiator && !trade.targetOutboundShippedAt)   return NextResponse.json({ error: "Your outbound shipment hasn't gone out yet." }, { status: 400 });

  const now = new Date();
  const data = iAmInitiator ? { initiatorReceivedAt: now } : { targetReceivedAt: now };

  // If the OTHER side already confirmed, flip to complete
  const otherDone = iAmInitiator ? trade.targetReceivedAt : trade.initiatorReceivedAt;
  const newStatus = otherDone ? "complete" : trade.status;

  await db.trade.update({ where: { id }, data: { ...data, status: newStatus } });
  if (newStatus === "complete") void emailComplete(id);
  return NextResponse.json({ ok: true });
}
