import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  try {
    const thread = await db.emailThread.findUnique({
      where: { id },
      include: { messages: { orderBy: { sentAt: "asc" } } },
    });
    if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(thread);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
