import { db } from "@/lib/db";
import { seedLinks, SECTION_ORDER } from "@/lib/links";
import { LinksClient } from "./LinksClient";

export default async function AdminLinksPage() {
  await seedLinks();
  const links = await db.siteLink.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });
  const sitePages = await db.sitePage.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });

  return (
    <LinksClient
      initialLinks={links}
      sitePages={sitePages.map(p => ({ id: p.id, path: p.path, label: p.label }))}
      sectionOrder={SECTION_ORDER}
    />
  );
}
