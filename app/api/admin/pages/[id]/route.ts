import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id }    = await params;
  const { path, label, order } = await req.json();
  const page = await db.sitePage.update({
    where: { id },
    data: {
      ...(path  !== undefined && { path:  path.trim()  }),
      ...(label !== undefined && { label: label.trim() }),
      ...(order !== undefined && { order }),
    },
  });
  return NextResponse.json(page);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  await db.sitePage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
