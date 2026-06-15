import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

/** Save a cron schedule for an AI Lab agent. The local agent runner reads
 *  these on startup + periodically, and dispatches the script when each
 *  schedule fires. */
export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { agentId, script, cron, enabled, options } = body as {
    agentId?: string; script?: string; cron?: string; enabled?: boolean; options?: Record<string, string>;
  };
  if (!agentId || !script) {
    return NextResponse.json({ error: "agentId and script are required" }, { status: 400 });
  }

  await Promise.all([
    db.siteSetting.upsert({
      where:  { key: `agent_${agentId}_schedule_cron` },
      update: { value: cron ?? "" },
      create: { key: `agent_${agentId}_schedule_cron`, value: cron ?? "" },
    }),
    db.siteSetting.upsert({
      where:  { key: `agent_${agentId}_schedule_enabled` },
      update: { value: enabled ? "true" : "false" },
      create: { key: `agent_${agentId}_schedule_enabled`, value: enabled ? "true" : "false" },
    }),
    db.siteSetting.upsert({
      where:  { key: `agent_${agentId}_schedule_options` },
      update: { value: JSON.stringify({ script, options: options ?? {} }) },
      create: { key: `agent_${agentId}_schedule_options`, value: JSON.stringify({ script, options: options ?? {} }) },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
