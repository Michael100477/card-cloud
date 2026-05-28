import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = session.user.id;
  const { id } = await params;

  const trade = await db.trade.findUnique({ where: { id }, select: { initiatorId: true, targetId: true, status: true, currentRevisionId: true } });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trade.initiatorId !== myId && trade.targetId !== myId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!["proposed", "counter"].includes(trade.status)) {
    return NextResponse.json({ error: `Cannot cancel in status "${trade.status}"` }, { status: 400 });
  }
  const current = await db.tradeRevision.findUnique({ where: { id: trade.currentRevisionId ?? "_" }, select: { proposedById: true } });
  if (current?.proposedById !== myId) {
    return NextResponse.json({ error: "You can only cancel a proposal you made. To reject, use Decline." }, { status: 400 });
  }

  await db.trade.update({ where: { id }, data: { status: "cancelled" } });
  return NextResponse.json({ ok: true });
}
