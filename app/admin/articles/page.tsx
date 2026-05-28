import Link from "next/link";
import { db } from "@/lib/db";
import { ArticlesClient } from "./ArticlesClient";

export default async function AdminArticlesPage() {
  const articles = await db.article.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, excerpt: true, category: true, status: true, source: true, publishedAt: true, createdAt: true, coverImage: true },
  });

  const serialized = articles.map(a => ({
    ...a,
    publishedAt: a.publishedAt?.toISOString() ?? null,
    createdAt:   a.createdAt.toISOString(),
  }));

  return <ArticlesClient initialArticles={serialized} />;
}
