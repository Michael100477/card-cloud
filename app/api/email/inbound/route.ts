/**
 * Inbound email webhook — receives emails forwarded by Resend or another provider.
 *
 * Setup in Resend dashboard:
 *   Domains → your domain → Inbound → Add webhook
 *   URL: https://thecardcloud.com/api/email/inbound
 *   (or ngrok tunnel for local testing)
 *
 * For local testing with ngrok:
 *   ngrok http 3001
 *   Use the https:// URL as the Resend inbound webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { handleInboundEmail } from "@/lib/email-agent";

// Resend signs inbound webhooks — verify in production
const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  // Optional signature verification
  if (WEBHOOK_SECRET) {
    const sig = req.headers.get("resend-signature") ?? "";
    if (!sig.includes(WEBHOOK_SECRET)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Normalise across providers — handles both IMAP poller format and Resend webhook format
  const email = {
    fromEmail: String(payload.fromEmail ?? payload.from ?? payload.sender ?? ""),
    fromName:  String(payload.fromName  ?? payload.from_name ?? payload.senderName ?? ""),
    subject:   String(payload.subject   ?? "No subject"),
    body:      String(payload.body      ?? payload.text ?? payload.plain_text ?? payload.html ?? ""),
    messageId: String(payload.messageId ?? payload.message_id ?? payload.id ?? ""),
    inReplyTo: String(payload.inReplyTo ?? payload.in_reply_to ?? ""),
  };

  if (!email.fromEmail) {
    return NextResponse.json({ error: "Missing from address" }, { status: 400 });
  }

  try {
    const result = await handleInboundEmail(email);
    console.log(`[email-agent] Thread ${result.threadId}: escalated=${result.escalated}, replied=${result.autoReplied}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[email-agent inbound]", err);
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
