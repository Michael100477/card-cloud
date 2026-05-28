import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const alerts = await db.ebayFeedbackAlert.findMany({
      where:   { resolvedAt: null },
      orderBy: { commentTime: "desc" },
    });
    return NextResponse.json({ alerts });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const alert = await db.ebayFeedbackAlert.update({
      where:  { id },
      data:   { resolvedAt: new Date() },
    });
    return NextResponse.json({ alert });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
