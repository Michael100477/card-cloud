import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { sendTransactionalEmail, listingsReadyHtml } from "@/lib/transactional-email";

export async function GET() {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const listings = await db.ebayListing.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      item: {
        select: {
          player: true, year: true, set: true, grade: true, gradeCompany: true,
          order: { select: { id: true, user: { select: { email: true, displayName: true, username: true } } } },
        },
      },
    },
  });

  return NextResponse.json(listings.map(l => ({
    ...l,
    startPrice:    Number(l.startPrice),
    buyItNowPrice: l.buyItNowPrice ? Number(l.buyItNowPrice) : null,
    soldPrice:     l.soldPrice ? Number(l.soldPrice) : null,
    createdAt:     l.createdAt.toISOString(),
    updatedAt:     l.updatedAt.toISOString(),
    listedAt:      l.listedAt?.toISOString() ?? null,
    soldAt:        l.soldAt?.toISOString() ?? null,
  })));
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const body = await req.json();
  const {
    consignmentItemId, title, subtitle, description, startPrice, buyItNowPrice, ebayListingId, url,
    condition, team, league, season, parallel, features, cardName, cardType, cardSize,
    countryOfOrigin, upc, signedBy, autographAuthentication, autographAuthNumber, autographFormat,
    allowOffers, minimumOffer, auctionDuration, categoryId, sport, listingType,
    conditionType, gradeCompanyEbay, gradeEbay, certNumberEbay, cardCondition,
    autographedEbay, material, reservePrice, scheduledTime, privateListing, shippingMethod, shippingCostType, flatRateShipping, excludedLocations, combinedShippingRule,
    playerOverride, yearOverride, manufacturerOverride, setOverride, cardNumberOverride,
    weightLbs, weightOz, dimLength, dimWidth, dimHeight,
    vintage, eventTournament, language, originalOrLicensed, californiaProp65,
    cardThickness, customized, insertSet, printRun, customSpecifics,
  } = body;

  if (!consignmentItemId || !title || !startPrice) {
    return NextResponse.json({ error: "consignmentItemId, title, startPrice required" }, { status: 400 });
  }

  // Build the data object once and use for both create and update (upsert)
  const listingData = {
      title,
      subtitle:      subtitle ?? null,
      description:   description ?? "",
      startPrice,
      buyItNowPrice: buyItNowPrice ?? null,
      ebayListingId: ebayListingId ?? null,
      url:           url ?? null,
      status:        url || ebayListingId ? "active" : "draft",
      listedAt:      url || ebayListingId ? new Date() : null,
      // Item specifics
      condition:               condition               ?? null,
      team:                    team                    ?? null,
      league:                  league                  ?? null,
      season:                  season                  ?? null,
      parallel:                parallel                ?? null,
      features:                features                ?? [],
      cardName:                cardName                ?? null,
      cardType:                cardType                ?? null,
      cardSize:                cardSize                ?? null,
      countryOfOrigin:         countryOfOrigin         ?? null,
      upc:                     upc                     ?? null,
      signedBy:                signedBy                ?? null,
      autographAuthentication: autographAuthentication ?? null,
      autographAuthNumber:     autographAuthNumber     ?? null,
      autographFormat:         autographFormat         ?? null,
      allowOffers:             allowOffers             ?? false,
      minimumOffer:            minimumOffer            ?? null,
      autoAcceptOffer:         body.autoAcceptOffer    ?? null,
      freeShipping:            body.freeShipping       ?? true,
      auctionDuration:         auctionDuration         ?? 7,
      categoryId:              categoryId              ?? "261328",
      sport:                   sport                   ?? null,
      listingType:             listingType             ?? "auction",
      autographedEbay:         autographedEbay         ?? null,
      playerOverride:          playerOverride          || null,
      yearOverride:            yearOverride            ? parseInt(yearOverride) : null,
      manufacturerOverride:    manufacturerOverride    || null,
      setOverride:             setOverride             || null,
      cardNumberOverride:      cardNumberOverride      || null,
      material:                material                ?? "Card Stock",
      reservePrice:            reservePrice            ?? null,
      scheduledTime:           scheduledTime ? new Date(scheduledTime) : null,
      privateListing:          privateListing          ?? false,
      shippingMethod:          shippingMethod          ?? "Standard shipping: Small to medium items",
      shippingCostType:        shippingCostType        ?? "Calculated: Cost varies based on buyer location",
      flatRateShipping:        flatRateShipping        ? parseFloat(flatRateShipping) : null,
      excludedLocations:       Array.isArray(excludedLocations) ? excludedLocations : [],
      combinedShippingRule:    combinedShippingRule    ?? "",
      weightLbs:               weightLbs != null ? parseInt(weightLbs) : 0,
      weightOz:                weightOz  != null ? parseFloat(weightOz) : 3,
      dimLength:               dimLength != null ? parseFloat(dimLength) : 11.0,
      dimWidth:                dimWidth  != null ? parseFloat(dimWidth)  : 6.0,
      dimHeight:               dimHeight != null ? parseFloat(dimHeight) : 1.0,
      conditionType:           conditionType           ?? null,
      gradeCompanyEbay:        gradeCompanyEbay        ?? null,
      gradeEbay:               gradeEbay               ?? null,
      certNumberEbay:          certNumberEbay          ?? null,
      cardCondition:           cardCondition           ?? null,
      vintage:                 vintage                 ?? false,
      eventTournament:         eventTournament         ?? null,
      language:                language                ?? "English",
      originalOrLicensed:      originalOrLicensed      ?? "Original",
      californiaProp65:        californiaProp65        ?? null,
      cardThickness:           cardThickness           ?? "35 pt.",
      customized:              customized              ?? false,
      insertSet:               insertSet               ?? null,
      printRun:                printRun                ?? null,
      customSpecifics:         customSpecifics         ?? [],
  };

  let listing;
  try {
    listing = await db.ebayListing.upsert({
      where:  { consignmentItemId },
      create: { consignmentItemId, ...listingData },
      update: listingData,
    });
  } catch (e) {
    console.error("[listings POST] Prisma error:", e);
    return NextResponse.json({ error: `Database error: ${String(e)}` }, { status: 500 });
  }

  // Sync item status with listing status:
  // - Draft listing → item goes back to "received" (shows in "Ready to list" with the form)
  // - Active listing → item is "listed" (shows in "Listed / Sold")
  await db.consignmentItem.update({
    where: { id: consignmentItemId },
    data:  { status: listing.status === "active" ? "listed" : "received" },
  });

  // Check if ALL items in the order are now listed — if so, send "listings ready" email
  const item = await db.consignmentItem.findUnique({
    where:   { id: consignmentItemId },
    select:  { orderId: true },
  });
  if (item) {
    const order = await db.consignmentOrder.findUnique({
      where:   { id: item.orderId },
      include: {
        user:  { select: { email: true, displayName: true, username: true } },
        items: {
          select: {
            id: true, player: true, status: true,
            listing: { select: { status: true, title: true, url: true, startPrice: true, buyItNowPrice: true } },
          },
        },
      },
    });
    if (order) {
      const allListed = order.items.every(i => i.status === "listed" || i.status === "sold");
      if (allListed) {
        const orderRef  = `CC-${item.orderId.slice(-8).toUpperCase()}`;
        const userName  = order.user.displayName ?? order.user.username ?? order.user.email;
        const appUrl    = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
        const listedItems = order.items.filter(i => i.listing);
        sendTransactionalEmail({
          to:      order.user.email,
          subject: `Your cards are live on eBay — ${orderRef}`,
          html:    listingsReadyHtml({
            userName, orderRef,
            trackUrl: `${appUrl}/dashboard/consignments/${item.orderId}`,
            listings: listedItems.map(i => ({
              player:       i.player,
              title:        i.listing!.title,
              url:          i.listing!.url,
              startPrice:   Number(i.listing!.startPrice),
              buyItNowPrice: i.listing!.buyItNowPrice ? Number(i.listing!.buyItNowPrice) : null,
            })),
          }),
        }).catch(console.error);

        await db.consignmentOrder.update({
          where: { id: item.orderId },
          data:  { status: "completed" },
        });
      }
    }
  }

  return NextResponse.json({ id: listing.id });
}
