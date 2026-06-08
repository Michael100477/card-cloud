import { NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { getAccessToken, getEbayConnectionStatus } from "@/lib/ebay-auth";
import { getQuestionCounts } from "@/lib/ebay-question-counts";

async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}

function ek(base: string, isSandbox: boolean): string {
  return isSandbox ? base : `${base}_prod`;
}

function attr(block: string, tag: string): string | null {
  return block.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`))?.[1]?.trim() ?? null;
}

// eBay returns <TimeLeft> as an ISO 8601 duration like "P2DT9H16M29S" — it
// does NOT include <EndTime> in the active-list response. Convert to an
// effective end timestamp so the UI can countdown against it.
function durationToMs(iso: string | null): number | null {
  if (!iso) return null;
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, d, h, mn, s] = m;
  return ((+(d ?? 0)) * 86400 + (+(h ?? 0)) * 3600 + (+(mn ?? 0)) * 60 + (+(s ?? 0))) * 1000;
}

export async function GET() {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const connStatus = await getEbayConnectionStatus();
  if (!connStatus.connected) return NextResponse.json({ error: "eBay account not connected" }, { status: 400 });

  let token: string;
  try { token = await getAccessToken(); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }

  const isSandbox = connStatus.environment !== "production";
  const apiBase   = isSandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  const [appId, devId, certId] = await Promise.all([
    getCred(ek("ebay_app_id", isSandbox)),
    getCred("ebay_dev_id"),
    getCred(ek("ebay_cert_id", isSandbox)),
  ]);

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>200</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </ActiveList>
  <SoldList><Include>false</Include></SoldList>
  <UnsoldList><Include>false</Include></UnsoldList>
</GetMyeBaySellingRequest>`;

  const r = await fetch(`${apiBase}/ws/api.dll`, {
    method: "POST",
    headers: {
      "X-EBAY-API-CALL-NAME":           "GetMyeBaySelling",
      "X-EBAY-API-SITEID":              "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-APP-NAME":            appId  ?? "",
      "X-EBAY-API-DEV-NAME":            devId  ?? "",
      "X-EBAY-API-CERT-NAME":           certId ?? "",
      "Content-Type":                   "text/xml;charset=utf-8",
    },
    body: xml,
  });

  const text = await r.text();
  const ack  = text.match(/<Ack>(\w+)<\/Ack>/)?.[1];
  if (ack !== "Success" && ack !== "Warning") {
    const errMsg = text.match(/<LongMessage>([^<]+)<\/LongMessage>/)?.[1]
                ?? text.match(/<ShortMessage>([^<]+)<\/ShortMessage>/)?.[1]
                ?? "Unknown eBay error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }

  // Collect eBay IDs already tracked in our DB so we can exclude them.
  // We exclude any internal_listing row whose status is past "draft" (i.e.
  // active or scheduled) — those rows ARE the listing as far as Card Cloud
  // is concerned and shouldn't double-up here. Pure unsaved drafts with an
  // ebayListingId DO still appear so the admin can re-open them.
  const [knownEbay, knownInternal] = await Promise.all([
    db.ebayListing.findMany({
      where: { ebayListingId: { not: null }, status: { in: ["active", "scheduled"] } },
      select: { ebayListingId: true },
    }),
    db.internalListing.findMany({
      where: { ebayListingId: { not: null }, status: { in: ["active", "scheduled"] } },
      select: { ebayListingId: true },
    }),
  ]);
  const knownIds = new Set([
    ...knownEbay.map(l => l.ebayListingId!),
    ...knownInternal.map(l => l.ebayListingId!),
  ]);

  // Parse <Item> blocks from the ActiveList section
  const activeSection = text.match(/<ActiveList>([\s\S]*?)<\/ActiveList>/)?.[1] ?? "";
  const items = [...activeSection.matchAll(/<Item>([\s\S]*?)<\/Item>/g)].map(m => m[1]);

  // Buyer-question counts (cached separately, doesn't block if it errors).
  const questionCounts = await getQuestionCounts();

  const listings = items.map(block => {
    const itemId     = attr(block, "ItemID");
    const startPrice = parseFloat(attr(block, "StartPrice") ?? "0");
    const binStr     = attr(block, "BuyItNowPrice");
    const binPrice   = binStr ? parseFloat(binStr) : null;
    const currentPrice = parseFloat(attr(block, "CurrentPrice") ?? String(startPrice));
    const quantitySold = parseInt(attr(block, "QuantitySold") ?? "0");
    const watchCount   = parseInt(attr(block, "WatchCount") ?? "0") || 0;
    const bidCount     = parseInt(attr(block, "BidCount")   ?? "0") || 0;
    const timeLeftMs   = durationToMs(attr(block, "TimeLeft"));
    const endTime      = timeLeftMs != null && timeLeftMs > 0
      ? new Date(Date.now() + timeLeftMs).toISOString()
      : null;
    const questionCount = itemId ? (questionCounts.get(itemId) ?? 0) : 0;
    return {
      ebayItemId:   itemId,
      title:        attr(block, "Title"),
      startPrice,
      currentPrice,
      binPrice:     binPrice && !isNaN(binPrice) ? binPrice : null,
      quantitySold,
      bidCount,
      watchCount,
      questionCount,
      startTime:    attr(block, "StartTime"),
      endTime,
      url:          attr(block, "ViewItemURL"),
    };
  }).filter(l => l.ebayItemId && !knownIds.has(l.ebayItemId));

  return NextResponse.json({ listings, environment: connStatus.environment });
}
