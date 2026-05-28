/**
 * AI-powered customer service email agent.
 *
 * Handles two flows:
 *   Inbound: user/partner emails support → Claude reads it → auto-responds or escalates
 *   Outbound: Mike describes what he wants to say → Claude drafts it → Mike approves + sends
 *
 * Escalation triggers a notification email to the admin address so Mike can
 * step in personally. All threads are stored in EmailThread / EmailMessage tables.
 */

import { anthropic as _anthropic, claudeMessage } from "@/lib/claude";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/transactional-email";

// Re-use the shared singleton; null when key is missing
const client = process.env.ANTHROPIC_API_KEY ? _anthropic : null;

const ADMIN_EMAIL  = process.env.ADMIN_EMAIL  ?? "mikeahayward@hotmail.com";
const SUPPORT_FROM = process.env.SUPPORT_FROM ?? "The Card Cloud Support <support@thecardcloud.com>";

// Verizon email-to-SMS gateways for Mike's number (SMS + MMS variants)
const PHONE_GATEWAY_EMAILS = new Set([
  "8604812787@vtext.com",
  "8604812787@vzwpix.com",
]);
const OWNER_SMS_REPLY_TO = "8604812787@vtext.com";

// Emails from these addresses get the owner/admin agent instead of customer support
const OWNER_EMAILS = new Set([
  "mikeahayward@hotmail.com",
  "mhayward@haywardsystems.com",
  "virus860@gmail.com",
  // Verizon SMS/MMS gateways — texts from Mike's phone arrive from these addresses
  "8604812787@vtext.com",
  "8604812787@vzwpix.com",
]);

const CUSTOMER_AGENT_SYSTEM = `You are the customer service agent for The Card Cloud — a sports card tracking,
selling, consigning, and trading platform. You handle:

1. User support questions (how to use the platform, billing, bugs)
2. Business partnership inquiries (grading companies, card shops, data providers)
3. General hobby questions

Your tone is friendly, knowledgeable, and concise. You love sports cards.

When you cannot confidently answer — when the request is complex, emotional, a complaint
requiring investigation, a business negotiation, or anything that needs a human decision —
mark it for escalation rather than guessing.

Always respond in this JSON format:
{
  "category": "support" | "partnership" | "billing" | "question" | "complaint" | "other",
  "shouldEscalate": boolean,
  "escalationReason": "string (only if escalating)",
  "response": "the email reply text (always include even if escalating — shown to admin)",
  "internalNote": "brief note about what this email is about (for admin dashboard)"
}`;

// Fetch live system stats to include in the owner agent's context
async function getSystemStats(): Promise<string> {
  try {
    const [
      userCount, cardCount, publicCollections, consignmentOrders,
      activeEbayListings, activeExchangeListings, openThreads,
    ] = await Promise.all([
      db.user.count(),
      db.card.count(),
      db.collection.count({ where: { isPublic: true } }),
      db.consignmentOrder.count(),
      db.ebayListing.count({ where: { status: "active" } }),
      db.exchangeListing.count({ where: { status: "active" } }),
      db.emailThread.count({ where: { status: "open" } }),
    ]);
    return `
LIVE SYSTEM STATS (as of this email):
- Registered users: ${userCount}
- Cards tracked: ${cardCount}
- Public collections: ${publicCollections}
- Consignment orders (all time): ${consignmentOrders}
- Active eBay listings: ${activeEbayListings}
- Active Exchange listings: ${activeExchangeListings}
- Open support email threads: ${openThreads}`;
  } catch {
    return "\nLIVE STATS: unavailable (DB query failed)";
  }
}

