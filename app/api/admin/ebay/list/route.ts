import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { publishListing } from "@/lib/ebay-publish";

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const { listingDbId } = await req.json();
  if (!listingDbId) return NextResponse.json({ error: "listingDbId required" }, { status: 400 });

  const result = await publishListing(listingDbId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, ebayListingId: result.ebayListingId, url: result.url });
}
