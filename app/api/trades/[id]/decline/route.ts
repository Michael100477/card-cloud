import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { emailDeclined } from "@/lib/trade-emails";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = session.user.id;
  const { id } = await params;

  const trade = await db.trade.findUnique({ where: { id }, select: { initiatorId: true, targetId: true, status: true, currentRevisionId: true } });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trade.initiatorId !== myId && trade.targetId !== myId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!["proposed", "counter"].includes(trade.status)) {
    return NextResponse.json({ error: `Cannot decline in status "${trade.status}"` }, { status: 400 });
  }
  const current = await db.tradeRevision.findUnique({ where: { id: trade.currentRevisionId ?? "_" }, select: { proposedById: true } });
  if (current?.proposedById === myId) {
    return NextResponse.json({ error: "You proposed the current offer — use Cancel instead of Decline." }, { status: 400 });
  }

  await db.trade.update({ where: { id }, data: { status: "declined" } });
  void emailDeclined(id, myId);
  return NextResponse.json({ ok: true });
}
