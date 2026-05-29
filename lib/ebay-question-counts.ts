/**
 * Fetches buyer-initiated message counts per active listing.
 *
 * Counts messages of type AskSellerQuestion + ContactEbayMember within the
 * last 30 days, grouped by ItemID. Used to show "💬 N questions" badges on
 * the admin eBay listings and consignment-detail pages.
 *
 * Returns a Map<itemId, count>. If the eBay account is not connected or
 * the API fails, returns an empty map — callers degrade gracefully.
 */

import { getAccessToken, getEbayConnectionStatus, getAppId, getTradingApiUrl } from "@/lib/ebay-auth";

let cache: { at: number; data: Map<string, number> } | null = null;
const CACHE_TTL_MS = 120_000;     // 2 minutes
const LOOKBACK_DAYS = 30;
const ENTRIES_PER_PAGE = 200;
const MAX_PAGES = 5;
const COUNTED_TYPES = new Set(["AskSellerQuestion", "ContactEbayMember"]);

function xmlAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, "g");
  return [...xml.matchAll(re)].map(m => m[0]);
}
function xmlVal(xml: string, tag: string): string {
  return xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? "";
}

export async function getQuestionCounts(): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const result = new Map<string, number>();

  const conn = await getEbayConnectionStatus();
  if (!conn.connected) return result;

  let token: string;
  try { token = await getAccessToken(); } catch { return result; }

  const [appId, tradingApiUrl] = await Promise.all([getAppId(), getTradingApiUrl()]);
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
  const now   = new Date().toISOString();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <MailMessageType>All</MailMessageType>
  <StartCreationTime>${since}</StartCreationTime>
  <EndCreationTime>${now}</EndCreationTime>
  <Pagination>
    <EntriesPerPage>${ENTRIES_PER_PAGE}</EntriesPerPage>
    <PageNumber>${page}</PageNumber>
  </Pagination>
</GetMemberMessagesRequest>`;

    const headers: Record<string, string> = {
      "X-EBAY-API-CALL-NAME":           "GetMemberMessages",
      "X-EBAY-API-SITEID":              "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1209",
      "Content-Type":                   "text/xml",
    };
    if (appId) headers["X-EBAY-API-APP-ID"] = appId;

    let text: string;
    try {
      const r = await fetch(tradingApiUrl, { method: "POST", headers, body: xml });
      if (!r.ok) break;
      text = await r.text();
    } catch { break; }

    const messages = xmlAll(text, "MemberMessageExchange");
    for (const m of messages) {
      const itemId = xmlVal(m, "ItemID");
      const type   = xmlVal(m, "MessageType");
      if (!itemId || !COUNTED_TYPES.has(type)) continue;
      result.set(itemId, (result.get(itemId) ?? 0) + 1);
    }

    if (messages.length < ENTRIES_PER_PAGE) break;  // last page
  }

  cache = { at: Date.now(), data: result };
  return result;
}
