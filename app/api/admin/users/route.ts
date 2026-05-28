import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const users = await db.user.findMany({
    where: q ? {
      OR: [
        { email:       { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { username:    { contains: q, mode: "insensitive" } },
      ],
    } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, email: true, displayName: true, username: true,
      planTier: true, isAdmin: true, isFeatured: true, suspended: true, suspendedReason: true, createdAt: true,
      _count: {
        select: {
          cards: true,
          collections: true,
          followers: true,               // UserFollow.followingId
          comments: true,
        },
      },
    },
  });

  // Compute recent cards added (last 30 days) per user in one query
  const recentCardCounts = await db.card.groupBy({
    by: ["ownerId"],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: { id: true },
  });
  const recentMap = new Map(recentCardCounts.map(r => [r.ownerId, r._count.id]));

  // Watches received per user — raw SQL for efficiency
  const watchPerUser = await db.$queryRaw<{ ownerId: string; cnt: bigint }[]>`
    SELECT c."ownerId", COUNT(cw."userId") as cnt
    FROM card_watches cw
    JOIN cards c ON cw."cardId" = c.id
    WHERE c."ownerId" = ANY(${users.map(u => u.id)})
    GROUP BY c."ownerId"
  `;
  const watchMap = new Map(watchPerUser.map(r => [r.ownerId, Number(r.cnt)]));

  const result = users.map(u => {
    const recentCards = recentMap.get(u.id) ?? 0;
    const watches     = watchMap.get(u.id)  ?? 0;
    const followers   = u._count.followers  ?? 0;
    const comments    = u._count.comments   ?? 0;

    const engagementScore = (recentCards * 5) + (watches * 3) + (comments * 2) + (followers * 3) + (u._count.cards * 1);

    return {
      id:              u.id,
      email:           u.email,
      displayName:     u.displayName,
      username:        u.username,
      planTier:        u.planTier,
      isAdmin:         u.isAdmin,
      isFeatured:      u.isFeatured,
      createdAt:       u.createdAt.toISOString(),
      cardCount:       u._count.cards,
      collectionCount: u._count.collections,
      followerCount:   followers,
      recentCards,
      watches,
      engagementScore,
      suspended:       u.suspended,
      suspendedReason: u.suspendedReason,
    };
  });

  return NextResponse.json(result);
}
