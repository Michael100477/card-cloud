import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/ebay-auth";
import { db } from "@/lib/db";

const BASE      = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
const CREDS_URL = `${BASE}/admin/credentials`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Read which environment was being authorised
  const envRow     = await db.siteSetting.findUnique({ where: { key: "ebay_oauth_env" } });
  const env        = (envRow?.value ?? "sandbox") as "sandbox" | "production";
  const envParam   = `&env=${env}`;

  if (error) {
    await db.siteSetting.delete({ where: { key: "ebay_oauth_env" } }).catch(() => null);
    return NextResponse.redirect(`${CREDS_URL}?ebay_error=${encodeURIComponent(error)}${envParam}`);
  }

  if (!code) {
    return NextResponse.redirect(`${CREDS_URL}?ebay_error=no_code${envParam}`);
  }

  // Verify CSRF state
  const storedRow   = await db.siteSetting.findUnique({ where: { key: "ebay_oauth_state" } });
  if (!storedRow?.value || storedRow.value !== state) {
    return NextResponse.redirect(`${CREDS_URL}?ebay_error=invalid_state${envParam}`);
  }

  // Clean up state and env records (one-time use)
  await Promise.all([
    db.siteSetting.delete({ where: { key: "ebay_oauth_state" } }).catch(() => null),
    db.siteSetting.delete({ where: { key: "ebay_oauth_env"   } }).catch(() => null),
  ]);

  const result = await exchangeCode(code, env);

  return NextResponse.redirect(
    result.ok
      ? `${CREDS_URL}?ebay_connected=1${envParam}`
      : `${CREDS_URL}?ebay_error=${encodeURIComponent(result.error ?? "unknown")}${envParam}`
  );
}
