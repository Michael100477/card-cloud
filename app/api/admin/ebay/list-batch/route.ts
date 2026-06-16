import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { publishListingsBatch, type BatchListingRef } from "@/lib/ebay-publish";
import { logger } from "@/lib/logger";

const CONCURRENCY = 5;
const MAX_BATCH   = 100;

/** Fire-and-forget batch publish. Kicks off the work in the background,
 *  returns 202 immediately. Each individual publishListing call writes its
 *  result (status, url, lastError, etc.) to the DB on completion, so the
 *  source of truth is the listing rows themselves — clients see updated
 *  state on their next page load. Anyone who needs progress can refresh
 *  /admin/listings; failures stay visible as 'pending' rows with the
 *  lastError populated. */
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

  // Kick off the publishes WITHOUT awaiting. Node keeps the promise alive
  // until it resolves; each publishListing writes its own DB row on
  // completion. Errors are isolated per-ref inside publishListingsBatch.
  publishListingsBatch(refs, CONCURRENCY)
    .then(results => {
      const okCount   = results.filter(r => r.ok).length;
      const failCount = results.length - okCount;
      logger.info({
        category: "ebay", action: "ebay.batch.completed",
        message:  `Batch publish finished — ${okCount} succeeded, ${failCount} failed of ${results.length}`,
        data:     { okCount, failCount, total: results.length },
      });
    })
    .catch(e => {
      console.error("[list-batch] unexpected error:", e);
      logger.error({
        category: "ebay", action: "ebay.batch.error",
        message:  `Batch publish crashed: ${e instanceof Error ? e.message : String(e)}`,
      });
    });

  return NextResponse.json({
    ok:        true,
    started:   refs.length,
    message:   `Started ${refs.length} listing${refs.length !== 1 ? "s" : ""}. They'll appear as 'active' in their tab as each one finishes (~25 s per listing, up to ${CONCURRENCY} in parallel).`,
  }, { status: 202 });
}
