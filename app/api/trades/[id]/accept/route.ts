import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { emailAccepted } from "@/lib/trade-emails";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = session.user.id;
  const { id } = await params;

  const trade = await db.trade.findUnique({
    where: { id },
    include: { revisions: { where: { id: undefined }, take: 1 } }, // placeholder; refetch below
  });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trade.initiatorId !== myId && trade.targetId !== myId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!["proposed", "counter"].includes(trade.status)) {
    return NextResponse.json({ error: `Cannot accept in status "${trade.status}"` }, { status: 400 });
  }

  // Only the party who did NOT propose the current revision can accept it
  const current = await db.tradeRevision.findUnique({
    where: { id: trade.currentRevisionId ?? "_" },
    select: { proposedById: true },
  });
  if (!current) return NextResponse.json({ error: "No current revision" }, { status: 400 });
  if (current.proposedById === myId) {
    return NextResponse.json({ error: "You proposed the current offer — wait for the other side to respond." }, { status: 400 });
  }

  await db.trade.update({ where: { id }, data: { status: "accepted" } });
  void emailAccepted(id);
  return NextResponse.json({ ok: true });
}
