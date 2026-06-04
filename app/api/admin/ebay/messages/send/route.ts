/**
 * POST /api/admin/ebay/messages/send
 *
 * Sends a brand-new message to an eBay buyer about a specific listing.
 * Uses AddMemberMessageAAQToPartner — this is the right call for outbound
 * seller-to-buyer messages (the reply route uses AddMemberMessageRTQ which
 * requires a parent message).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getAppId, getTradingApiUrl } from "@/lib/ebay-auth";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

function xmlVal(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : "";
}
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  try {
    const { itemId, recipientId, subject, body } = await req.json() as {
      itemId:      string;
      recipientId: string;
      subject:     string;
      body:        string;
    };

    if (!itemId || !recipientId || !subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "itemId, recipientId, subject, and body are all required." }, { status: 400 });
    }

    const [token, appId, tradingApiUrl] = await Promise.all([
      getAccessToken(), getAppId(), getTradingApiUrl(),
    ]);

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageAAQToPartnerRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${xmlEscape(itemId)}</ItemID>
  <MemberMessage>
    <Subject>${xmlEscape(subject.trim())}</Subject>
    <Body>${xmlEscape(body.trim())}</Body>
    <QuestionType>General</QuestionType>
    <RecipientID>${xmlEscape(recipientId)}</RecipientID>
  </MemberMessage>
</AddMemberMessageAAQToPartnerRequest>`;

    const headers: Record<string, string> = {
      "X-EBAY-API-CALL-NAME":           "AddMemberMessageAAQToPartner",
      "X-EBAY-API-SITEID":              "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1209",
      "Content-Type":                   "text/xml",
    };
    if (appId) headers["X-EBAY-API-APP-ID"] = appId;

    const r    = await fetch(tradingApiUrl, { method: "POST", headers, body: xml });
    const text = await r.text();
    const ack  = xmlVal(text, "Ack");
    if (ack === "Failure" || ack === "PartialFailure") {
      const errMsg = xmlVal(text, "LongMessage") || xmlVal(text, "ShortMessage") || "eBay rejected the message";
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    await db.ebaySentReply.create({
      data: {
        parentMessageId: "",          // no parent — this is a new conversation
        itemId,
        to:              recipientId,
        subject:         subject.trim(),
        body:            body.trim(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
