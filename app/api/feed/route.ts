import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// POST — share a card to feed, OR create a standalone photo/text post
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId, caption, photos } = await req.json();

  // ── Standalone post (no card) ──────────────────────────────────────────────
  if (!cardId) {
    if (!caption?.trim() && (!photos || photos.length === 0)) {
      return NextResponse.json({ error: "Post must have a caption or at least one photo" }, { status: 400 });
    }
    const post = await db.feedPost.create({
      data: {
        userId:  session.user.id,
        caption: caption?.trim() ?? null,
        photos:  Array.isArray(photos) ? photos.slice(0, 4) : [],
      },
    });
    return NextResponse.json({ postId: post.id });
  }

  // ── Card-share post ────────────────────────────────────────────────────────
  const card = await db.card.findUnique({ where: { id: cardId }, select: { ownerId: true } });
  if (!card || card.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await db.feedPost.findFirst({ where: { userId: session.user.id, cardId } });

  const post = existing
    ? await db.feedPost.update({ where: { id: existing.id }, data: { caption: caption ?? null } })
    : await db.feedPost.create({ data: { userId: session.user.id, cardId, caption: caption ?? null } });

  await db.card.update({ where: { id: cardId }, data: { isPublic: true } });

  return NextResponse.json({ postId: post.id, shared: true });
}
