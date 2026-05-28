import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  await db.ebayListing.update({
    where: { id },
    data: { status: "paid", paidAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
