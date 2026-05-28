import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { slugify, uniqueSlug } from "@/lib/articles";

export async function GET() {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const articles = await db.article.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, excerpt: true, category: true, status: true, source: true, publishedAt: true, createdAt: true, coverImage: true },
  });
  return NextResponse.json(articles);
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const body = await req.json();
  const { title, content, excerpt, coverImage, category, status } = body;
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "title and content required" }, { status: 400 });
  }
  const baseSlug = slugify(title);
  const slug     = await uniqueSlug(baseSlug, db);
  const publish  = status === "published" ? "published" : "draft";

  const article = await db.article.create({
    data: {
      title: title.trim(), slug, content: content.trim(),
      excerpt: excerpt?.trim() ?? null, coverImage: coverImage ?? null,
      category: category ?? null, status: publish, source: "manual",
      publishedAt: publish === "published" ? new Date() : null,
    },
  });
  return NextResponse.json(article, { status: 201 });
}
