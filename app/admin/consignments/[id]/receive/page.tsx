import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";
import { verifyReceiveToken } from "@/lib/receive-token";

interface Props {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ sig?: string }>;
}

export default async function ReceiveOrderPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    const { id } = await params;
    const { sig } = await searchParams;
    redirect(`/login?callbackUrl=/admin/consignments/${id}/receive?sig=${sig}`);
  }

  if (!(await isAdminUser(session.user.id))) {
    redirect("/dashboard");
  }

  const { id }  = await params;
  const { sig } = await searchParams;

  if (!sig || !verifyReceiveToken(id, sig)) {
    redirect(`/admin/consignments/${id}`);
  }

  const order = await db.consignmentOrder.findUnique({
    where:  { id },
    select: { id: true, status: true, receiptCode: true },
  });

  if (!order) redirect("/admin/consignments");

  // Only update if still pending — idempotent so double-scans are safe
  if (order.status === "pending") {
    const receiptCode = order.receiptCode ?? `CC-${id.slice(-8).toUpperCase()}`;
    await db.consignmentOrder.update({
      where: { id },
      data: {
        status:      "received",
        receivedAt:  new Date(),
        receiptCode,
      },
    });
  }

  redirect(`/admin/consignments/${id}`);
}
