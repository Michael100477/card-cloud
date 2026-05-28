import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET /api/comments?cardId=xxx  OR  ?collectionId=xxx  OR  ?feedPostId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cardId       = searchParams.get("cardId");
  const collectionId = searchParams.get("collectionId");
  const feedPostId   = searchParams.get("feedPostId");

  if (!cardId && !collectionId && !feedPostId) {
    return NextResponse.json({ error: "cardId, collectionId, or feedPostId required" }, { status: 400 });
  }

  const where = cardId       ? { cardId }
              : collectionId ? { collectionId: collectionId! }
              :                { feedPostId: feedPostId! };

  const comments = await db.comment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, displayName: true, username: true, profilePhoto: true } },
    },
  });

  return NextResponse.json(comments.map(c => ({
    id:           c.id,
    body:         c.body,
    createdAt:    c.createdAt.toISOString(),
    author: {
      id:           c.author.id,
      name:         c.author.displayName ?? c.author.username ?? "Anonymous",
      profilePhoto: c.author.profilePhoto,
    },
  })));
}

// POST /api/comments  body: { cardId?, collectionId?, feedPostId?, body }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to comment" }, { status: 401 });
  }

  const { cardId, collectionId, feedPostId, body } = await req.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  }
  if (!cardId && !collectionId && !feedPostId) {
    return NextResponse.json({ error: "cardId, collectionId, or feedPostId required" }, { status: 400 });
  }

  if (cardId) {
    const card = await db.card.findUnique({ where: { id: cardId }, select: { isPublic: true, ownerId: true } });
    if (!card || (!card.isPublic && card.ownerId !== session.user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else if (collectionId) {
    const col = await db.collection.findUnique({ where: { id: collectionId }, select: { isPublic: true, ownerId: true } });
    if (!col || (!col.isPublic && col.ownerId !== session.user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else {
    const post = await db.feedPost.findUnique({ where: { id: feedPostId }, select: { id: true } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const comment = await db.comment.create({
    data: {
      authorId:     session.user.id,
      body:         body.trim(),
      cardId:       cardId       ?? null,
      collectionId: collectionId ?? null,
      feedPostId:   feedPostId   ?? null,
    },
    include: {
      author: { select: { id: true, displayName: true, username: true, profilePhoto: true } },
    },
  });

  return NextResponse.json({
    id:        comment.id,
    body:      comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id:           comment.author.id,
      name:         comment.author.displayName ?? comment.author.username ?? "Anonymous",
      profilePhoto: comment.author.profilePhoto,
    },
  });
}

// DELETE /api/comments  body: { id }  — author or target owner can delete
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  const comment = await db.comment.findUnique({
    where: { id },
    include: {
      card:       { select: { ownerId: true } },
      collection: { select: { ownerId: true } },
      feedPost:   { select: { userId: true } },
    },
  });

  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthor      = comment.authorId === session.user.id;
  const isTargetOwner = comment.card?.ownerId     === session.user.id ||
                        comment.collection?.ownerId === session.user.id ||
                        comment.feedPost?.userId    === session.user.id;

  if (!isAuthor && !isTargetOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
