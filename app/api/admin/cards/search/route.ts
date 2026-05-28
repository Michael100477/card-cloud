import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);

  const cards = await db.card.findMany({
    where: {
      OR: [
        { player:       { contains: q, mode: "insensitive" } },
        { set:          { contains: q, mode: "insensitive" } },
        { manufacturer: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 24,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, player: true, year: true, manufacturer: true, set: true,
      grade: true, gradeCompany: true, photos: true, isPublic: true, isFeatured: true,
      owner: { select: { displayName: true, username: true, email: true } },
    },
  });

  return NextResponse.json(cards);
}
