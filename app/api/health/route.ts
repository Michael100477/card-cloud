/**
 * Health check endpoint — pinged by Railway's deploy healthcheck and any
 * external uptime monitor. Returns 200 once the Next.js server can answer
 * HTTP, plus a quick DB ping so we fail loud if Postgres is unreachable.
 *
 * Keep this cheap. No auth, no logging.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
