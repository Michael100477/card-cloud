import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const level    = searchParams.get("level")    || undefined;
  const search   = searchParams.get("q")        || undefined;
  const page     = parseInt(searchParams.get("page") ?? "1");
  const limit    = 50;

  const where: Record<string, unknown> = {};
  if (category && category !== "all") where.category  = category;
  if (level    && level    !== "all") where.level     = level;
  if (search) where.OR = [
    { message: { contains: search, mode: "insensitive" } },
    { action:  { contains: search, mode: "insensitive" } },
  ];

  const [logs, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    db.activityLog.count({ where }),
  ]);

  return NextResponse.json({
    logs: logs.map(l => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    pages: Math.ceil(total / limit),
    page,
  });
}
