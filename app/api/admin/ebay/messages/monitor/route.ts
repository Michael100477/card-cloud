/**
 * POST /api/admin/ebay/messages/monitor
 *
 * Called by card-cloud-ai every 5 minutes.
 * Fetches eBay messages received since the last check, runs each through
 * Claude to decide if action is needed, and emails mikeahayward@hotmail.com
 * with a summary when anything requires attention.
 *
 * Last-check timestamp stored in SiteCredential as "ebay_message_last_check".
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getAppId, getTradingApiUrl } from "@/lib/ebay-auth";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const ALERT_EMAIL = "mikeahayward@hotmail.com";
const MODEL           = "claude-haiku-4-5-20251001";

// ─── XML helpers (duplicated from messages route to keep routes independent) ──

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

// ─── Fetch messages since a given timestamp ───────────────────────────────────

async function fetchMessagesSince(since: Date): Promise<Array<{
  id: string; subject: string; body: string; sender: string;
  messageType: string; createdAt: string; itemId: string | null;
}>> {
  const [token, appId, tradingApiUrl] = await Promise.all([getAccessToken(), getAppId(), getTradingApiUrl()]);
  const now = new Date();

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <MailMessageType>All</MailMessageType>
  <StartCreationTime>${since.toISOString()}</StartCreationTime>
  <EndCreationTime>${now.toISOString()}</EndCreationTime>
  <Pagination>
    <EntriesPerPage>25</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
</GetMemberMessagesRequest>`;

  const headers: Record<string, string> = {
    "X-EBAY-API-CALL-NAME":           "GetMemberMessages",
    "X-EBAY-API-SITEID":              "0",
    "X-EBAY-API-COMPATIBILITY-LEVEL": "1209",
    "Content-Type":                   "text/xml",
  };
  if (appId) headers["X-EBAY-API-APP-ID"] = appId;

  const r = await fetch(tradingApiUrl, { method: "POST", headers, body: xml });
  const text = await r.text();

  const ack = xmlVal(text, "Ack");
  if (ack === "Failure") throw new Error(xmlVal(text, "LongMessage") || "eBay API error");

  return xmlAll(text, "MemberMessageExchange").map(ex => ({
    id:          xmlVal(ex, "MessageID"),
    subject:     xmlVal(ex, "Subject") || "(no subject)",
    body:        xmlVal(ex, "Body").slice(0, 1500),
    sender:      xmlVal(ex, "UserID"),
    messageType: xmlVal(ex, "MessageType"),
    createdAt:   xmlVal(ex, "CreationDate"),
    itemId:      xmlVal(ex, "ItemID") || null,
  }));
}

// ─── Claude analysis ──────────────────────────────────────────────────────────

const EBAY_POLICY_SYSTEM = `You are an eBay policy expert monitoring messages for a sports card seller on The Card Cloud platform.

Key eBay seller policies:
- Respond to buyer messages within 24-48 hours — failing to respond affects seller standards
- Never ask buyers to complete transactions outside of eBay (off-platform solicitation)
- Honor stated return policies — failure leads to eBay stepping in and siding with buyer
- eBay Money Back Guarantee: buyers are protected on all eligible transactions
- Unpaid item cases: can be opened after 48 hours of non-payment
- Do not make false claims about card grade, condition, or authenticity
- Negative/neutral feedback: can be responded to publicly but cannot be removed unless it violates eBay policy
- eBay VeRO: do not list items that infringe intellectual property
- Item not received claims: must respond within 3 business days or eBay will automatically refund the buyer
- Return requests: must respond within 3 business days

Identify if the message requires any of:
- Immediate response (time-sensitive — refund/INR/return request)
- Policy compliance risk (off-platform request, dispute, etc.)
- Business decision (price negotiation, combined shipping, special request)
- General inquiry (question about item, shipping, etc.)

Return ONLY valid JSON — no other text:
{
  "needsAction": boolean,
  "urgency": "high" | "medium" | "low" | "none",
  "summary": "one sentence describing what the buyer wants or said",
  "recommendedAction": "what the seller should do, or 'Monitor only — no action needed'",
  "policyNote": "relevant eBay policy if applicable, or empty string"
}`;

interface Analysis {
  needsAction:       boolean;
  urgency:           "high" | "medium" | "low" | "none";
  summary:           string;
  recommendedAction: string;
  policyNote:        string;
}

async function analyzeMessage(msg: {
  subject: string; body: string; sender: string; messageType: string;
}): Promise<Analysis> {
  const client = new Anthropic();
  const res = await client.messages.create({
    model:      MODEL,
    max_tokens: 300,
    system:     EBAY_POLICY_SYSTEM,
    messages: [{
      role: "user",
      content: `eBay message from buyer "${msg.sender}":\nType: ${msg.messageType}\nSubject: ${msg.subject}\n\n${msg.body}`,
    }],
  });
  const text = res.content.find(b => b.type === "text")?.text ?? "{}";
  const m = text.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(m?.[0] ?? "{}") as Analysis;
  } catch {
    return { needsAction: true, urgency: "low", summary: msg.subject, recommendedAction: "Review manually", policyNote: "" };
  }
}

// ─── Email builder ────────────────────────────────────────────────────────────

function buildAlertEmail(messages: Array<{ msg: { id: string; subject: string; sender: string; createdAt: string; itemId: string | null }; analysis: Analysis }>): string {
  const rows = messages.map(({ msg, analysis }) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:14px 0">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <span style="background:${analysis.urgency === "high" ? "#fee2e2" : analysis.urgency === "medium" ? "#fef9c3" : "#f1f5f9"};color:${analysis.urgency === "high" ? "#b91c1c" : analysis.urgency === "medium" ? "#854d0e" : "#475569"};font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px">${analysis.urgency.toUpperCase()}</span>
          <span style="font-weight:600;color:#1e293b">${msg.subject}</span>
        </div>
        <div style="font-size:13px;color:#64748b;margin-bottom:4px">From: <strong>${msg.sender}</strong>${msg.itemId ? ` · Item: ${msg.itemId}` : ""}</div>
        <div style="font-size:14px;color:#334155;margin-bottom:6px">${analysis.summary}</div>
        <div style="font-size:13px;background:#f8fafc;border-left:3px solid #3b82f6;padding:8px 12px;color:#1e293b"><strong>Action:</strong> ${analysis.recommendedAction}</div>
        ${analysis.policyNote ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">Policy note: ${analysis.policyNote}</div>` : ""}
      </td>
    </tr>`).join("");

  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1e293b;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
    <div style="font-size:18px;font-weight:700">eBay Messages — Action Required</div>
    <div style="font-size:13px;color:#94a3b8;margin-top:4px">${messages.length} message${messages.length !== 1 ? "s" : ""} need${messages.length === 1 ? "s" : ""} your attention</div>
  </div>
  <div style="background:white;padding:20px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <div style="margin-top:20px;text-align:center">
      <a href="https://messages.ebay.com" style="background:#3b82f6;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Open eBay Messages</a>
    </div>
    <div style="margin-top:16px;font-size:11px;color:#94a3b8;text-align:center">Sent by Card Cloud AI · This is a monitoring alert only — no auto-replies were sent</div>
  </div>
</div>`;
}

// ─── Last-check timestamp helpers ────────────────────────────────────────────

async function getLastCheck(): Promise<Date> {
  const row = await db.siteCredential.findUnique({ where: { service: "ebay_message_last_check" } });
  if (row?.value) {
    const d = new Date(row.value);
    if (!isNaN(d.getTime())) return d;
  }
  // First run: look back 24 hours
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

async function setLastCheck(date: Date): Promise<void> {
  await db.siteCredential.upsert({
    where:  { service: "ebay_message_last_check" },
    update: { value: date.toISOString() },
    create: { service: "ebay_message_last_check", label: "eBay Message Last Check", value: date.toISOString() },
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Only callable from the AI Lab internal poller
  if (req.headers.get("x-internal") !== "ai-lab") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runStart = new Date();

  try {
    const since    = await getLastCheck();
    const messages = await fetchMessagesSince(since);

    if (messages.length === 0) {
      await setLastCheck(runStart);
      return NextResponse.json({ checked: 0, alerted: 0 });
    }

    // Analyze each message in parallel (capped to 5 at a time)
    const results: Array<{ msg: typeof messages[0]; analysis: Analysis }> = [];
    for (let i = 0; i < messages.length; i += 5) {
      const batch = messages.slice(i, i + 5);
      const analyzed = await Promise.all(batch.map(async msg => ({
        msg,
        analysis: await analyzeMessage(msg),
      })));
      results.push(...analyzed);
    }

    const actionable = results.filter(r => r.analysis.needsAction);

    if (actionable.length > 0) {
      // Sort by urgency: high → medium → low
      const order = { high: 0, medium: 1, low: 2, none: 3 };
      actionable.sort((a, b) => order[a.analysis.urgency] - order[b.analysis.urgency]);

      await sendTransactionalEmail({
        to:      ALERT_EMAIL,
        subject: `eBay Messages — ${actionable.length} item${actionable.length !== 1 ? "s" : ""} need attention`,
        html:    buildAlertEmail(actionable),
      });
    }

    await setLastCheck(runStart);
    return NextResponse.json({ checked: messages.length, alerted: actionable.length });

  } catch (e) {
    console.error("[ebay-monitor]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
