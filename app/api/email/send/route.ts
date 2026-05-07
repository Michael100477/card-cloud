import { NextRequest, NextResponse } from "next/server";
import { sendDraftEmail } from "@/lib/email-agent";

export async function POST(req: NextRequest) {
  const { threadId, toEmail } = await req.json();
  if (!threadId || !toEmail) return NextResponse.json({ error: "threadId and toEmail required" }, { status: 400 });
  try {
    await sendDraftEmail(threadId, toEmail);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
