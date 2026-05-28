import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { WIDGET_REGISTRY } from "@/lib/layout";

// GET /api/admin/layout?page=dashboard
export async function GET(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const page = new URL(req.url).searchParams.get("page") ?? "dashboard";
  const rows = await db.pageLayout.findMany({ where: { page }, orderBy: { order: "asc" } });
  return NextResponse.json(rows.map(r => ({
    ...r,
    label:       WIDGET_REGISTRY[r.widgetKey]?.label       ?? r.widgetKey,
    description: WIDGET_REGISTRY[r.widgetKey]?.description ?? "",
  })));
}

// POST — upsert a widget's order or enabled state
export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { page, widgetKey, order, enabled } = await req.json();
  if (!page || !widgetKey) return NextResponse.json({ error: "page and widgetKey required" }, { status: 400 });

  const row = await db.pageLayout.upsert({
    where:  { page_widgetKey: { page, widgetKey } },
    update: { ...(order   !== undefined && { order }),
              ...(enabled !== undefined && { enabled }) },
    create: { page, widgetKey, order: order ?? 0, enabled: enabled !== false },
  });
  return NextResponse.json(row);
}

// POST /api/admin/layout/reorder — batch reorder
export async function PUT(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { page, widgets } = await req.json() as { page: string; widgets: { id: string; order: number }[] };
  await Promise.all(widgets.map(w => db.pageLayout.update({ where: { id: w.id }, data: { order: w.order } })));
  return NextResponse.json({ ok: true });
}
