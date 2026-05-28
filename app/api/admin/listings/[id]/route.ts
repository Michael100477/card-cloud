import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status        !== undefined) data.status        = body.status;
  if (body.url           !== undefined) data.url           = body.url;
  if (body.ebayListingId !== undefined) data.ebayListingId = body.ebayListingId;
  if (body.soldPrice     !== undefined) data.soldPrice     = body.soldPrice;
  if (body.title         !== undefined) data.title         = body.title;
  if (body.description   !== undefined) data.description   = body.description;
  if (body.buyItNowPrice !== undefined) data.buyItNowPrice = body.buyItNowPrice;

  if (body.status === "active" && !body.listedAt) data.listedAt = new Date();
  if (body.status === "sold") {
    data.soldAt = new Date();
    // Mark the consignment item as sold too
    const listing = await db.ebayListing.findUnique({ where: { id }, select: { consignmentItemId: true } });
    if (listing) {
      await db.consignmentItem.update({ where: { id: listing.consignmentItemId }, data: { status: "sold" } });
    }
  }

  const listing = await db.ebayListing.update({ where: { id }, data });
  return NextResponse.json({ ok: true, status: listing.status });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;

  const listing = await db.ebayListing.findUnique({
    where:  { id },
    select: { status: true, consignmentItemId: true },
  });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.status === "active") {
    return NextResponse.json({ error: "Cannot delete an active eBay listing — end it on eBay first." }, { status: 400 });
  }

  await db.ebayListing.delete({ where: { id } });

  // Revert consignment item back to "received" so it can be listed again
  await db.consignmentItem.update({
    where: { id: listing.consignmentItemId },
    data:  { status: "received" },
  });

  return NextResponse.json({ ok: true });
}