function buildOwnerAgentSystem(stats: string, viaSms = false): string {
  const smsNote = viaSms ? `

IMPORTANT — SMS MODE: Mike is texting you from his phone. Your response will be delivered as a text message.
- Plain text only — no markdown, no bullet points, no HTML formatting.
- Write conversationally, like a text message. Answer fully — don't truncate.
- If your response is long it will automatically be split into two messages.` : "";

  return `You are the personal AI assistant for Michael Hayward, the founder and owner of The Card Cloud.
You are responding to ${viaSms ? "a text message" : "an email"} sent from one of Mike's personal ${viaSms ? "phone numbers" : "email addresses"}.

ABOUT MIKE:
- He is the sole owner and developer of The Card Cloud
- He has full access to everything on the platform
- He often emails support@ to quickly check on system status, ask about features, or think through problems
- Treat him as a trusted technical partner, not a customer

ABOUT THE CARD CLOUD:
The Card Cloud is a sports card platform (in active development) with these features:
- Card collection tracking with live eBay value estimates
- Consignment service (admin lists cards on eBay on behalf of users)
- The Exchange (peer-to-peer card marketplace with escrow)
- Trade facilitation
- User social features (feed, following, public collections)
- AI-powered email agent (this system), eBay listing generator, slab scanner

TECH STACK:
- Next.js 16 (App Router), Prisma ORM, PostgreSQL (via prisma dev locally)
- Hosted on Windows machine running PM2 (card-cloud-app on :3001, card-cloud-ai on :3002)
- eBay Inventory API for listing management
- Resend/SMTP for email, Anthropic Claude for AI features
- Stripe Connect planned for Exchange payments

${stats}

YOUR ROLE:
Answer Mike's questions directly and technically. You can:
- Report on system stats (shown above)
- Explain how features work under the hood
- Help him think through technical decisions
- Give honest assessments of what's built vs. what's planned
- Reference specific routes, components, or DB models if relevant

Keep responses concise and direct — Mike is a busy founder, not a first-time user.${smsNote}

Always respond in this JSON format:
{
  "category": "admin",
  "shouldEscalate": false,
  "response": "your reply to Mike",
  "internalNote": "brief note for the thread log"
}`;
}

// ─── Inbound email handling ────────────────────────────────────────────────────

export interface InboundEmail {
  fromEmail: string;
  fromName?: string;
  subject:   string;
  body:      string;
  messageId?: string;
  inReplyTo?: string;  // existing thread ID if a reply
}

export async function handleInboundEmail(email: InboundEmail): Promise<{
  threadId: string;
  escalated: boolean;
  autoReplied: boolean;
}> {
  // Find existing thread or create new one
  let thread = email.inReplyTo
    ? await db.emailThread.findUnique({ where: { id: email.inReplyTo }, include: { messages: { orderBy: { sentAt: "asc" } } } })
    : null;

  if (!thread) {
    thread = await db.emailThread.create({
      data: {
        subject:   email.subject,
        fromEmail: email.fromEmail,
        fromName:  email.fromName,
        type:      "inbound",
        status:    "open",
      },
      include: { messages: true },
    });
  }

  // Save the inbound message
  await db.emailMessage.create({
    data: {
      threadId:   thread.id,
      role:       "user",
      body:       email.body,
      providerId: email.messageId,
    },
  });

  // Build conversation history for Claude
  const history = thread.messages.map(m =>
    `[${m.role.toUpperCase()}]: ${m.body}`
  ).join("\n\n");

  const isOwner  = OWNER_EMAILS.has(email.fromEmail.toLowerCase());
  const viaSms   = PHONE_GATEWAY_EMAILS.has(email.fromEmail.toLowerCase());

  // Normalize subject for SMS threads (Verizon often sends blank or garbled subjects)
  const subject  = viaSms ? "SMS from Mike" : email.subject;

  const prompt = `${viaSms ? "Text message" : "Email"} thread so far:\n${history}\n\n[USER]: ${email.body}\n\nSubject: ${subject}\nFrom: ${viaSms ? "Mike's phone (SMS)" : `${email.fromName ?? ""} <${email.fromEmail}>`}`;

  if (!client) {
    if (isOwner) {
      const noKeyMsg = viaSms
        ? "No AI key configured — can't respond right now. Check admin dashboard."
        : "Hi Mike — no Anthropic API key is configured, so I can't answer intelligently right now. Check Admin → API Keys → Anthropic.";
      await db.emailMessage.create({ data: { threadId: thread.id, role: "agent", body: noKeyMsg } });
      await replyToSender(email.fromEmail, viaSms, subject, noKeyMsg);
      return { threadId: thread.id, escalated: false, autoReplied: true };
    }
    await escalateThread(thread.id, email.fromEmail, subject, email.body, "No AI configured — manual review required");
    return { threadId: thread.id, escalated: true, autoReplied: false };
  }

  // Choose system prompt based on sender identity
  let systemPrompt: string;
  if (isOwner) {
    const stats = await getSystemStats();
    systemPrompt = buildOwnerAgentSystem(stats, viaSms);
  } else {
    systemPrompt = CUSTOMER_AGENT_SYSTEM;
  }

  // Call Claude with the appropriate agent persona
  const completion = await claudeMessage({
    system:      systemPrompt,
    userContent: prompt,
    model:       "claude-haiku-4-5-20251001",
    maxTokens:   1024,
  });

  let agentDecision: {
    category: string;
    shouldEscalate: boolean;
    escalationReason?: string;
    response: string;
    internalNote?: string;
  };

  try {
    const text = completion.content.find(b => b.type === "text")?.text ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    agentDecision = jsonMatch ? JSON.parse(jsonMatch[0]) : { category: "other", shouldEscalate: true, response: text };
  } catch {
    agentDecision = { category: "other", shouldEscalate: true, response: "Thank you for reaching out. A team member will respond shortly.", escalationReason: "Failed to parse AI response" };
  }

  // Update thread category (owner emails always tagged "admin")
  await db.emailThread.update({
    where: { id: thread.id },
    data:  { category: isOwner ? "admin" : agentDecision.category },
  });

  // Owner emails/texts never escalate — always reply directly
  if (agentDecision.shouldEscalate && !isOwner) {
    await escalateThread(
      thread.id,
      email.fromEmail,
      subject,
      agentDecision.response,
      agentDecision.escalationReason ?? "AI flagged for human review",
    );
    return { threadId: thread.id, escalated: true, autoReplied: false };
  }

  // Auto-reply
  await db.emailMessage.create({
    data: { threadId: thread.id, role: "agent", body: agentDecision.response },
  });

  await replyToSender(email.fromEmail, viaSms, subject, agentDecision.response);

  return { threadId: thread.id, escalated: false, autoReplied: true };
}

