import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const body    = await req.json();
  const session = await auth();

  const data: Record<string, unknown> = {};
  if (body.planTier   !== undefined) data.planTier   = body.planTier;
  if (body.isAdmin    !== undefined) data.isAdmin    = body.isAdmin;
  if (body.isPublic   !== undefined) data.isPublic   = body.isPublic;
  if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured;
  if (body.suspended  !== undefined) {
    data.suspended       = body.suspended;
    data.suspendedAt     = body.suspended ? new Date() : null;
    data.suspendedReason = body.suspended ? (body.suspendedReason ?? null) : null;
  }

  const user = await db.user.update({ where: { id }, data });

  // Log significant admin actions
  if (body.suspended !== undefined) {
    logger.warn({
      category: "admin", action: body.suspended ? "admin.user.suspended" : "admin.user.unsuspended",
      message: body.suspended ? `Admin suspended user (reason: ${body.suspendedReason ?? "none"})` : "Admin unsuspended user",
      userId: session?.user?.id, targetId: id, targetType: "user",
      data: { reason: body.suspendedReason },
    });
  }
  if (body.planTier !== undefined) {
    logger.info({
      category: "admin", action: "admin.user.plan_changed",
      message: `Admin changed user plan to ${body.planTier}`,
      userId: session?.user?.id, targetId: id, targetType: "user",
      data: { planTier: body.planTier },
    });
  }
  if (body.isAdmin !== undefined) {
    logger.warn({
      category: "admin", action: "admin.user.admin_toggled",
      message: `Admin ${body.isAdmin ? "granted" : "revoked"} admin access`,
      userId: session?.user?.id, targetId: id, targetType: "user",
    });
  }

  return NextResponse.json({ ok: true, id: user.id });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id }     = await params;
  const session    = await auth();
  if (session?.user?.id === id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }
  const target = await db.user.findUnique({ where: { id }, select: { email: true } });
  await db.user.delete({ where: { id } });
  logger.warn({
    category: "admin", action: "admin.user.deleted",
    message: `Admin deleted user account (${target?.email ?? id})`,
    userId: session?.user?.id, targetId: id, targetType: "user",
    data: { email: target?.email },
  });
  return NextResponse.json({ ok: true });
}
