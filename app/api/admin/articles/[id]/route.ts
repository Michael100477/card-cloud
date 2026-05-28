import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const article = await db.article.findUnique({ where: { id } });
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(article);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.title       !== undefined) data.title       = body.title.trim();
  if (body.content     !== undefined) data.content     = body.content.trim();
  if (body.excerpt     !== undefined) data.excerpt     = body.excerpt?.trim() ?? null;
  if (body.coverImage  !== undefined) data.coverImage  = body.coverImage ?? null;
  if (body.category    !== undefined) data.category    = body.category ?? null;
  if (body.status      !== undefined) {
    data.status = body.status;
    if (body.status === "published") data.publishedAt = new Date();
    if (body.status === "draft")     data.publishedAt = null;
  }
  const article = await db.article.update({ where: { id }, data });
  return NextResponse.json(article);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  await db.article.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