// ─── Reply routing ────────────────────────────────────────────────────────────

// Split long SMS responses at a sentence boundary near the midpoint.
// Returns one or two parts; a single part if ≤ 320 chars.
function splitForSms(text: string): [string] | [string, string] {
  if (text.length <= 320) return [text];

  const mid = Math.floor(text.length / 2);
  let splitAt = -1;

  // Search forward from midpoint for sentence end followed by space or EOL
  for (let i = mid; i < Math.min(text.length, mid + 200); i++) {
    if (".?!".includes(text[i]) && (i + 1 >= text.length || text[i + 1] === " " || text[i + 1] === "\n")) {
      splitAt = i + 1;
      break;
    }
  }
  // Fallback: search backward
  if (splitAt === -1) {
    for (let i = mid; i > Math.max(0, mid - 200); i--) {
      if (".?!".includes(text[i]) && (i + 1 >= text.length || text[i + 1] === " " || text[i + 1] === "\n")) {
        splitAt = i + 1;
        break;
      }
    }
  }
  // Last resort: split at a word boundary near midpoint
  if (splitAt <= 0 || splitAt >= text.length) {
    splitAt = text.lastIndexOf(" ", mid) + 1;
  }

  if (splitAt <= 0 || splitAt >= text.length) return [text];
  return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()];
}

async function replyToSender(
  fromEmail: string,
  viaSms:    boolean,
  subject:   string,
  text:      string,
): Promise<void> {
  if (viaSms) {
    // Split long replies into at most two texts; send sequentially so they arrive in order
    const parts = splitForSms(text);
    for (const part of parts) {
      await sendTransactionalEmail({
        to:      OWNER_SMS_REPLY_TO,
        subject: "",
        html:    part,
        text:    part,
      });
    }
  } else {
    await sendTransactionalEmail({
      to:      fromEmail,
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      html:    buildEmailHtml(text),
    });
  }
}

// ─── Escalation ───────────────────────────────────────────────────────────────

