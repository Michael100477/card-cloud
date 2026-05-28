import { NextRequest, NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/lib/transactional-email";

const SUPPORT_EMAIL = "support@thecardcloud.com";

export async function POST(req: NextRequest) {
  const { name, email, subject, message } = await req.json();

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const subjectLine = subject?.trim() || "New contact form submission";

  // Send to support inbox
  await sendTransactionalEmail({
    to: SUPPORT_EMAIL,
    subject: `[Contact] ${subjectLine} — from ${name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0f1c3f; margin-bottom: 4px;">New message from the contact form</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 0;">The Card Cloud — contact@thecardcloud.com</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #64748b; width: 80px; vertical-align: top;">From</td><td style="padding: 6px 0; color: #0f1c3f; font-weight: 600;">${name} &lt;${email}&gt;</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b; vertical-align: top;">Subject</td><td style="padding: 6px 0; color: #0f1c3f;">${subjectLine}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <h3 style="color: #0f1c3f; font-size: 14px; margin-bottom: 8px;">Message</h3>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">Reply directly to this email to respond to ${name}.</p>
      </div>
    `,
  });

  // Send confirmation to the sender
  await sendTransactionalEmail({
    to: email,
    subject: "We received your message — The Card Cloud",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0f1c3f;">Thanks for reaching out, ${name}!</h2>
        <p style="color: #334155; line-height: 1.6;">We've received your message and will get back to you as soon as possible — usually within 1–2 business days.</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; color: #64748b; font-size: 14px;">
          <strong style="color: #0f1c3f;">Your message:</strong><br/><br/>
          <span style="white-space: pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
        </div>
        <p style="color: #334155;">If your question is urgent you can also reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563eb;">${SUPPORT_EMAIL}</a>.</p>
        <p style="color: #64748b; font-size: 13px; margin-top: 32px;">— The Card Cloud Team</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
