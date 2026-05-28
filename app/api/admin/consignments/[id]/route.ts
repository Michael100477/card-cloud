import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { sendTransactionalEmail, consignmentReceivedHtml } from "@/lib/transactional-email";
import { logger } from "@/lib/logger";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;

  const order = await db.consignmentOrder.findUnique({
    where:   { id },
    include: { items: { include: { listing: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const activeListings = order.items.filter(i => i.listing?.status === "active");
  if (activeListings.length > 0) {
    return NextResponse.json({
      error: `Cannot delete — ${activeListings.length} item(s) are currently live on eBay. End those listings first.`,
    }, { status: 400 });
  }

  await db.consignmentOrder.delete({ where: { id } });

  logger.info({
    category: "admin", action: "consignment.deleted",
    message: `Consignment order deleted (${order.items.length} item(s))`,
    targetId: id, targetType: "order",
  });

  revalidatePath("/admin/consignments");
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const order = await db.consignmentOrder.findUnique({
    where:   { id },
    include: {
      user:  { select: { id: true, email: true, displayName: true, username: true } },
      items: { include: { listing: true }, orderBy: { id: "asc" } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const wasAlreadyReceived = body.status !== "received";

  const data: Record<string, unknown> = {};
  if (body.status      !== undefined) data.status      = body.status;
  if (body.receiptCode !== undefined) data.receiptCode = body.receiptCode;
  if (body.adminNotes  !== undefined) data.adminNotes  = body.adminNotes;
  if (body.status === "received")     data.receivedAt  = new Date();

  const order = await db.consignmentOrder.update({
    where:   { id },
    data,
    include: {
      user:  { select: { email: true, displayName: true, username: true } },
      items: { select: { id: true } },
    },
  });

  // Send "order received" email the first time status is set to received
  if (body.status === "received" && wasAlreadyReceived) {
    const orderRef = `CC-${id.slice(-8).toUpperCase()}`;
    const userName = order.user.displayName ?? order.user.username ?? order.user.email;
    const appUrl   = process.env.NEXTAUTH_URL ?? "http://localhost:3001";

    sendTransactionalEmail({
      to:      order.user.email,
      subject: `We've received your consignment — ${orderRef}`,
      html:    consignmentReceivedHtml({
        userName,
        orderRef,
        receiptCode: body.receiptCode ?? "",
        itemCount:   order.items.length,
        trackUrl:    `${appUrl}/dashboard/consignments/${id}`,
      }),
    }).catch(console.error);
  }

  if (body.status === "received" && wasAlreadyReceived) {
    logger.info({
      category: "activity", action: "consignment.received",
      message: `Consignment order marked received (${order.items.length} card(s)) — ref CC-${id.slice(-8).toUpperCase()}`,
      targetId: id, targetType: "order",
      data: { receiptCode: body.receiptCode, itemCount: order.items.length },
    });
  }
  return NextResponse.json({ ok: true, status: order.status });
}
