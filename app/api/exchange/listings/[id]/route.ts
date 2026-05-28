import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ── Helpers ────────────────────────────────────────────────────────────────

function serializeListing(l: Record<string, unknown>) {
  return {
    ...l,
    price:          Number(l.price),
    commissionRate: Number(l.commissionRate),
    soldPrice:      l.soldPrice != null ? Number(l.soldPrice) : null,
    createdAt:      l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
    updatedAt:      l.updatedAt instanceof Date ? l.updatedAt.toISOString() : l.updatedAt,
    listedAt:       l.listedAt instanceof Date  ? (l.listedAt as Date).toISOString()  : (l.listedAt ?? null),
    soldAt:         l.soldAt   instanceof Date  ? (l.soldAt   as Date).toISOString()  : (l.soldAt   ?? null),
  };
}

type RouteContext = { params: Promise<{ id: string }> };

// ── GET — single listing ───────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const listing = await db.exchangeListing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(serializeListing(listing as unknown as Record<string, unknown>));
}

// ── PATCH — update price, description, or status ──────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const listing = await db.exchangeListing.findUnique({
    where:  { id },
    select: { sellerId: true, status: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner   = listing.sellerId === session.user.id;
  const isAdmin   = (session.user as { isAdmin?: boolean }).isAdmin === true;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.price       !== undefined) data.price       = body.price;
  if (body.description !== undefined) data.description = body.description;
  if (body.status      !== undefined) data.status      = body.status;

  const updated = await db.exchangeListing.update({ where: { id }, data });

  return NextResponse.json(serializeListing(updated as unknown as Record<string, unknown>));
}

// ── DELETE — remove listing (not if sold) ─────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const listing = await db.exchangeListing.findUnique({
    where:  { id },
    select: { sellerId: true, status: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = listing.sellerId === session.user.id;
  const isAdmin = (session.user as { isAdmin?: boolean }).isAdmin === true;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (listing.status === "sold") {
    return NextResponse.json({ error: "Cannot delete a sold listing" }, { status: 409 });
  }

  await db.exchangeListing.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
