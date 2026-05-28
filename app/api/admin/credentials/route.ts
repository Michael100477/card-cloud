import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { service, label, value, group } = await req.json();
  if (!service || !label) return NextResponse.json({ error: "service and label required" }, { status: 400 });

  const cred = await db.siteCredential.upsert({
    where:  { service },
    update: { value: value ?? "", label, ...(group !== undefined && { group }) },
    create: { service, label, value: value ?? "", group: group ?? null },
  });
  return NextResponse.json({ ok: true, service: cred.service });
}

export async function DELETE(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { service } = await req.json();
  if (!service) return NextResponse.json({ error: "service required" }, { status: 400 });

  await db.siteCredential.deleteMany({ where: { service } });
  return NextResponse.json({ ok: true });
}
