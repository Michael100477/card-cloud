import { NextResponse } from "next/server";
import { getAccessToken, getAppId, getTradingApiUrl, getEbayConnectionStatus } from "@/lib/ebay-auth";
import { db } from "@/lib/db";

export interface EbayMessage {
  id:          string;
  subject:     string;
  body:        string;
  sender:      string;
  messageType: string;
  createdAt:   string;
  read:        boolean;
  itemId:      string | null;
  hasResponse: boolean;
  status:      string;
}

export interface EbaySentMessage {
  id:        string;
  body:      string;
  to:        string;
  subject:   string;
  sentAt:    string;
  itemId:    string | null;
  inReplyTo: string;
  source:    "ebay" | "local";
}

// ─── Simple XML helpers ───────────────────────────────────────────────────────

function xmlVal(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return "";
  return m[1]
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#13;/g, "")
    .trim();
}

function xmlAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, "g");
  return [...xml.matchAll(re)].map(m => m[0]);
}

function parseMessages(xml: string): EbayMessage[] {
  const exchanges = xmlAll(xml, "MemberMessageExchange");
  return exchanges.map(ex => {
    const id        = xmlVal(ex, "MessageID");
    const subject   = xmlVal(ex, "Subject");
    const body      = xmlVal(ex, "Body").slice(0, 2000);
    const sender    = xmlVal(ex, "SenderID");
    const msgType   = xmlVal(ex, "MessageType");
    const createdAt = xmlVal(ex, "CreationDate");
    const readRaw   = xmlVal(ex, "Read");
    const itemId    = xmlVal(ex, "ItemID") || null;
    const hasResp   = ex.includes("<Response>");
    const status    = xmlVal(ex, "MessageStatus") || "Unknown";
    return {
      id:          id || `${Date.now()}-${Math.random()}`,
      subject:     subject || "(no subject)",
      body,
      sender,
      messageType: msgType,
      createdAt,
      read:        readRaw.toLowerCase() === "true",
      itemId,
      hasResponse: hasResp,
      status,
    };
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [token, appId, tradingApiUrl, { seller: sellerUsername }] = await Promise.all([
      getAccessToken(), getAppId(), getTradingApiUrl(), getEbayConnectionStatus(),
    ]);

    const now    = new Date();
    const start  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <MailMessageType>All</MailMessageType>
  <StartCreationTime>${start.toISOString()}</StartCreationTime>
  <EndCreationTime>${now.toISOString()}</EndCreationTime>
  <Pagination>
    <EntriesPerPage>40</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
</GetMemberMessagesRequest>`;

    const headers: Record<string, string> = {
      "X-EBAY-API-CALL-NAME":              "GetMemberMessages",
      "X-EBAY-API-SITEID":                 "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL":    "1209",
      "Content-Type":                      "text/xml",
    };
    if (appId) headers["X-EBAY-API-APP-ID"] = appId;

    const r = await fetch(tradingApiUrl, { method: "POST", headers, body: xml });
    const text = await r.text();

    const ack = xmlVal(text, "Ack");
    if (ack === "Failure" || ack === "PartialFailure") {
      const errMsg = xmlVal(text, "LongMessage") || xmlVal(text, "ShortMessage") || "Unknown eBay error";
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const messages = parseMessages(text).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // ── Sent: Fetch full threads and extract every seller-sent message ────────
    const ebaySent: EbaySentMessage[] = [];
    const apiBase = tradingApiUrl.replace("/ws/api.dll", "");
    const convResp = await fetch(`${apiBase}/commerce/message/v1/conversation?limit=50`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (convResp.ok) {
      const convData = await convResp.json();
      type ConvItem = { conversationId: string; conversationType: string; referenceId?: string; latestMessage?: { recipientUsername?: string } };
      const memberConvs = ((convData.conversations ?? []) as ConvItem[]).filter(
        c => c.conversationType === "FROM_MEMBERS",
      );

      // Derive seller username: use DB value or fall back to most-common recipient
      let seller = sellerUsername;
      if (!seller && memberConvs.length > 0) {
        const counts: Record<string, number> = {};
        for (const c of memberConvs) {
          const u = c.latestMessage?.recipientUsername;
          if (u) counts[u] = (counts[u] ?? 0) + 1;
        }
        seller = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }

      if (seller) {
        // Fetch all conversation threads in parallel (note: conversation_type uses underscore — eBay API quirk)
        type MsgItem = { messageId: string; messageBody: string; senderUsername: string; recipientUsername: string; createdDate: string };
        type ThreadData = { messages?: MsgItem[] };
        const threads: Array<{ conv: ConvItem; thread: ThreadData | null }> = await Promise.all(
          memberConvs.map(async conv => {
            const r = await fetch(
              `${apiBase}/commerce/message/v1/conversation/${conv.conversationId}?conversation_type=FROM_MEMBERS&limit=50`,
              { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
            );
            return { conv, thread: r.ok ? (await r.json() as ThreadData) : null };
          }),
        );

        for (const { conv, thread } of threads) {
          if (!thread?.messages) continue;
          // Messages arrive newest-first; find all sent by the seller
          for (let i = 0; i < thread.messages.length; i++) {
            const msg = thread.messages[i];
            if (msg.senderUsername !== seller) continue;
            const prevMsg = thread.messages[i + 1]; // older message (what we replied to)
            ebaySent.push({
              id:        msg.messageId,
              body:      msg.messageBody ?? "",
              to:        msg.recipientUsername ?? "",
              subject:   conv.referenceId ? `Re: Item #${conv.referenceId}` : "eBay message",
              sentAt:    msg.createdDate,
              itemId:    conv.referenceId ?? null,
              inReplyTo: prevMsg?.messageBody?.slice(0, 200) ?? "",
              source:    "ebay",
            });
          }
        }
      }
    }

    // ── Local DB replies sent via admin dashboard ─────────────────────────────
    const sentRows = await db.ebaySentReply.findMany({
      orderBy: { sentAt: "desc" },
      take: 50,
    });
    const localSent: EbaySentMessage[] = sentRows.map(r => ({
      id:        r.id,
      body:      r.body,
      to:        r.to,
      subject:   r.subject,
      sentAt:    r.sentAt.toISOString(),
      itemId:    r.itemId,
      inReplyTo: messages.find(m => m.id === r.parentMessageId)?.body.slice(0, 200) ?? "",
      source:    "local",
    }));

    // Merge: eBay-sourced first, then local-only (dedup by conversationId isn't possible since
    // local rows have DB IDs, not conversationIds — show both, sort by date)
    const sent = [...ebaySent, ...localSent].sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
    );

    return NextResponse.json({ messages, total: messages.length, sent, sentTotal: sent.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
