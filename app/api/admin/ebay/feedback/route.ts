import { NextResponse } from "next/server";
import { getAccessToken, getAppId, getTradingApiUrl } from "@/lib/ebay-auth";

export interface EbayFeedback {
  id:             string;
  commentType:    "Positive" | "Neutral" | "Negative";
  commentText:    string;
  commentingUser: string;
  commentTime:    string;
  itemId:         string | null;
  transactionId:  string | null;
  response:       string;
  followup:       string;
}

export interface FeedbackSummary {
  positiveScore:   number;
  negativeScore:   number;
  neutralScore:    number;
  positivePercent: number;
}

// ─── XML helpers ──────────────────────────────────────────────────────────────

function xmlVal(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return "";
  return m[1]
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#13;/g, "").trim();
}

function xmlAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, "g");
  return [...xml.matchAll(re)].map(m => m[0]);
}

// ─── Fetch one page of feedback ───────────────────────────────────────────────

async function fetchPage(
  token: string,
  appId: string | null,
  tradingApiUrl: string,
  page: number,
): Promise<{ entries: EbayFeedback[]; totalPages: number }> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<GetFeedbackRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <FeedbackType>FeedbackReceivedAsSeller</FeedbackType>
  <DetailLevel>ReturnAll</DetailLevel>
  <Pagination>
    <EntriesPerPage>200</EntriesPerPage>
    <PageNumber>${page}</PageNumber>
  </Pagination>
</GetFeedbackRequest>`;

  const headers: Record<string, string> = {
    "X-EBAY-API-CALL-NAME":           "GetFeedback",
    "X-EBAY-API-SITEID":              "0",
    "X-EBAY-API-COMPATIBILITY-LEVEL": "1209",
    "Content-Type":                   "text/xml",
  };
  if (appId) headers["X-EBAY-API-APP-ID"] = appId;

  const r    = await fetch(tradingApiUrl, { method: "POST", headers, body });
  const text = await r.text();

  const ack = xmlVal(text, "Ack");
  if (ack === "Failure") throw new Error(xmlVal(text, "LongMessage") || "eBay GetFeedback error");

  const totalEntries = parseInt(xmlVal(text, "FeedbackDetailItemTotal")) || 0;
  const totalPages   = Math.ceil(totalEntries / 200) || 1;

  const entries: EbayFeedback[] = xmlAll(text, "FeedbackDetail").map(fb => ({
    id:             xmlVal(fb, "FeedbackID") || `${Date.now()}-${Math.random()}`,
    commentType:    (xmlVal(fb, "CommentType") || "Positive") as EbayFeedback["commentType"],
    commentText:    xmlVal(fb, "CommentText"),
    commentingUser: xmlVal(fb, "CommentingUser"),
    commentTime:    xmlVal(fb, "CommentTime"),
    itemId:         xmlVal(fb, "ItemID")        || null,
    transactionId:  xmlVal(fb, "TransactionID") || null,
    response:       xmlVal(fb, "Response"),
    followup:       xmlVal(fb, "Followup"),
  }));

  return { entries, totalPages };
}

// ─── Fetch the exact eBay-displayed positive feedback % via GetUser ───────────

async function fetchPositivePercent(
  token: string,
  appId: string | null,
  tradingApiUrl: string,
): Promise<number> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
</GetUserRequest>`;

  const headers: Record<string, string> = {
    "X-EBAY-API-CALL-NAME":           "GetUser",
    "X-EBAY-API-SITEID":              "0",
    "X-EBAY-API-COMPATIBILITY-LEVEL": "1209",
    "Content-Type":                   "text/xml",
  };
  if (appId) headers["X-EBAY-API-APP-ID"] = appId;

  try {
    const r    = await fetch(tradingApiUrl, { method: "POST", headers, body });
    const text = await r.text();
    const pct  = parseFloat(xmlVal(text, "PositiveFeedbackPercent"));
    return isNaN(pct) ? 100 : pct;
  } catch {
    return 100;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [token, appId, tradingApiUrl] = await Promise.all([
      getAccessToken(), getAppId(), getTradingApiUrl(),
    ]);

    // Fetch page 1 and the accurate percentage in parallel
    const [page1, positivePercent] = await Promise.all([
      fetchPage(token, appId, tradingApiUrl, 1),
      fetchPositivePercent(token, appId, tradingApiUrl),
    ]);

    // Fetch any remaining pages in parallel (cap at 20 pages = 4000 entries)
    const remaining = Math.min(page1.totalPages - 1, 19);
    const extraPages = remaining > 0
      ? await Promise.all(
          Array.from({ length: remaining }, (_, i) =>
            fetchPage(token, appId, tradingApiUrl, i + 2),
          ),
        )
      : [];

    const feedback = [
      ...page1.entries,
      ...extraPages.flatMap(p => p.entries),
    ];

    // Derive counts from the actual fetched entries (accurate + consistent with list)
    const positiveScore = feedback.filter(f => f.commentType === "Positive").length;
    const negativeScore = feedback.filter(f => f.commentType === "Negative").length;
    const neutralScore  = feedback.filter(f => f.commentType === "Neutral").length;

    const summary: FeedbackSummary = {
      positiveScore,
      negativeScore,
      neutralScore,
      positivePercent,
    };

    // Newest first
    feedback.sort((a, b) =>
      new Date(b.commentTime).getTime() - new Date(a.commentTime).getTime(),
    );

    return NextResponse.json({ feedback, summary, total: feedback.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
