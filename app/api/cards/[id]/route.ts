import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// PATCH — update card fields the owner can control from the detail page
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const card = await db.card.findUnique({ where: { id }, select: { ownerId: true } });
  if (!card || card.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.isPublic    !== undefined) data.isPublic    = body.isPublic;
  if (body.isTradeable !== undefined) data.isTradeable = body.isTradeable;

  // Don't allow un-marking-tradeable while the card is part of an open trade — the
  // counterparty has already factored it into their offer.
  if (body.isTradeable === false) {
    const inOpenTrade = await db.tradeRevisionCard.findFirst({
      where: {
        cardId: id,
        revision: {
          trade: {
            status: { notIn: ["declined", "cancelled", "complete"] },
            currentRevisionId: { not: null },
          },
        },
      },
      select: { revisionId: true },
    });
    if (inOpenTrade) {
      return NextResponse.json({
        error: "Card is part of an open trade. Cancel or complete that trade first.",
      }, { status: 400 });
    }
  }

  const updated = await db.card.update({
    where:  { id },
    data,
    select: { id: true, isPublic: true, isTradeable: true },
  });

  return NextResponse.json(updated);
}
