/**
 * POST /api/admin/ebay/feedback/monitor
 *
 * Called by card-cloud-ai every 15 minutes.
 * Fetches eBay feedback received since the last check and immediately alerts
 * mikeahayward@hotmail.com if any Neutral or Negative feedback is found.
 * Claude analyzes each entry and suggests a professional public response.
 *
 * Last-check timestamp stored in SiteCredential as "ebay_feedback_last_check".
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getAppId, getTradingApiUrl } from "@/lib/ebay-auth";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const ALERT_EMAIL     = "mikeahayward@hotmail.com";
const ALERT_SMS_EMAIL = "8604812787@vtext.com"; // Verizon email-to-SMS gateway
const MODEL           = "claude-haiku-4-5-20251001";

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

// ─── Fetch feedback since a timestamp ─────────────────────────────────────────

interface FeedbackEntry {
  id:             string;
  commentType:    "Positive" | "Neutral" | "Negative";
  commentText:    string;
  commentingUser: string;
  commentTime:    string;
  itemId:         string | null;
}

async function fetchFeedbackSince(since: Date): Promise<FeedbackEntry[]> {
  const [token, appId, tradingApiUrl] = await Promise.all([
    getAccessToken(), getAppId(), getTradingApiUrl(),
  ]);

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetFeedbackRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <FeedbackType>FeedbackReceivedAsSeller</FeedbackType>
  <DetailLevel>ReturnAll</DetailLevel>
  <Pagination>
    <EntriesPerPage>50</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
</GetFeedbackRequest>`;

  const headers: Record<string, string> = {
    "X-EBAY-API-CALL-NAME":           "GetFeedback",
    "X-EBAY-API-SITEID":              "0",
    "X-EBAY-API-COMPATIBILITY-LEVEL": "1209",
    "Content-Type":                   "text/xml",
  };
  if (appId) headers["X-EBAY-API-APP-ID"] = appId;

  const r    = await fetch(tradingApiUrl, { method: "POST", headers, body: xml });
  const text = await r.text();

  const ack = xmlVal(text, "Ack");
  if (ack === "Failure") throw new Error(xmlVal(text, "LongMessage") || "eBay API error");

  const all = xmlAll(text, "FeedbackDetail").map(fb => ({
    id:             xmlVal(fb, "FeedbackID") || `${Date.now()}-${Math.random()}`,
    commentType:    (xmlVal(fb, "CommentType") || "Positive") as FeedbackEntry["commentType"],
    commentText:    xmlVal(fb, "CommentText"),
    commentingUser: xmlVal(fb, "CommentingUser"),
    commentTime:    xmlVal(fb, "CommentTime"),
    itemId:         xmlVal(fb, "ItemID") || null,
  }));

  // Only return entries newer than last check
  return all.filter(fb => {
    const t = new Date(fb.commentTime);
    return !isNaN(t.getTime()) && t > since;
  });
}

// ─── Claude analysis ──────────────────────────────────────────────────────────

interface Analysis {
  severity:          "critical" | "high" | "medium";
  summary:           string;
  likelyCause:       string;
  suggestedResponse: string;
  accountHealthRisk: string;
}

async function analyzeFeedback(fb: FeedbackEntry): Promise<Analysis> {
  const client = new Anthropic();
  const res = await client.messages.create({
    model:      MODEL,
    max_tokens: 400,
    system: `You are an eBay account health expert advising a sports card seller who just received ${fb.commentType} feedback.
Your job is to help them respond professionally and protect their seller standing.

Return ONLY valid JSON — no other text:
{
  "severity": "critical" | "high" | "medium",
  "summary": "one sentence describing what happened",
  "likelyCause": "probable reason for the feedback",
  "suggestedResponse": "a short, professional public response the seller can post on eBay (1-2 sentences, no apology overkill)",
  "accountHealthRisk": "impact on seller metrics if not addressed"
}`,
    messages: [{
      role:    "user",
      content: `${fb.commentType} feedback from buyer "${fb.commentingUser}":\n"${fb.commentText}"\n${fb.itemId ? `Item: ${fb.itemId}` : ""}`,
    }],
  });
  const raw = res.content.find(b => b.type === "text")?.text ?? "{}";
  const m   = raw.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(m?.[0] ?? "{}") as Analysis;
  } catch {
    return {
      severity:          "high",
      summary:           `${fb.commentType} feedback received from ${fb.commentingUser}`,
      likelyCause:       "Unknown — review manually",
      suggestedResponse: "Thank you for your feedback. I take all concerns seriously and would like to resolve this for you.",
      accountHealthRisk: "May affect seller metrics — respond promptly",
    };
  }
}

// ─── Email builder ────────────────────────────────────────────────────────────

function buildAlertEmail(
  entries: Array<{ fb: FeedbackEntry; analysis: Analysis }>,
): string {
  const severityColor = (s: string) =>
    s === "critical" ? "#b91c1c" : s === "high" ? "#d97706" : "#64748b";
  const severityBg = (s: string) =>
    s === "critical" ? "#fee2e2" : s === "high" ? "#fef9c3" : "#f1f5f9";
  const typeColor = (t: string) =>
    t === "Negative" ? "#b91c1c" : t === "Neutral" ? "#b45309" : "#15803d";
  const typeBg = (t: string) =>
    t === "Negative" ? "#fee2e2" : t === "Neutral" ? "#fef9c3" : "#dcfce7";

  const rows = entries.map(({ fb, analysis }) => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #e2e8f0">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
          <span style="background:${typeBg(fb.commentType)};color:${typeColor(fb.commentType)};font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px">${fb.commentType.toUpperCase()}</span>
          <span style="background:${severityBg(analysis.severity)};color:${severityColor(analysis.severity)};font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px">${analysis.severity.toUpperCase()} RISK</span>
          <span style="font-size:12px;color:#94a3b8">from ${fb.commentingUser}${fb.itemId ? ` · Item #${fb.itemId}` : ""}</span>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;font-style:italic;color:#334155;font-size:14px;margin-bottom:10px">"${fb.commentText || "(no comment)"}"</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:4px"><strong>Likely cause:</strong> ${analysis.likelyCause}</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:8px"><strong>Account health risk:</strong> ${analysis.accountHealthRisk}</div>
        <div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:10px 14px;border-radius:0 6px 6px 0">
          <div style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;margin-bottom:4px">Suggested public response</div>
          <div style="font-size:13px;color:#1e3a5f">${analysis.suggestedResponse}</div>
        </div>
      </td>
    </tr>`).join("");

  return `<div style="font-family:sans-serif;max-width:620px;margin:0 auto">
  <div style="background:#7f1d1d;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
    <div style="font-size:18px;font-weight:700">⚠️ eBay Feedback Alert — Action Required</div>
    <div style="font-size:13px;color:#fca5a5;margin-top:4px">${entries.length} new ${entries.length === 1 ? "entry" : "entries"} · ${entries.filter(e => e.fb.commentType === "Negative").length} negative · ${entries.filter(e => e.fb.commentType === "Neutral").length} neutral</div>
  </div>
  <div style="background:white;padding:20px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
    <p style="font-size:14px;color:#64748b;margin-top:0">Respond to negative/neutral feedback on eBay within 90 days. Your public reply is visible to all buyers and affects purchasing decisions.</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <div style="margin-top:24px;text-align:center">
      <a href="https://www.ebay.com/myb/FeedbackProfile" style="background:#1d4ed8;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Respond on eBay →</a>
    </div>
    <div style="margin-top:16px;font-size:11px;color:#94a3b8;text-align:center">Sent by Card Cloud AI · Check the admin dashboard for the full feedback list</div>
  </div>
</div>`;
}

// ─── Last-check timestamp helpers ─────────────────────────────────────────────

async function getLastCheck(): Promise<Date> {
  const row = await db.siteCredential.findUnique({ where: { service: "ebay_feedback_last_check" } });
  if (row?.value) {
    const d = new Date(row.value);
    if (!isNaN(d.getTime())) return d;
  }
  // First run: look back 7 days to catch any recent issues
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

async function setLastCheck(date: Date): Promise<void> {
  await db.siteCredential.upsert({
    where:  { service: "ebay_feedback_last_check" },
    update: { value: date.toISOString() },
    create: { service: "ebay_feedback_last_check", label: "eBay Feedback Last Check", value: date.toISOString() },
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (req.headers.get("x-internal") !== "ai-lab") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runStart = new Date();

  try {
    const since   = await getLastCheck();
    const entries = await fetchFeedbackSince(since);

    // Only alert on negative feedback
    const alertable = entries.filter(fb => fb.commentType === "Negative");

    if (alertable.length === 0) {
      await setLastCheck(runStart);
      return NextResponse.json({ checked: entries.length, alerted: 0 });
    }

    // Upsert each into EbayFeedbackAlert — only truly new ones (no existing record) get notified
    const newAlerts: typeof alertable = [];
    for (const fb of alertable) {
      const existing = await db.ebayFeedbackAlert.findUnique({ where: { feedbackId: fb.id } });
      if (!existing) {
        await db.ebayFeedbackAlert.create({
          data: {
            feedbackId:     fb.id,
            commentType:    fb.commentType,
            commentingUser: fb.commentingUser,
            commentText:    fb.commentText,
            commentTime:    new Date(fb.commentTime),
            itemId:         fb.itemId ?? null,
          },
        });
        newAlerts.push(fb);
      }
    }

    if (newAlerts.length === 0) {
      await setLastCheck(runStart);
      return NextResponse.json({ checked: entries.length, alerted: 0 });
    }

    const results = await Promise.all(
      newAlerts.map(async fb => ({ fb, analysis: await analyzeFeedback(fb) })),
    );

    const negCount = newAlerts.length;
    const smsText  = negCount === 1
      ? `Card Cloud: New negative eBay feedback from ${newAlerts[0].commentingUser}. Log in to respond.`
      : `Card Cloud: ${negCount} new negative eBay feedback entries. Log in to respond.`;

    // Fire email alert + SMS-via-email in parallel
    await Promise.all([
      sendTransactionalEmail({
        to:      ALERT_EMAIL,
        subject: `🚨 eBay Negative Feedback — ${negCount} new ${negCount === 1 ? "entry" : "entries"} need your response`,
        html:    buildAlertEmail(results),
      }),
      sendTransactionalEmail({
        to:      ALERT_SMS_EMAIL,
        subject: "",
        html:    smsText,
        text:    smsText,
      }),
    ]);

    await setLastCheck(runStart);
    return NextResponse.json({ checked: entries.length, alerted: newAlerts.length });

  } catch (e) {
    console.error("[ebay-feedback-monitor]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
