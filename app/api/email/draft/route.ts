import { NextRequest, NextResponse } from "next/server";
import { draftOutboundEmail } from "@/lib/email-agent";

export async function POST(req: NextRequest) {
  const { toEmail, company, purpose, keyPoints, tone } = await req.json();
  if (!toEmail || !purpose) return NextResponse.json({ error: "toEmail and purpose required" }, { status: 400 });
  try {
    const result = await draftOutboundEmail({ toEmail, company, purpose, keyPoints, tone });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
