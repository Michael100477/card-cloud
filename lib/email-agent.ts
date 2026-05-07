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

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import * as React from "react";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const ADMIN_EMAIL  = process.env.ADMIN_EMAIL  ?? "virus860@gmail.com";
const SUPPORT_FROM = process.env.SUPPORT_FROM ?? "The Card Cloud Support <support@thecardcloud.com>";

const AGENT_SYSTEM = `You are the customer service agent for The Card Cloud — a sports card tracking,
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

  const prompt = `Email thread so far:\n${history}\n\n[USER]: ${email.body}\n\nSubject: ${email.subject}\nFrom: ${email.fromName ?? ""} <${email.fromEmail}>`;

  if (!client) {
    // No Anthropic key — escalate everything
    await escalateThread(thread.id, email.fromEmail, email.subject, email.body, "No AI configured — manual review required");
    return { threadId: thread.id, escalated: true, autoReplied: false };
  }

  const completion = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 1024,
    system:     AGENT_SYSTEM,
    messages:   [{ role: "user", content: prompt }],
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

  // Update thread category
  await db.emailThread.update({
    where: { id: thread.id },
    data:  { category: agentDecision.category },
  });

  if (agentDecision.shouldEscalate) {
    await escalateThread(
      thread.id,
      email.fromEmail,
      email.subject,
      agentDecision.response,
      agentDecision.escalationReason ?? "AI flagged for human review",
    );
    return { threadId: thread.id, escalated: true, autoReplied: false };
  }

  // Auto-reply
  await db.emailMessage.create({
    data: { threadId: thread.id, role: "agent", body: agentDecision.response },
  });

  await sendEmail({
    to:      email.fromEmail,
    subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
    react:   buildEmailBody(agentDecision.response),
  });

  return { threadId: thread.id, escalated: false, autoReplied: true };
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
  await sendEmail({
    to:      ADMIN_EMAIL,
    subject: `[Escalated] ${subject}`,
    react:   buildEscalationEmail(fromEmail, subject, draftResponse, reason, threadId),
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
  const prompt = `Draft a professional email for The Card Cloud with these details:
To: ${context.toName ?? ""} ${context.toEmail}${context.company ? ` at ${context.company}` : ""}
Purpose: ${context.purpose}
Key points to cover: ${context.keyPoints ?? "none specified"}
Tone: ${context.tone ?? "professional"}

The Card Cloud is a sports card tracking, selling, consigning, and trading platform
built for serious collectors. We are currently in development/beta stage.

Return JSON: { "subject": "email subject", "body": "full email body text" }`;

  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");

  const completion = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 1024,
    messages:   [{ role: "user", content: prompt }],
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

  await sendEmail({
    to:      toEmail,
    subject: thread.subject,
    react:   buildEmailBody(thread.messages[0].body),
  });

  await db.emailThread.update({
    where: { id: threadId },
    data:  { status: "open", fromEmail: toEmail },
  });
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildEmailBody(text: string): React.ReactElement {
  return React.createElement("div", { style: { fontFamily: "sans-serif", maxWidth: 560, margin: "0 auto" } },
    React.createElement("div", { style: { background: "#042C53", padding: "20px 24px" } },
      React.createElement("p", { style: { color: "#fff", fontWeight: "bold", margin: 0, fontSize: 18 } }, "☁ The Card Cloud")
    ),
    React.createElement("div", { style: { padding: "24px", background: "#fff" } },
      ...text.split("\n").map((line, i) =>
        React.createElement("p", { key: i, style: { margin: "0 0 12px", color: "#334155", lineHeight: 1.6 } }, line)
      ),
    ),
    React.createElement("div", { style: { background: "#042C53", padding: "12px 24px" } },
      React.createElement("p", { style: { color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0 } },
        "© 2026 The Card Cloud · thecardcloud.com"
      )
    )
  );
}

function buildEscalationEmail(
  fromEmail: string, subject: string, draft: string, reason: string, threadId: string
): React.ReactElement {
  return React.createElement("div", { style: { fontFamily: "sans-serif", maxWidth: 560, margin: "0 auto" } },
    React.createElement("div", { style: { background: "#A32D2D", padding: "20px 24px" } },
      React.createElement("p", { style: { color: "#fff", fontWeight: "bold", margin: 0, fontSize: 16 } },
        "⚠ Customer service escalation"
      )
    ),
    React.createElement("div", { style: { padding: "24px", background: "#fff" } },
      React.createElement("p", null, React.createElement("strong", null, "From: "), fromEmail),
      React.createElement("p", null, React.createElement("strong", null, "Subject: "), subject),
      React.createElement("p", null, React.createElement("strong", null, "Reason: "), reason),
      React.createElement("hr", { style: { borderColor: "#e2e8f0", margin: "16px 0" } }),
      React.createElement("p", { style: { color: "#64748b", fontSize: 12 } }, "AI draft response (not sent):"),
      React.createElement("p", { style: { background: "#f8fafc", padding: 16, borderRadius: 8, fontSize: 14 } }, draft),
      React.createElement("p", null,
        React.createElement("a", {
          href:  `http://localhost:3002/email?thread=${threadId}`,
          style: { background: "#EF9F27", color: "#412402", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: "bold" }
        }, "Handle in AI Lab →")
      )
    )
  );
}
