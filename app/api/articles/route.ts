/**
 * Public article API — for AI agents and external tools to submit articles.
 * Authenticate with: Authorization: Bearer <article_api_key>
 * Set the key in Admin → API Keys → article_api_key
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slugify, uniqueSlug } from "@/lib/articles";

async function authenticate(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  const stored = await db.siteCredential.findUnique({ where: { service: "article_api_key" } });
  return !!stored?.value && stored.value === token;
}

// GET — list published articles (public)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit    = parseInt(searchParams.get("limit") ?? "10");
  const category = searchParams.get("category");

  const articles = await db.article.findMany({
    where: {
      status: "published",
      ...(category && { category }),
    },
    orderBy: { publishedAt: "desc" },
    take:    Math.min(limit, 50),
    select: {
      id: true, title: true, slug: true, excerpt: true,
      coverImage: true, category: true, publishedAt: true, createdAt: true,
    },
  });

  return NextResponse.json(articles);
}

// POST — submit a new article (requires API key)
export async function POST(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized — set article_api_key in Admin → API Keys" }, { status: 401 });
  }

  const body = await req.json();
  const { title, content, excerpt, coverImage, category, status } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const baseSlug = slugify(title);
  const slug     = await uniqueSlug(baseSlug, db);
  const publish  = status === "published" || status === "draft" ? status : "published";

  const article = await db.article.create({
    data: {
      title:      title.trim(),
      slug,
      content:    content.trim(),
      excerpt:    excerpt?.trim() ?? null,
      coverImage: coverImage ?? null,
      category:   category ?? null,
      status:     publish,
      source:     "api",
      publishedAt: publish === "published" ? new Date() : null,
    },
  });

  return NextResponse.json({ id: article.id, slug: article.slug, status: article.status }, { status: 201 });
}
