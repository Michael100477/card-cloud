import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { SECTION_ORDER } from "@/lib/links";

export async function GET() {
  const links = await db.siteLink.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { key, section, label, href, enabled, order } = await req.json();
  if (!key?.trim() || !section?.trim() || !label?.trim() || !href?.trim()) {
    return NextResponse.json({ error: "key, section, label and href are required" }, { status: 400 });
  }
  try {
    const sectionOrder = SECTION_ORDER.indexOf(section);
    const link = await db.siteLink.create({
      data: {
        key:     key.trim(),
        section: section.trim(),
        label:   label.trim(),
        href:    href.trim(),
        enabled: enabled !== false,
        order:   order ?? (sectionOrder >= 0 ? sectionOrder * 100 : 999),
      },
    });
    return NextResponse.json(link);
  } catch {
    return NextResponse.json({ error: "A link with that key already exists" }, { status: 409 });
  }
}
