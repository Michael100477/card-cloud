import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminUser } from "@/lib/admin";
import { buildAuthUrl } from "@/lib/ebay-auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

const BASE = process.env.NEXTAUTH_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Which environment to connect — passed explicitly from the connect button
  const env = (req.nextUrl.searchParams.get("env") ?? "sandbox") as "sandbox" | "production";

  const state   = randomBytes(16).toString("hex");
  const authUrl = await buildAuthUrl(state, env);

  if (!authUrl) {
    return NextResponse.redirect(`${BASE}/admin/credentials?ebay_error=missing_credentials&env=${env}`);
  }

  // Store both state (CSRF) and the chosen env so the callback knows where to save tokens
  await Promise.all([
    db.siteSetting.upsert({
      where:  { key: "ebay_oauth_state" },
      update: { value: state },
      create: { key: "ebay_oauth_state", value: state },
    }),
    db.siteSetting.upsert({
      where:  { key: "ebay_oauth_env" },
      update: { value: env },
      create: { key: "ebay_oauth_env", value: env },
    }),
  ]);

  return NextResponse.redirect(authUrl);
}
