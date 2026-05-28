export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/** Ensure a slug is unique by appending -2, -3, etc. if needed */
export async function uniqueSlug(base: string, db: { article: { findUnique: (a: { where: { slug: string } }) => Promise<unknown> } }): Promise<string> {
  let slug = base;
  let n = 1;
  while (await db.article.findUnique({ where: { slug } })) {
    n++;
    slug = `${base}-${n}`;
  }
  return slug;
}
