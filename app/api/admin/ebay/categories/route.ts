import { NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { getAppAccessToken, getEbayConnectionStatus } from "@/lib/ebay-auth";
import { db } from "@/lib/db";

// Two top-level eBay parent categories that cover everything we care about:
// 64482 = Sports Mem, Cards & Fan Shop (cards, autographed jerseys, game-used, etc.)
// 1     = Collectibles (includes a separate Autographs > Sports subtree that many
//         sports autograph sellers actually use, distinct from Sports Mem > Autographs)
const SPORTS_MEM_CATEGORY = "64482";
const COLLECTIBLES_CATEGORY = "1";

async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}

export async function GET() {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const status = await getEbayConnectionStatus();
  if (!status.connected) {
    return NextResponse.json({ error: "eBay account not connected" }, { status: 400 });
  }

  let token: string;
  try { token = await getAppAccessToken(); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }

  const env = await getCred("ebay_environment");
  const isSandbox = env === "sandbox";
  const base = isSandbox
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";

  type Node = {
    category: { categoryId: string; categoryName: string; leafCategoryTreeNode?: boolean };
    childCategoryTreeNodes?: Node[];
  };

  async function fetchSubtree(catId: string): Promise<Node | null> {
    const r = await fetch(
      `${base}/commerce/taxonomy/v1/category_tree/0/get_category_subtree?category_id=${catId}`,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    return (d?.categorySubtreeNode as Node) ?? null;
  }

  // Walk the tree depth-first, collecting LEAF categories with breadcrumb labels.
  // Only leaves (categories with no children) can actually accept a listing on eBay.
  // For Collectibles (id=1) we narrow to the Autographs subtree since the full tree is
  // huge and unrelated to sports memorabilia.
  function collectLeaves(node: Node | null, includeFirstLevel: boolean): { label: string; id: string }[] {
    const out: { label: string; id: string }[] = [];
    function walk(n: Node, breadcrumb: string[]) {
      const path = [...breadcrumb, n.category.categoryName];
      const kids = n.childCategoryTreeNodes;
      if (!kids || kids.length === 0) {
        const label = (includeFirstLevel ? path : path.slice(1)).join(" > ");
        out.push({ label, id: n.category.categoryId });
        return;
      }
      for (const child of kids) walk(child, path);
    }
    if (!node) return out;
    if (node.childCategoryTreeNodes) {
      for (const child of node.childCategoryTreeNodes) walk(child, []);
    }
    return out;
  }

  // Fetch Sports Mem & Collectibles subtrees in parallel.
  const [sportsMemRoot, collectiblesRoot] = await Promise.all([
    fetchSubtree(SPORTS_MEM_CATEGORY),
    fetchSubtree(COLLECTIBLES_CATEGORY),
  ]);

  const sportsMemLeaves = collectLeaves(sportsMemRoot, false);

  // From Collectibles, keep only the Autographs subtree (the rest is unrelated —
  // coins, comics, vintage toys, etc.) and prefix labels with "Collectibles >".
  const collectiblesAutographs = collectiblesRoot?.childCategoryTreeNodes?.find(
    n => /^Autographs/i.test(n.category.categoryName)
  ) ?? null;
  const collectiblesLeaves = collectLeaves(
    collectiblesAutographs ? { category: collectiblesRoot!.category, childCategoryTreeNodes: [collectiblesAutographs] } : null,
    true,
  );

  const children = [...sportsMemLeaves, ...collectiblesLeaves];
  children.sort((a, b) => a.label.localeCompare(b.label));

  if (children.length === 0) {
    return NextResponse.json({ error: "Could not load any categories from eBay" }, { status: 502 });
  }

  return NextResponse.json({ categories: children });
}
