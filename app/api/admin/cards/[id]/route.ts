import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const { isFeatured, isPublic } = await req.json();

  const card = await db.card.update({
    where:  { id },
    data:   { ...(isFeatured !== undefined && { isFeatured }), ...(isPublic !== undefined && { isPublic }) },
    select: { id: true, isFeatured: true, isPublic: true },
  });
  return NextResponse.json(card);
}
