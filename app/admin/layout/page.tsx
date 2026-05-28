import { db } from "@/lib/db";
import { WIDGET_REGISTRY, seedPageLayout } from "@/lib/layout";
import { LayoutClient } from "./LayoutClient";

const PAGES = ["dashboard", "explore", "landing", "ebay_listing"] as const;

export default async function AdminLayoutPage() {
  // Seed defaults for all pages
  await Promise.all(PAGES.map(p => seedPageLayout(p)));

  const allRows = await db.pageLayout.findMany({ orderBy: [{ page: "asc" }, { order: "asc" }] });

  const byPage: Record<string, typeof allRows> = {};
  for (const p of PAGES) byPage[p] = allRows.filter(r => r.page === p);

  return (
    <LayoutClient
      pages={PAGES as unknown as string[]}
      initialLayouts={byPage}
      registry={WIDGET_REGISTRY}
    />
  );
}
