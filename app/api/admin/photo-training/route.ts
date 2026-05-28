import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit    = parseInt(searchParams.get("limit") || "50");
  const category = searchParams.get("category") || undefined;

  const samples = await db.photoTrainingSample.findMany({
    where:   category ? { category } : undefined,
    orderBy: { createdAt: "desc" },
    take:    limit,
    select:  { id: true, beforeThumb: true, afterThumb: true, cx: true, cy: true, category: true, description: true, sourcePath: true, createdAt: true },
  });

  return NextResponse.json({ samples });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "No id" }, { status: 400 });
  await db.photoTrainingSample.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
