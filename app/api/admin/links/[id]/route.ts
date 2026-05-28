import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const body    = await req.json();
  const data: Record<string, unknown> = {};
  if (body.label   !== undefined) data.label   = body.label.trim();
  if (body.href    !== undefined) data.href    = body.href.trim();
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.section !== undefined) data.section = body.section.trim();

  const link = await db.siteLink.update({ where: { id }, data });
  return NextResponse.json(link);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  await db.siteLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
