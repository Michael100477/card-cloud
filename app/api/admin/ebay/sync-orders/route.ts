import { NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { syncOrders } from "@/lib/ebay-orders";

export async function POST() {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const result = await syncOrders();
  return NextResponse.json({
    ok: true,
    ordersFetched: result.ordersFetched,
    rowsUpdated:   result.rowsUpdated,
  });
}
