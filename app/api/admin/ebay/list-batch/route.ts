import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { publishListingsBatch } from "@/lib/ebay-publish";

const CONCURRENCY = 5;
const MAX_BATCH   = 100;

/** Publish many listings to eBay at once. Runs up to CONCURRENCY in parallel,
 *  walks through the queue in waves. Failures don't stop the batch —
 *  every listingDbId gets its own result entry. */
export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const { listingDbIds } = await req.json();
  if (!Array.isArray(listingDbIds) || listingDbIds.length === 0) {
    return NextResponse.json({ error: "listingDbIds array required" }, { status: 400 });
  }
  if (listingDbIds.length > MAX_BATCH) {
    return NextResponse.json({ error: `Batch capped at ${MAX_BATCH} listings` }, { status: 400 });
  }

  const results = await publishListingsBatch(listingDbIds, CONCURRENCY);

  const okCount   = results.filter(r => r.ok).length;
  const failCount = results.length - okCount;
  return NextResponse.json({ ok: true, results, okCount, failCount });
}
