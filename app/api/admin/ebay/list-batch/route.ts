import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { publishListingsBatch, type BatchListingRef } from "@/lib/ebay-publish";

const CONCURRENCY = 5;
const MAX_BATCH   = 100;

/** Publish many listings (consignment + internal) to eBay at once.
 *  Up to CONCURRENCY publish in parallel. Failures don't stop the batch;
 *  each ref gets its own result entry. */
export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const body = await req.json();
  const refs: BatchListingRef[] = Array.isArray(body.refs) ? body.refs : [];
  if (refs.length === 0) {
    return NextResponse.json({ error: "refs array required" }, { status: 400 });
  }
  if (refs.length > MAX_BATCH) {
    return NextResponse.json({ error: `Batch capped at ${MAX_BATCH} listings` }, { status: 400 });
  }
  for (const r of refs) {
    if (!r.id || (r.kind !== "consignment" && r.kind !== "internal")) {
      return NextResponse.json({ error: "Each ref needs { kind: 'consignment'|'internal', id }" }, { status: 400 });
    }
  }

  const results = await publishListingsBatch(refs, CONCURRENCY);

  const okCount   = results.filter(r => r.ok).length;
  const failCount = results.length - okCount;
  return NextResponse.json({ ok: true, results, okCount, failCount });
}
