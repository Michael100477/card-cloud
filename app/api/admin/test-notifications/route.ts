import { NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/lib/transactional-email";

export async function POST() {
  const msg = "Test from Card Cloud — text notifications are working.";
  try {
    await sendTransactionalEmail({
      to:      "8604812787@vtext.com",
      subject: "",
      html:    msg,
      text:    msg,
    });
    return NextResponse.json({ result: "sent to 8604812787@vtext.com" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
