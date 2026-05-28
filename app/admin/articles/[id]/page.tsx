import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ArticleEditor } from "./ArticleEditor";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await db.article.findUnique({ where: { id } });
  if (!article) notFound();

  return (
    <ArticleEditor
      article={{
        ...article,
        publishedAt: article.publishedAt?.toISOString() ?? null,
        createdAt:   article.createdAt.toISOString(),
        updatedAt:   article.updatedAt.toISOString(),
      }}
    />
  );
}
