import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CronExpressionParser } from "cron-parser";

/** Local agent runner polls this endpoint every minute. Returns the list of
 *  agents that need to be dispatched right now — either because their
 *  `run_pending` flag is set (immediate Run Now), or because their cron
 *  schedule fired since the last recorded run.
 *
 *  Authenticated via Bearer token shared between Card Cloud and the runner.
 *  The token lives in site_credentials as `agent_runner_token` — anyone
 *  with it can dispatch runs, so treat it like a service account. */
export async function GET(req: NextRequest) {
  const auth = await checkAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  // Read every agent_* setting in one go
  const settings = await db.siteSetting.findMany({
    where: { key: { startsWith: "agent_" } },
    select: { key: true, value: true },
  });
  const settingMap = new Map(settings.map(s => [s.key, s.value]));

  // Walk all known agent ids by looking for *_run_pending OR *_schedule_cron
  const agentIds = new Set<string>();
  for (const k of settingMap.keys()) {
    const m = k.match(/^agent_(.+?)_(?:run_pending|schedule_cron)$/);
    if (m) agentIds.add(m[1]);
  }

  const due: Array<{ agentId: string; script: string; options: Record<string,string>; reason: "pending" | "scheduled" }> = [];

  for (const agentId of agentIds) {
    // (1) Immediate Run Now — `run_pending` is set to a timestamp
    const pending = settingMap.get(`agent_${agentId}_run_pending`);
    if (pending) {
      const optsRaw = settingMap.get(`agent_${agentId}_run_options`) ?? "{}";
      const { script = "", options = {} } = safeJson(optsRaw);
      if (script) due.push({ agentId, script, options, reason: "pending" });
      continue;  // don't also fire scheduled on the same poll
    }

    // (2) Scheduled — cron + enabled, fire if cron's previous expected fire
    //     time is after the last_run_at we have on record
    const enabled = settingMap.get(`agent_${agentId}_schedule_enabled`) === "true";
    const cron    = settingMap.get(`agent_${agentId}_schedule_cron`) ?? "";
    if (!enabled || !cron) continue;

    let prevFire: Date;
    try {
      const it = CronExpressionParser.parse(cron, { currentDate: new Date() });
      prevFire = it.prev().toDate();
    } catch { continue; /* invalid cron */ }

    const lastRunAt = settingMap.get(`agent_${agentId}_last_run_at`);
    const lastRunMs = lastRunAt ? Date.parse(lastRunAt) : 0;
    if (prevFire.getTime() > lastRunMs) {
      const optsRaw = settingMap.get(`agent_${agentId}_schedule_options`) ?? "{}";
      const { script = "", options = {} } = safeJson(optsRaw);
      if (script) due.push({ agentId, script, options, reason: "scheduled" });
    }
  }

  // Acknowledge each pending agent by clearing its run_pending flag so the
  // runner doesn't see it twice if its result post is delayed
  for (const d of due.filter(d => d.reason === "pending")) {
    await db.siteSetting.deleteMany({ where: { key: `agent_${d.agentId}_run_pending` } }).catch(() => {});
  }

  return NextResponse.json({ due, polledAt: new Date().toISOString() });
}

async function checkAuth(req: NextRequest): Promise<{ ok: true } | { ok: false; error: string }> {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) return { ok: false, error: "Missing bearer token" };

  const row = await db.siteCredential.findUnique({
    where: { service: "agent_runner_token" },
    select: { value: true },
  });
  if (!row?.value) return { ok: false, error: "Agent runner token not configured on server" };
  if (m[1] !== row.value) return { ok: false, error: "Invalid bearer token" };
  return { ok: true };
}

function safeJson(s: string): { script?: string; options?: Record<string,string> } {
  try { return JSON.parse(s); } catch { return {}; }
}
