import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const { verified } = await req.json();

  const example = await db.trainingExample.update({
    where:  { id },
    data:   { verified: !!verified, reviewedAt: new Date() },
    select: { id: true, verified: true },
  });
  return NextResponse.json(example);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  await db.trainingExample.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
