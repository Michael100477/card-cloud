import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// POST — toggle follow on a user or collection
// body: { type: "user" | "collection", targetId }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to follow" }, { status: 401 });
  }

  const { type, targetId } = await req.json();
  if (!type || !targetId) {
    return NextResponse.json({ error: "type and targetId required" }, { status: 400 });
  }

  if (type === "user") {
    if (targetId === session.user.id) {
      return NextResponse.json({ error: "You can't follow yourself" }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const key = { followerId: session.user.id, followingId: targetId };
    const existing = await db.userFollow.findUnique({ where: { followerId_followingId: key } });

    if (existing) {
      await db.userFollow.delete({ where: { followerId_followingId: key } });
    } else {
      await db.userFollow.create({ data: key });
    }

    const count = await db.userFollow.count({ where: { followingId: targetId } });
    return NextResponse.json({ following: !existing, count });
  }

  if (type === "collection") {
    const collection = await db.collection.findUnique({
      where: { id: targetId },
      select: { ownerId: true, isPublic: true },
    });
    if (!collection || (!collection.isPublic && collection.ownerId !== session.user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (collection.ownerId === session.user.id) {
      return NextResponse.json({ error: "You can't follow your own collection" }, { status: 400 });
    }

    const key = { userId: session.user.id, collectionId: targetId };
    const existing = await db.collectionFollow.findUnique({ where: { userId_collectionId: key } });

    if (existing) {
      await db.collectionFollow.delete({ where: { userId_collectionId: key } });
    } else {
      await db.collectionFollow.create({ data: key });
    }

    const count = await db.collectionFollow.count({ where: { collectionId: targetId } });
    return NextResponse.json({ following: !existing, count });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
