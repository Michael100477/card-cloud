import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assertCardsAreUnlocked } from "@/lib/trades";
import { emailCounterOffer } from "@/lib/trade-emails";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = session.user.id;
  const { id } = await params;

  const body = await req.json();
  const { mySideCardIds, theirSideCardIds, message } = body as {
    mySideCardIds:    string[];
    theirSideCardIds: string[];
    message?: string | null;
  };
  if (!Array.isArray(mySideCardIds) || !Array.isArray(theirSideCardIds) || mySideCardIds.length === 0 || theirSideCardIds.length === 0) {
    return NextResponse.json({ error: "mySideCardIds and theirSideCardIds required" }, { status: 400 });
  }

  const trade = await db.trade.findUnique({
    where: { id },
    select: { initiatorId: true, targetId: true, status: true, currentRevisionId: true },
  });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trade.initiatorId !== myId && trade.targetId !== myId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!["proposed", "counter"].includes(trade.status)) {
    return NextResponse.json({ error: `Cannot counter in status "${trade.status}"` }, { status: 400 });
  }

  // I can only counter if the ball is in MY court (the other side proposed the current revision)
  const current = await db.tradeRevision.findUnique({ where: { id: trade.currentRevisionId ?? "_" }, select: { proposedById: true } });
  if (!current) return NextResponse.json({ error: "No current revision" }, { status: 400 });
  if (current.proposedById === myId) {
    return NextResponse.json({ error: "You proposed the current offer — wait for them to respond." }, { status: 400 });
  }

  const iAmInitiator = trade.initiatorId === myId;
  const mySide       = iAmInitiator ? "initiator" : "target";
  const theirSide    = iAmInitiator ? "target"    : "initiator";
  const theirOwnerId = iAmInitiator ? trade.targetId : trade.initiatorId;

  // Verify mySideCards: mine, tradeable
  const mineDb = await db.card.findMany({
    where: { id: { in: mySideCardIds }, ownerId: myId },
    select: { id: true, isTradeable: true },
  });
  if (mineDb.length !== mySideCardIds.length) {
    return NextResponse.json({ error: "One or more of your cards do not exist or you do not own them" }, { status: 400 });
  }
  if (mineDb.some(c => !c.isTradeable)) {
    return NextResponse.json({ error: "All of your offered cards must be marked as tradeable" }, { status: 400 });
  }

  // Verify theirSideCards: belong to the counterparty AND were in the previous revision
  // (you can only counter using cards they already put on the table)
  const theirDb = await db.card.findMany({
    where: { id: { in: theirSideCardIds }, ownerId: theirOwnerId },
    select: { id: true },
  });
  if (theirDb.length !== theirSideCardIds.length) {
    return NextResponse.json({ error: "One or more requested cards aren't owned by the counterparty" }, { status: 400 });
  }
  const priorOnTheirSide = await db.tradeRevisionCard.findMany({
    where: { revisionId: trade.currentRevisionId!, side: theirSide },
    select: { cardId: true },
  });
  const priorTheirIds = new Set(priorOnTheirSide.map(c => c.cardId));
  if (!theirSideCardIds.every(id => priorTheirIds.has(id))) {
    return NextResponse.json({ error: "You can only request cards that were already on the table from their side." }, { status: 400 });
  }

  // Lock check: my new cards (and target's prior cards) must not be in OTHER open trades
  try { await assertCardsAreUnlocked(mySideCardIds); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }

  // Create the new revision
  await db.$transaction(async tx => {
    const rev = await tx.tradeRevision.create({
      data: {
        tradeId:      id,
        proposedById: myId,
        message:      message ?? null,
        cards: {
          create: [
            ...mySideCardIds.map(cid    => ({ cardId: cid, side: mySide })),
            ...theirSideCardIds.map(cid => ({ cardId: cid, side: theirSide })),
          ],
        },
      },
    });
    await tx.trade.update({
      where: { id },
      data:  { currentRevisionId: rev.id, status: "counter" },
    });
  });

  void emailCounterOffer(id);
  return NextResponse.json({ ok: true });
}
