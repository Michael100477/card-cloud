import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const status = new URL(req.url).searchParams.get("status");

  const orders = await db.consignmentOrder.findMany({
    where:   status ? { status } : undefined,
    orderBy: { submittedAt: "desc" },
    include: {
      user:  { select: { id: true, email: true, displayName: true, username: true } },
      items: { select: { id: true, status: true, player: true, listing: { select: { status: true } } } },
    },
  });

  return NextResponse.json(orders);
}
