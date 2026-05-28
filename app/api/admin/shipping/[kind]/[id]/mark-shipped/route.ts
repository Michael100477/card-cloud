import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { kind, id } = await params;
  const data = { status: "shipped", shippedAt: new Date() };
  if (kind === "internal")           await db.internalListing.update({ where: { id }, data });
  else if (kind === "consignment")   await db.ebayListing.update({ where: { id }, data });
  else return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
