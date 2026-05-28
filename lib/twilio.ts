import { db } from "@/lib/db";

async function getTwilioCreds(): Promise<{ accountSid: string; authToken: string; fromNumber: string } | null> {
  const rows = await db.siteCredential.findMany({
    where: { service: { in: ["twilio_account_sid", "twilio_auth_token", "twilio_from_number"] } },
  });
  const get = (key: string) => rows.find(r => r.service === key)?.value ?? "";
  const accountSid  = get("twilio_account_sid");
  const authToken   = get("twilio_auth_token");
  const fromNumber  = get("twilio_from_number");
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

function twilioAuth(accountSid: string, authToken: string): string {
  return "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
}

export async function sendSms(to: string, body: string): Promise<void> {
  const creds = await getTwilioCreds();
  if (!creds) { console.warn("[twilio] SMS skipped — credentials not configured"); return; }
  const { accountSid, authToken, fromNumber } = creds;
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method:  "POST",
      headers: { Authorization: twilioAuth(accountSid, authToken), "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    },
  );
  if (!r.ok) {
    const err = await r.text();
    console.error("[twilio] SMS failed:", err);
  }
}

export async function makeCall(to: string, message: string): Promise<void> {
  const creds = await getTwilioCreds();
  if (!creds) { console.warn("[twilio] Call skipped — credentials not configured"); return; }
  const { accountSid, authToken, fromNumber } = creds;
  const twiml = `<Response><Say voice="alice" loop="2">${message}</Say></Response>`;
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method:  "POST",
      headers: { Authorization: twilioAuth(accountSid, authToken), "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({ To: to, From: fromNumber, Twiml: twiml }),
    },
  );
  if (!r.ok) {
    const err = await r.text();
    console.error("[twilio] Call failed:", err);
  }
}
