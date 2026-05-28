import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = session.user.id;
  const { id } = await params;
  const body = await req.json();
  const tracking = String(body.tracking ?? "").trim();
  if (!tracking) return NextResponse.json({ error: "tracking required" }, { status: 400 });

  const trade = await db.trade.findUnique({
    where: { id },
    select: { initiatorId: true, targetId: true, status: true,
      initiatorInboundTracking: true, targetInboundTracking: true },
  });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trade.initiatorId !== myId && trade.targetId !== myId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!["accepted", "inbound"].includes(trade.status)) {
    return NextResponse.json({ error: `Cannot add inbound tracking in status "${trade.status}"` }, { status: 400 });
  }

  const iAmInitiator = trade.initiatorId === myId;
  const data = iAmInitiator
    ? { initiatorInboundTracking: tracking }
    : { targetInboundTracking:    tracking };

  // If first inbound tracking on this trade, also flip status from accepted → inbound
  const newStatus = trade.status === "accepted" ? "inbound" : trade.status;
  await db.trade.update({ where: { id }, data: { ...data, status: newStatus } });
  return NextResponse.json({ ok: true });
}
