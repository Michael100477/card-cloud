import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// POST — toggle watch on a card (anyone can watch any card, own or others')
// body: { cardId, priceAtWatch?: number | null }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to watch cards" }, { status: 401 });
  }

  const { cardId, priceAtWatch } = await req.json();
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  const card = await db.card.findUnique({
    where: { id: cardId },
    select: { ownerId: true, isPublic: true },
  });
  if (!card || (!card.isPublic && card.ownerId !== session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = { userId: session.user.id, cardId };
  const existing = await db.cardWatch.findUnique({ where: { userId_cardId: key } });

  if (existing) {
    await db.cardWatch.delete({ where: { userId_cardId: key } });
  } else {
    await db.cardWatch.create({
      data: {
        ...key,
        priceAtWatch: priceAtWatch != null ? priceAtWatch : null,
      },
    });
  }

  const count = await db.cardWatch.count({ where: { cardId } });
  return NextResponse.json({ watching: !existing, count });
}
