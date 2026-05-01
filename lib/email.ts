import { Resend } from "resend";
import * as React from "react";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM ?? "The Card Cloud <onboarding@resend.dev>";

interface SendResult {
  success: boolean;
  error?: string;
}

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}): Promise<SendResult> {
  // In development with no key set, log instead of sending
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email - no key] To: ${to} | Subject: ${subject}`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, react });
    if (error) {
      console.error("[sendEmail]", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("[sendEmail]", err);
    return { success: false, error: "Failed to send email." };
  }
}
