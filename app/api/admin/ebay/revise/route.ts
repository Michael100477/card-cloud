import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { reviseEbayListing, type EbayListingInput } from "@/lib/ebay-api";

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const { listingDbId } = await req.json();
  if (!listingDbId) return NextResponse.json({ error: "listingDbId required" }, { status: 400 });

  const listing = await db.ebayListing.findUnique({
    where:   { id: listingDbId },
    include: { item: true },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.status !== "active") {
    return NextResponse.json({ error: "Listing is not active — use List on eBay to publish it" }, { status: 400 });
  }

  const item = listing.item;

  const input: EbayListingInput = {
    listingDbId,
    sku:           item.id,
    title:         listing.title,
    subtitle:      listing.subtitle,
    description:   listing.description,
    cardName:      listing.cardName,
    signedBy:      listing.signedBy,
    autographAuthentication: listing.autographAuthentication,
    autographFormat:         listing.autographFormat,
    startPrice:    Number(listing.startPrice),
    buyItNowPrice: listing.buyItNowPrice ? Number(listing.buyItNowPrice) : null,
    freeShipping:  listing.freeShipping,
    allowOffers:   listing.allowOffers,
    minimumOffer:   listing.minimumOffer    ? Number(listing.minimumOffer)    : null,
    autoAcceptOffer: listing.autoAcceptOffer ? Number(listing.autoAcceptOffer) : null,
    condition:     listing.condition   ?? item.condition,
    cardType:      listing.cardType    ?? item.cardType,
    cardSize:      listing.cardSize    ?? item.cardSize,
    countryOfOrigin: listing.countryOfOrigin ?? item.countryOfOrigin,
    features:      listing.features.length ? listing.features : item.features,
    photos:        item.photos,
    player:        listing.playerOverride       || item.player,
    year:          listing.yearOverride         ?? item.year,
    manufacturer:  listing.manufacturerOverride || item.manufacturer,
    set:           listing.setOverride          || item.set,
    cardNumber:    listing.cardNumberOverride   || item.cardNumber,
    sport:         listing.sport        || item.sport,
    listingType:   listing.listingType  || item.listingType,
    subset:        listing.parallel ?? item.subset,
    team:          listing.team    ?? item.team,
    league:        listing.league  ?? item.league,
    season:        listing.season  ?? item.season,
    parallel:      listing.parallel ?? item.parallel,
    graded:        item.graded,
    grade:         item.grade,
    gradeCompany:  item.gradeCompany,
    certNumber:    item.certNumber,
    serialNumber:  item.serialNumber,
    autographed:          listing.autographedEbay ?? item.autographed,
    material:             listing.material,
    scheduledTime:        listing.scheduledTime?.toISOString() ?? null,
    privateListing:       listing.privateListing ?? false,
    shippingMethod:       listing.shippingMethod   ?? "Standard shipping: Small to medium items",
    shippingCostType:     listing.shippingCostType   ?? "Calculated: Cost varies based on buyer location",
    flatRateShipping:     listing.flatRateShipping   ? Number(listing.flatRateShipping)   : null,
    excludedLocations:    listing.excludedLocations  ?? [],
    combinedShippingRule: listing.combinedShippingRule ?? "",
    weightLbs:    listing.weightLbs ?? 0,
    weightOz:     listing.weightOz  ? Number(listing.weightOz)  : 3,
    dimLength:    listing.dimLength ? Number(listing.dimLength) : 11.0,
    dimWidth:     listing.dimWidth  ? Number(listing.dimWidth)  : 6.0,
    dimHeight:    listing.dimHeight ? Number(listing.dimHeight) : 1.0,
    reservePrice: listing.reservePrice ? Number(listing.reservePrice) : null,
    conditionType:    listing.conditionType,
    gradeCompanyEbay: listing.gradeCompanyEbay,
    gradeEbay:        listing.gradeEbay,
    certNumberEbay:   listing.certNumberEbay,
    cardCondition:    listing.cardCondition,
    auctionDuration:  listing.auctionDuration,
    categoryId:       listing.categoryId,
    autographAuthNumber:  listing.autographAuthNumber,
    vintage:              listing.vintage,
    eventTournament:      listing.eventTournament,
    language:             listing.language,
    originalOrLicensed:   listing.originalOrLicensed,
    californiaProp65:     listing.californiaProp65,
    cardThickness:        listing.cardThickness,
    customized:           listing.customized,
    insertSet:            listing.insertSet,
    printRun:             listing.printRun,
    customSpecifics:          listing.customSpecifics as { name: string; value: string }[] | null,
    existingEbayListingId:    listing.ebayListingId,
  };

  const result = await reviseEbayListing(input);

  if (!result.ok) {
    await db.ebayListing.update({ where: { id: listingDbId }, data: { lastError: result.error ?? "Unknown error" } });
    logger.error({
      category: "ebay", action: "ebay.revise.failed",
      message: `eBay revision failed for ${item.player ?? "item"}: ${result.error?.slice(0, 300)}`,
      targetId: listingDbId, targetType: "listing",
      data: { listingDbId, itemId: item.id, error: result.error },
    });
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await db.ebayListing.update({
    where: { id: listingDbId },
    data: {
      lastError: null,
      ...(result.newListingId ? { ebayListingId: result.newListingId, url: result.newUrl, listedAt: new Date() } : {}),
    },
  });
  logger.info({
    category: "ebay", action: "ebay.listing.revised",
    message: `Revised "${listing.title?.slice(0, 60)}" on eBay`,
    targetId: listingDbId, targetType: "listing",
  });
  return NextResponse.json({ ok: true });
}
