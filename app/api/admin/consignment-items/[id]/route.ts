import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const { id } = await params;
  const { status, checkInNotes } = await req.json();

  const allowed = ["received", "missing", "returned", "pending"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const item = await db.consignmentItem.update({
    where: { id },
    data: {
      status,
      ...(checkInNotes !== undefined && { notes: checkInNotes }),
    },
    select: { id: true, status: true, orderId: true },
  });

  // If all items in the order are no longer pending, bump order to in_progress
  const order = await db.consignmentOrder.findUnique({
    where:   { id: item.orderId },
    include: { items: { select: { status: true } } },
  });
  if (order && order.status === "received") {
    const allCheckedIn = order.items.every(i => i.status !== "pending");
    if (allCheckedIn) {
      await db.consignmentOrder.update({
        where: { id: item.orderId },
        data:  { status: "in_progress" },
      });
    }
  }

  return NextResponse.json({ ok: true, status: item.status });
}
