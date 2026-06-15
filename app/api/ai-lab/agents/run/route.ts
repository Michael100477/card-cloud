import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

/** Queue an immediate run of an AI Lab agent. Marks pending in site_settings
 *  so the local agent runner sees it on its next poll and dispatches the
 *  actual work. */
export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { agentId, script, options } = body as { agentId?: string; script?: string; options?: Record<string, string> };
  if (!agentId || !script) {
    return NextResponse.json({ error: "agentId and script are required" }, { status: 400 });
  }

  const pendingKey = `agent_${agentId}_run_pending`;
  const optionsKey = `agent_${agentId}_run_options`;
  await Promise.all([
    db.siteSetting.upsert({
      where:  { key: pendingKey },
      update: { value: new Date().toISOString() },
      create: { key: pendingKey, value: new Date().toISOString() },
    }),
    db.siteSetting.upsert({
      where:  { key: optionsKey },
      update: { value: JSON.stringify({ script, options: options ?? {} }) },
      create: { key: optionsKey, value: JSON.stringify({ script, options: options ?? {} }) },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    message: "Queued. The local agent runner will pick this up within ~60 seconds.",
  });
}
