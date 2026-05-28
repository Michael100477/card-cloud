import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ── Helpers ────────────────────────────────────────────────────────────────

function serializeListing(l: Record<string, unknown>) {
  return {
    ...l,
    price:         Number(l.price),
    commissionRate: Number(l.commissionRate),
    soldPrice:     l.soldPrice != null ? Number(l.soldPrice) : null,
    createdAt:     l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
    updatedAt:     l.updatedAt instanceof Date ? l.updatedAt.toISOString() : l.updatedAt,
    listedAt:      l.listedAt instanceof Date  ? (l.listedAt as Date).toISOString()  : (l.listedAt ?? null),
    soldAt:        l.soldAt   instanceof Date  ? (l.soldAt   as Date).toISOString()  : (l.soldAt   ?? null),
  };
}

// ── GET — public list of active listings ──────────────────────────────────

export async function GET() {
  const listings = await db.exchangeListing.findMany({
    where:   { status: "active" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    listings.map(l => serializeListing(l as unknown as Record<string, unknown>))
  );
}

// ── POST — create a listing from a user's card ────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { collectionCardId, price, description } = body;

  if (!collectionCardId || price == null) {
    return NextResponse.json(
      { error: "collectionCardId and price are required" },
      { status: 400 }
    );
  }

  // Verify the card exists and belongs to this user
  const card = await db.card.findUnique({
    where:  { id: collectionCardId },
    select: {
      ownerId:     true,
      player:      true,
      year:        true,
      manufacturer: true,
      set:         true,
      grade:       true,
      gradeCompany: true,
      conditionNotes: true,
      sport:       true,
      photos:      true,
    },
  });

  if (!card || card.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Determine commission rate from SiteSettings
  const soldCount = await db.exchangeListing.count({
    where: { sellerId: session.user.id, status: "sold" },
  });

  let commissionRate: string;
  if (soldCount >= 100) {
    const premierSetting = await db.siteSetting.findUnique({
      where: { key: "exchange_commission_premier" },
    });
    commissionRate = premierSetting?.value ?? "5";
  } else {
    const standardSetting = await db.siteSetting.findUnique({
      where: { key: "exchange_commission_standard" },
    });
    commissionRate = standardSetting?.value ?? "7";
  }

  // Build title from card data
  const title = [card.year ? String(card.year) : "", card.manufacturer ?? "", card.player]
    .filter(Boolean)
    .join(" ")
    .trim();

  const listing = await db.exchangeListing.create({
    data: {
      collectionCardId,
      sellerId:      session.user.id,
      title,
      description:   description ?? null,
      photos:        card.photos,
      player:        card.player,
      year:          card.year ?? null,
      manufacturer:  card.manufacturer ?? null,
      set:           card.set ?? null,
      grade:         card.grade ?? null,
      gradeCompany:  card.gradeCompany ?? null,
      condition:     card.conditionNotes ?? null,
      sport:         card.sport ?? null,
      graded:        !!card.grade,
      price,
      commissionRate: parseFloat(commissionRate),
      status:        "active",
    },
    select: { id: true },
  });

  return NextResponse.json({ id: listing.id }, { status: 201 });
}
