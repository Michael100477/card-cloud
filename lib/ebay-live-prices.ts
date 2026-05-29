// Fetches live current-price and bid-count info for every active listing on the
// connected eBay account via a single GetMyeBaySelling call. Returns a Map keyed
// by eBay listing ID so callers can merge it into their DB rows.

import { db } from "./db";
import { getAccessToken, getEbayConnectionStatus } from "./ebay-auth";

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

export interface LivePrice {
  currentPrice: number;
  bidCount:     number;
  watchCount:   number;
  endTime:      string | null;  // ISO timestamp when eBay ends the listing
}

let cache: { at: number; data: Map<string, LivePrice> } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute — keeps page loads fast without burning eBay API calls

export async function getLivePrices(): Promise<Map<string, LivePrice>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const result = new Map<string, LivePrice>();

  const connStatus = await getEbayConnectionStatus();
  if (!connStatus.connected) return result;

  let token: string;
  try { token = await getAccessToken(); }
  catch { return result; }

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
  if (!r.ok) return result;

  const activeSection = text.match(/<ActiveList>([\s\S]*?)<\/ActiveList>/)?.[1] ?? "";
  const items = [...activeSection.matchAll(/<Item>([\s\S]*?)<\/Item>/g)].map(m => m[1]);

  for (const block of items) {
    const itemId = attr(block, "ItemID");
    if (!itemId) continue;
    const startPrice = parseFloat(attr(block, "StartPrice") ?? "0") || 0;
    const currentPrice = parseFloat(attr(block, "CurrentPrice") ?? String(startPrice)) || startPrice;
    const bidCount = parseInt(attr(block, "BidCount") ?? "0") || 0;
    const watchCount = parseInt(attr(block, "WatchCount") ?? "0") || 0;
    const endTime = attr(block, "EndTime");
    result.set(itemId, { currentPrice, bidCount, watchCount, endTime });
  }

  cache = { at: Date.now(), data: result };
  return result;
}
