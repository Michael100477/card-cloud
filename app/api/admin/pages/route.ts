import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET() {
  // Public — used by ContentClient to populate CTA URL dropdowns
  const pages = await db.sitePage.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });
  return NextResponse.json(pages);
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { path, label, order } = await req.json();
  if (!path?.trim() || !label?.trim()) {
    return NextResponse.json({ error: "path and label required" }, { status: 400 });
  }
  try {
    const page = await db.sitePage.create({
      data: { path: path.trim(), label: label.trim(), order: order ?? 0 },
    });
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "A page with that path already exists" }, { status: 409 });
  }
}
