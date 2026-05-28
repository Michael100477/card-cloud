import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getAccessToken, getEbayConnectionStatus } from "@/lib/ebay-auth";

async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}

function ek(base: string, isSandbox: boolean): string {
  return isSandbox ? base : `${base}_prod`;
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const { listingDbId } = await req.json();
  if (!listingDbId) return NextResponse.json({ error: "listingDbId required" }, { status: 400 });

  const listing = await db.internalListing.findUnique({ where: { id: listingDbId } });
  if (!listing)                    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.status !== "active") return NextResponse.json({ error: "Listing is not active" }, { status: 400 });
  if (!listing.ebayListingId)      return NextResponse.json({ error: "No eBay listing ID on record" }, { status: 400 });

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
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${listing.ebayListingId}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>`;

  const r = await fetch(`${apiBase}/ws/api.dll`, {
    method: "POST",
    headers: {
      "X-EBAY-API-CALL-NAME":           "EndItem",
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
                ?? "Unknown error";
    logger.error({ category: "ebay", action: "ebay.end-internal.failed", message: `EndItem failed: ${errMsg}`, data: { ack, itemId: listing.ebayListingId, response: text.slice(0, 500) }, targetId: listingDbId, targetType: "internal-listing" });
    return NextResponse.json({ error: `eBay EndItem failed: ${errMsg}` }, { status: 500 });
  }

  await db.internalListing.update({
    where: { id: listingDbId },
    data:  { status: "ended", url: null, ebayListingId: null },
  });

  logger.info({ category: "ebay", action: "ebay.internal-listing.ended", message: `Internal listing ended: ${listing.player}`, targetId: listingDbId, targetType: "internal-listing" });
  return NextResponse.json({ ok: true });
}
