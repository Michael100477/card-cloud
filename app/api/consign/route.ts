import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await db.consignmentOrder.findMany({
    where:   { userId: session.user.id },
    orderBy: { submittedAt: "desc" },
    include: {
      items: {
        select: {
          id: true, player: true, year: true, set: true,
          graded: true, grade: true, gradeCompany: true,
          status: true,
          listing: { select: { id: true, status: true, url: true, title: true, soldPrice: true } },
        },
      },
    },
  });

  return NextResponse.json(orders.map(o => ({
    ...o,
    submittedAt: o.submittedAt.toISOString(),
    updatedAt:   o.updatedAt.toISOString(),
    receivedAt:  o.receivedAt?.toISOString() ?? null,
    items: o.items.map(i => ({
      ...i,
      listing: i.listing ? {
        ...i.listing,
        soldPrice: i.listing.soldPrice ? Number(i.listing.soldPrice) : null,
      } : null,
    })),
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    items, notes,
    returnName, returnPhone,
    returnAddr1, returnAddr2, returnCity, returnState, returnZip, returnCountry,
  } = await req.json();
  if (!items?.length) return NextResponse.json({ error: "At least one card required" }, { status: 400 });

  // Look up photos for any cards already in the collection (server-side — not client-controlled)
  const cardIds = items.map((i: { cardId?: string }) => i.cardId).filter(Boolean) as string[];
  const cardPhotoMap = new Map<string, string[]>();
  if (cardIds.length > 0) {
    const cards = await db.card.findMany({
      where:  { id: { in: cardIds }, ownerId: session.user.id },
      select: { id: true, photos: true },
    });
    cards.forEach(c => cardPhotoMap.set(c.id, c.photos));
  }

  const order = await db.consignmentOrder.create({
    data: {
      userId:     session.user.id,
      adminNotes: notes ?? null,
      returnName:         returnName    ?? null,
      returnPhone:        returnPhone   ?? null,
      returnAddressLine1: returnAddr1   ?? null,
      returnAddressLine2: returnAddr2   ?? null,
      returnCity:         returnCity    ?? null,
      returnState:        returnState   ?? null,
      returnZip:          returnZip     ?? null,
      returnCountry:      returnCountry ?? null,
      items: {
        create: items.map((item: Record<string, unknown>) => ({
          cardId: item.cardId ?? null,
          photos: [
            ...((item.cardId ? cardPhotoMap.get(item.cardId as string) : null) ?? []),
            ...((item.clientPhotos as string[]) ?? []),
          ].filter((url: string, i: number, arr: string[]) => url && arr.indexOf(url) === i),
          player:       item.player,
          year:         item.year          ?? null,
          sport:        item.sport         ?? null,
          condition:    item.condition     ?? null,
          cardNumber:   item.cardNumber    ?? null,
          manufacturer: item.manufacturer  ?? null,
          set:          item.set           ?? null,
          subset:       item.subset        ?? null,
          graded:       item.graded        ?? false,
          grade:        item.grade         ?? null,
          gradeCompany: item.gradeCompany  ?? null,
          certNumber:   item.certNumber    ?? null,
          numbered:     item.numbered      ?? false,
          serialNumber: item.serialNumber  ?? null,
          autographed:  item.autographed   ?? false,
          signedBy:     item.signedBy      ?? null,
          autographAuthentication: item.autographAuthentication ?? null,
          autographAuthNumber:     item.autographAuthNumber     ?? null,
          autographFormat:         item.autographFormat         ?? null,
          listingType:  item.listingType   ?? "auction",
          desiredPrice: item.desiredPrice  ?? null,
          freeShipping: item.freeShipping  ?? true,
          allowOffers:  item.allowOffers   ?? false,
          minimumOffer: item.minimumOffer  ?? null,
          team:         item.team          ?? null,
          league:       item.league        ?? null,
          season:       item.season        ?? null,
          parallel:     item.parallel      ?? null,
          features:    (item.features as string[]) ?? [],
          cardName:     item.cardName      ?? null,
          cardType:     item.cardType      ?? null,
          cardSize:     item.cardSize      ?? null,
          countryOfOrigin: item.countryOfOrigin ?? null,
          upc:          item.upc           ?? null,
          notes:        item.notes         ?? null,
        })),
      },
    },
    include: { items: true },
  });

  logger.info({
    category: "activity", action: "consignment.submitted",
    message: `User submitted consignment order with ${items.length} card(s)`,
    userId: session.user.id, targetId: order.id, targetType: "order",
    data: { itemCount: items.length, orderRef: `CC-${order.id.slice(-8).toUpperCase()}` },
  });
  return NextResponse.json({ id: order.id });
}
