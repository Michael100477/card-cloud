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

// eBay returns time-left as an ISO 8601 duration like "P2DT9H16M29S".
// (eBay does not return <EndTime> on the active-list response — it returns
// <TimeLeft> as a duration we have to convert to an end timestamp.)
function durationToMs(iso: string | null): number | null {
  if (!iso) return null;
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, d, h, mn, s] = m;
  return ((+(d ?? 0)) * 86400 + (+(h ?? 0)) * 3600 + (+(mn ?? 0)) * 60 + (+(s ?? 0))) * 1000;
}

export interface LivePrice {
  currentPrice: number;
  bidCount:     number;
  watchCount:   number;
  endTime:      string | null;  // ISO timestamp when eBay ends the listing
}

export interface SoldInfo {
  price:         number;
  title:         string | null;
  buyerUsername: string | null;   // from <HighBidder><UserID>
  endTime:       string | null;   // ISO timestamp, used as soldAt
}

let cache: { at: number; data: Map<string, LivePrice>; sold: Map<string, SoldInfo>; ok: boolean } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute — keeps page loads fast without burning eBay API calls

/** Item IDs from eBay's SoldList → final sale price. Used by the listings
 *  page to distinguish "active → sold" from "active → ended (unsold)" and
 *  to capture the actual price the auction ended at (which our local
 *  syncOrders only writes once an order is fully created). */
export async function getSoldItemIds(): Promise<Set<string>> {
  await getLivePrices();
  return new Set(cache?.sold.keys() ?? []);
}

export async function getSoldPrices(): Promise<Map<string, number>> {
  await getLivePrices();
  const out = new Map<string, number>();
  for (const [id, info] of (cache?.sold ?? new Map<string, SoldInfo>())) out.set(id, info.price);
  return out;
}

/** Full info for SoldList items — price + title. Used to auto-create
 *  internal_listing rows for items that ended on eBay before our DB
 *  ever knew about them (direct-on-eBay listings + recently-ended
 *  auctions where eBay hasn't generated an order yet). */
export async function getSoldListings(): Promise<Map<string, SoldInfo>> {
  await getLivePrices();
  return cache?.sold ?? new Map<string, SoldInfo>();
}

/** True if the last eBay API call returned a valid response (even if both
 *  active and sold lists were empty). Use this to decide whether to run
 *  auto-demote — checking `size > 0` strands listings when the user has
 *  genuinely zero active auctions remaining. */
export async function hasFreshEbaySnapshot(): Promise<boolean> {
  await getLivePrices();
  return !!cache?.ok && Date.now() - cache.at < CACHE_TTL_MS;
}

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
  <SoldList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>200</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
    <DurationInDays>60</DurationInDays>
  </SoldList>
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
  if (!r.ok) {
    cache = { at: Date.now(), data: result, sold: new Map(), ok: false };
    return result;
  }

  const activeSection = text.match(/<ActiveList>([\s\S]*?)<\/ActiveList>/)?.[1] ?? "";
  const items = [...activeSection.matchAll(/<Item>([\s\S]*?)<\/Item>/g)].map(m => m[1]);

  for (const block of items) {
    const itemId = attr(block, "ItemID");
    if (!itemId) continue;
    const startPrice = parseFloat(attr(block, "StartPrice") ?? "0") || 0;
    const currentPrice = parseFloat(attr(block, "CurrentPrice") ?? String(startPrice)) || startPrice;
    const bidCount = parseInt(attr(block, "BidCount") ?? "0") || 0;
    const watchCount = parseInt(attr(block, "WatchCount") ?? "0") || 0;
    const timeLeftMs = durationToMs(attr(block, "TimeLeft"));
    const endTime    = timeLeftMs != null && timeLeftMs > 0
      ? new Date(Date.now() + timeLeftMs).toISOString()
      : null;
    result.set(itemId, { currentPrice, bidCount, watchCount, endTime });
  }

  // SoldList — items that ended with a buyer in the last 60 days. Map
  // each itemId to its final sale price + title so we can both (a) patch
  // existing DB rows when promoting active → sold and (b) auto-create
  // rows for items that ended on eBay before we ever saw them.
  const sold = new Map<string, SoldInfo>();
  const soldSection = text.match(/<SoldList>([\s\S]*?)<\/SoldList>/)?.[1] ?? "";
  const soldItems = [...soldSection.matchAll(/<Item>([\s\S]*?)<\/Item>/g)].map(m => m[1]);
  for (const block of soldItems) {
    const itemId = attr(block, "ItemID");
    if (!itemId) continue;
    const price = parseFloat(attr(block, "CurrentPrice") ?? attr(block, "BuyItNowPrice") ?? "0") || 0;
    const title = attr(block, "Title");
    // NOTE: eBay's GetMyeBaySelling SoldList response does NOT include
    // buyer info — confirmed by inspection of the actual XML response.
    // Buyer comes from the Orders API once eBay generates the order
    // record (after the buyer commits to checkout). Until then this stays
    // null and syncOrders fills it in later.
    const buyerUsername =
         block.match(/<HighBidder[^>]*>[\s\S]*?<UserID[^>]*>([^<]+)<\/UserID>/)?.[1]?.trim()
      ?? block.match(/<Buyer[^>]*>[\s\S]*?<UserID[^>]*>([^<]+)<\/UserID>/)?.[1]?.trim()
      ?? attr(block, "BuyerUserID")
      ?? null;
    const endTime = attr(block, "EndTime");
    sold.set(itemId, { price, title, buyerUsername, endTime });
  }

  cache = { at: Date.now(), data: result, sold, ok: true };
  return result;
}
