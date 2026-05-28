import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assertCardsAreUnlocked } from "@/lib/trades";
import { emailProposalCreated } from "@/lib/trade-emails";

// POST /api/trades — create a new trade proposal
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = session.user.id;

  const body = await req.json();
  const { targetCardId, offeredCardIds, message } = body as {
    targetCardId: string;
    offeredCardIds: string[];
    message?: string | null;
  };

  if (!targetCardId || !Array.isArray(offeredCardIds) || offeredCardIds.length === 0) {
    return NextResponse.json({ error: "targetCardId and offeredCardIds[] required" }, { status: 400 });
  }

  // Target must exist, be tradeable, and not owned by me
  const target = await db.card.findUnique({
    where: { id: targetCardId },
    select: { id: true, ownerId: true, isTradeable: true },
  });
  if (!target)                       return NextResponse.json({ error: "Target card not found" },           { status: 404 });
  if (target.ownerId === myId)       return NextResponse.json({ error: "Cannot trade with yourself" },      { status: 400 });
  if (!target.isTradeable)           return NextResponse.json({ error: "Target card is not tradeable" },    { status: 400 });

  // All offered cards must be mine and marked tradeable
  const mine = await db.card.findMany({
    where: { id: { in: offeredCardIds }, ownerId: myId },
    select: { id: true, isTradeable: true },
  });
  if (mine.length !== offeredCardIds.length) {
    return NextResponse.json({ error: "One or more offered cards do not exist or you do not own them" }, { status: 400 });
  }
  if (mine.some(c => !c.isTradeable)) {
    return NextResponse.json({ error: "All offered cards must be marked as tradeable" }, { status: 400 });
  }

  // Lock check — none of the involved cards (target + offers) can already be in another open trade
  try {
    await assertCardsAreUnlocked([targetCardId, ...offeredCardIds]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  // Create the trade + first revision in a single transaction
  const trade = await db.$transaction(async tx => {
    const t = await tx.trade.create({
      data: {
        initiatorId: myId,
        targetId:    target.ownerId,
        status:      "proposed",
      },
    });
    const rev = await tx.tradeRevision.create({
      data: {
        tradeId:      t.id,
        proposedById: myId,
        message:      message ?? null,
        cards: {
          create: [
            { cardId: target.id, side: "target" },
            ...offeredCardIds.map(id => ({ cardId: id, side: "initiator" as const })),
          ],
        },
      },
    });
    await tx.trade.update({ where: { id: t.id }, data: { currentRevisionId: rev.id } });
    return t;
  });

  // Fire-and-forget notification
  void emailProposalCreated(trade.id);

  return NextResponse.json({ ok: true, tradeId: trade.id });
}
