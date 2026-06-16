import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Local agent runner POSTs here after a script completes. Stores the final
 *  status + log so the admin UI can display it. */
export async function POST(req: NextRequest) {
  const auth = await checkAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { agentId, status, log, startedAt, finishedAt } = body as {
    agentId?: string; status?: "success" | "failed"; log?: string; startedAt?: string; finishedAt?: string;
  };
  if (!agentId || !status) {
    return NextResponse.json({ error: "agentId and status are required" }, { status: 400 });
  }

  // Cap the log at ~50 KB so a runaway agent doesn't blow up site_settings
  const cappedLog = (log ?? "").slice(-50_000);
  const ts = finishedAt || new Date().toISOString();

  await Promise.all([
    upsert(`agent_${agentId}_last_run_at`,  ts),
    upsert(`agent_${agentId}_last_status`,  status),
    upsert(`agent_${agentId}_last_log`,     cappedLog),
    startedAt ? upsert(`agent_${agentId}_last_started_at`, startedAt) : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}

async function upsert(key: string, value: string) {
  return db.siteSetting.upsert({
    where:  { key },
    update: { value },
    create: { key, value },
  });
}

async function checkAuth(req: NextRequest): Promise<{ ok: true } | { ok: false; error: string }> {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) return { ok: false, error: "Missing bearer token" };
  const row = await db.siteCredential.findUnique({
    where: { service: "agent_runner_token" },
    select: { value: true },
  });
  if (!row?.value) return { ok: false, error: "Agent runner token not configured" };
  if (m[1] !== row.value) return { ok: false, error: "Invalid bearer token" };
  return { ok: true };
}
