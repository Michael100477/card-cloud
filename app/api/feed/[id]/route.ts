import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// PATCH — update caption
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id }      = await params;
  const { caption } = await req.json();

  const post = await db.feedPost.findUnique({ where: { id }, select: { userId: true } });
  if (!post || post.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.feedPost.update({ where: { id }, data: { caption: caption ?? null } });
  return NextResponse.json({ id: updated.id });
}

// DELETE — unshare (removes post, resets card to private)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const post   = await db.feedPost.findUnique({
    where:  { id },
    select: { userId: true, cardId: true },
  });
  if (!post || post.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.feedPost.delete({ where: { id } });

  // Reset card to private
  if (post.cardId) {
    await db.card.update({ where: { id: post.cardId }, data: { isPublic: false } });
  }

  return NextResponse.json({ ok: true });
}
