/**
 * Email provider abstraction.
 *
 * Switch providers by setting EMAIL_PROVIDER in your .env:
 *
 *   EMAIL_PROVIDER=resend   → Resend (default, free tier 3k/mo)
 *   EMAIL_PROVIDER=smtp     → Any SMTP server: Office 365, Gmail, etc.
 *   EMAIL_PROVIDER=console  → Prints to terminal (no emails sent, good for dev)
 *
 * If EMAIL_PROVIDER is not set, it auto-detects: Resend if RESEND_API_KEY
 * is present, otherwise Console.
 */

import * as React from "react";

export interface SendEmailOptions {
  to: string;
  subject: string;
  react: React.ReactElement;
}

interface SendResult {
  success: boolean;
  error?: string;
}

// ─── Resend ───────────────────────────────────────────────────────────────────

async function sendViaResend({ to, subject, react }: SendEmailOptions): Promise<SendResult> {
  const { Resend } = await import("resend");
  const client = new Resend(process.env.RESEND_API_KEY);
  const from   = process.env.EMAIL_FROM ?? "The Card Cloud <onboarding@resend.dev>";

  const { error } = await client.emails.send({ from, to, subject, react });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── SMTP (Office 365, Gmail, any SMTP server) ────────────────────────────────
// Required env vars:
//   SMTP_HOST   e.g. smtp.office365.com  |  smtp.gmail.com
//   SMTP_PORT   e.g. 587 (TLS) or 465 (SSL)
//   SMTP_SECURE true for port 465, false for 587
//   SMTP_USER   your email address
//   SMTP_PASS   your password or app password

async function sendViaSmtp({ to, subject, react }: SendEmailOptions): Promise<SendResult> {
  const nodemailer        = await import("nodemailer");
  const { render }        = await import("@react-email/render");
  const from              = process.env.EMAIL_FROM ?? "The Card Cloud <noreply@thecardcloud.com>";

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const html = await render(react);
  await transporter.sendMail({ from, to, subject, html });
  return { success: true };
}

// ─── Console (dev fallback) ───────────────────────────────────────────────────

async function sendViaConsole({ to, subject }: SendEmailOptions): Promise<SendResult> {
  console.log(`\n┌─── [Email: Console provider] ──────────────────`);
  console.log(`│ To:      ${to}`);
  console.log(`│ Subject: ${subject}`);
  console.log(`└────────────────────────────────────────────────\n`);
  return { success: true };
}

// ─── Router — picks the active provider ──────────────────────────────────────

function resolveProvider(): "resend" | "smtp" | "console" {
  const explicit = process.env.EMAIL_PROVIDER;
  if (explicit === "resend" || explicit === "smtp" || explicit === "console") {
    return explicit;
  }
  // Auto-detect from which credentials are present
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST)      return "smtp";
  return "console";
}

export async function sendEmail(options: SendEmailOptions): Promise<SendResult> {
  const provider = resolveProvider();

  try {
    switch (provider) {
      case "smtp":    return await sendViaSmtp(options);
      case "console": return await sendViaConsole(options);
      default:        return await sendViaResend(options);
    }
  } catch (err) {
    console.error(`[sendEmail/${provider}]`, err);
    return { success: false, error: "Failed to send email." };
  }
}
