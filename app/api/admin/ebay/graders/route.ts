import { NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { getAccessToken, getEbayConnectionStatus } from "@/lib/ebay-auth";
import { db } from "@/lib/db";

// Hardcoded fallback list — used when eBay API is unavailable or returns no values.
// Listed in the exact order requested. Update here if eBay adds a company before the
// API-polling path picks it up.
const FALLBACK_GRADERS = [
  "Professional Sports Authenticator (PSA)",
  "Beckett Collects Club Grading (BCCG)",
  "Becket Vintage Grading (BVG)",
  "Beckett Grading Services (BGS)",
  "Certified Sports Guaranty (CSG)",
  "Certified Guaranty Company (CGC)",
  "Sportscard Guaranty Corporation (SGC)",
  "K Sportscard Authentication (KSA)",
  "Gem Mint Authentication (GMA)",
  "International Sports Authentication (ISA)",
  "Gold Standard Grading (GSG)",
  "Platin Grading Service (PGS)",
  "Mint Grading (MINT)",
  "Technical Authentication & Grading (TAG)",
  "Rare Edition (RARE)",
  "Revolution Card Grading (RCG)",
  "Ace Grading (Ace)",
  "Card Grading Australia (CGA)",
  "Trading Card Grading (TCG)",
  "Other",
  "Automated Grading Systems (AGS)",
  "Diamond Service Grading (DSG)",
  "Majesty Grading company",
  "GRAAD",
  "Arena Club",
  "AIGrading",
];

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
    return NextResponse.json({ graders: FALLBACK_GRADERS, source: "fallback" });
  }

  try {
    const token = await getAccessToken();
    const env = await getCred("ebay_environment");
    const isSandbox = env === "sandbox";
    const base = isSandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

    // Trading Card Singles category — fetch item specifics to get "Professional Grader" values
    const r = await fetch(
      `${base}/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=261329`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!r.ok) throw new Error(`eBay API ${r.status}`);

    const data = await r.json();
    const aspects: { localizedAspectName: string; aspectValues?: { localizedValue: string }[] }[] =
      data.aspects ?? [];

    const graderAspect = aspects.find(a =>
      a.localizedAspectName?.toLowerCase().includes("professional grader") ||
      a.localizedAspectName?.toLowerCase().includes("grading company")
    );

    const apiGraders = graderAspect?.aspectValues?.map(v => v.localizedValue).filter(Boolean) ?? [];

    if (apiGraders.length > 0) {
      return NextResponse.json({ graders: apiGraders, source: "ebay" });
    }
  } catch {
    // Fall through to return the hardcoded list
  }

  return NextResponse.json({ graders: FALLBACK_GRADERS, source: "fallback" });
}