async function escalateThread(
  threadId: string,
  fromEmail: string,
  subject: string,
  draftResponse: string,
  reason: string,
): Promise<void> {
  await db.emailThread.update({
    where: { id: threadId },
    data:  { status: "escalated", escalated: true, escalationReason: reason },
  });

  // Notify admin
  await sendTransactionalEmail({
    to:      ADMIN_EMAIL,
    subject: `[Escalated] ${subject}`,
    html:    buildEscalationHtml(fromEmail, subject, draftResponse, reason, threadId),
  });
}

// ─── Outbound email drafting ──────────────────────────────────────────────────

export async function draftOutboundEmail(context: {
  toEmail:   string;
  toName?:   string;
  company?:  string;
  purpose:   string;  // e.g. "Request data partnership with TCDB"
  keyPoints?: string; // bullet points to include
  tone?:     "professional" | "friendly" | "formal";
}): Promise<{ subject: string; body: string; threadId: string }> {
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");

  const DRAFT_SYSTEM = `You are a professional business writer for The Card Cloud — a sports card tracking, selling, consigning, and trading platform built for serious collectors. The platform is currently in active development/beta. You write clear, professional, concise business emails on behalf of the company. Always return valid JSON: { "subject": "email subject line", "body": "full email body text" }`;

  const userPrompt = `Draft an email with these details:
To: ${context.toName ?? ""} <${context.toEmail}>${context.company ? ` at ${context.company}` : ""}
Purpose: ${context.purpose}
Key points: ${context.keyPoints ?? "none specified"}
Tone: ${context.tone ?? "professional"}`;

  // DRAFT_SYSTEM cached via shared helper; only the per-request details vary
  const completion = await claudeMessage({
    system:      DRAFT_SYSTEM,
    userContent: userPrompt,
    model:       "claude-haiku-4-5-20251001",
    maxTokens:   1024,
  });

  const text = completion.content.find(b => b.type === "text")?.text ?? "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const draft = jsonMatch ? JSON.parse(jsonMatch[0]) : { subject: "Partnership Inquiry", body: text };

  // Save as draft thread
  const thread = await db.emailThread.create({
    data: {
      subject:   draft.subject,
      fromEmail: SUPPORT_FROM,
      type:      "outbound",
      status:    "draft",
    },
  });

  await db.emailMessage.create({
    data: { threadId: thread.id, role: "agent", body: draft.body },
  });

  return { subject: draft.subject, body: draft.body, threadId: thread.id };
}

export async function sendDraftEmail(threadId: string, toEmail: string): Promise<void> {
  const thread = await db.emailThread.findUnique({
    where:   { id: threadId },
    include: { messages: { orderBy: { sentAt: "desc" }, take: 1 } },
  });
  if (!thread || !thread.messages[0]) throw new Error("Thread not found");

  await sendTransactionalEmail({
    to:      toEmail,
    subject: thread.subject,
    html:    buildEmailHtml(thread.messages[0].body),
  });

  await db.emailThread.update({
    where: { id: threadId },
    data:  { status: "open", fromEmail: toEmail },
  });
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildEmailHtml(text: string): string {
  const lines = text.split("\n").map(l => `<p style="margin:0 0 12px;color:#334155;line-height:1.6">${l.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>`).join("");
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
    <div style="background:#042C53;padding:20px 24px"><p style="color:#fff;font-weight:bold;margin:0;font-size:18px">☁ The Card Cloud</p></div>
    <div style="padding:24px;background:#fff">${lines}</div>
    <div style="background:#042C53;padding:12px 24px"><p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© 2026 The Card Cloud · thecardcloud.com</p></div>
  </div>`;
}

function buildEscalationHtml(fromEmail: string, subject: string, draft: string, reason: string, threadId: string): string {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
    <div style="background:#A32D2D;padding:20px 24px"><p style="color:#fff;font-weight:bold;margin:0;font-size:16px">⚠ Customer service escalation</p></div>
    <div style="padding:24px;background:#fff">
      <p><strong>From:</strong> ${fromEmail}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <hr style="border-color:#e2e8f0;margin:16px 0"/>
      <p style="color:#64748b;font-size:12px">AI draft response (not sent):</p>
      <p style="background:#f8fafc;padding:16px;border-radius:8px;font-size:14px">${draft.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>
      <p><a href="${appUrl}/admin/ai-lab/email" style="background:#EF9F27;color:#412402;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Handle in Admin →</a></p>
    </div>
  </div>`;
}
