import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getAppId, getTradingApiUrl } from "@/lib/ebay-auth";
import { db } from "@/lib/db";

function xmlVal(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const { messageId, itemId, body, recipientId, subject } = await req.json() as {
      messageId:   string;
      itemId:      string | null;
      body:        string;
      recipientId: string;
      subject:     string;
    };

    if (!messageId || !body?.trim()) {
      return NextResponse.json({ error: "messageId and body are required" }, { status: 400 });
    }

    const [token, appId, tradingApiUrl] = await Promise.all([
      getAccessToken(), getAppId(), getTradingApiUrl(),
    ]);

    const escapedBody = body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageRTQRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>${itemId ? `
  <ItemID>${itemId}</ItemID>` : ""}
  <MemberMessage>
    <Body>${escapedBody}</Body>
    <ParentMessageID>${messageId}</ParentMessageID>${recipientId ? `
    <RecipientID>${recipientId}</RecipientID>` : ""}
  </MemberMessage>
</AddMemberMessageRTQRequest>`;

    const headers: Record<string, string> = {
      "X-EBAY-API-CALL-NAME":           "AddMemberMessageRTQ",
      "X-EBAY-API-SITEID":              "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1209",
      "Content-Type":                   "text/xml",
    };
    if (appId) headers["X-EBAY-API-APP-ID"] = appId;

    const r    = await fetch(tradingApiUrl, { method: "POST", headers, body: xml });
    const text = await r.text();

    const ack = xmlVal(text, "Ack");
    if (ack === "Failure" || ack === "PartialFailure") {
      const errMsg = xmlVal(text, "LongMessage") || xmlVal(text, "ShortMessage") || "eBay rejected the reply";
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    await db.ebaySentReply.create({
      data: {
        parentMessageId: messageId,
        itemId:          itemId ?? null,
        to:              recipientId,
        subject,
        body:            body.trim(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
