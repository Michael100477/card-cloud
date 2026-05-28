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

  const listing = await db.internalListing.findUnique({ where: { id: listingDbId } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (!listing.ebayListingId) {
    return NextResponse.json({ error: "Listing is not on eBay yet — use List on eBay to publish it first." }, { status: 400 });
  }

  const input: EbayListingInput = {
    sku: listing.id,
    listingDbId: listing.id,
    title: listing.title,
    subtitle: listing.subtitle,
    description: listing.description,
    startPrice: Number(listing.startPrice),
    buyItNowPrice: listing.buyItNowPrice ? Number(listing.buyItNowPrice) : null,
    freeShipping: listing.freeShipping,
    allowOffers: listing.allowOffers,
    minimumOffer: listing.minimumOffer ? Number(listing.minimumOffer) : null,
    autoAcceptOffer: listing.autoAcceptOffer ? Number(listing.autoAcceptOffer) : null,
    condition: listing.condition,
    cardName: listing.cardName,
    cardType: listing.cardType,
    cardSize: listing.cardSize,
    countryOfOrigin: listing.countryOfOrigin,
    features: listing.features,
    signedBy: listing.signedBy,
    autographAuthentication: listing.autographAuthentication,
    autographFormat: listing.autographFormat,
    photos: listing.photos,
    player: listing.player,
    year: listing.year,
    manufacturer: listing.manufacturer,
    set: listing.set,
    subset: listing.subset,
    cardNumber: listing.cardNumber,
    sport: listing.sport,
    team: listing.team,
    league: listing.league,
    season: listing.season,
    parallel: listing.parallel,
    graded: listing.graded,
    grade: listing.grade,
    gradeCompany: listing.gradeCompany,
    certNumber: listing.certNumber,
    serialNumber: listing.serialNumber,
    autographed: listing.autographedEbay ?? listing.autographed,
    listingType: listing.listingType,
    auctionDuration: listing.auctionDuration,
    categoryId: listing.categoryId,
    material: listing.material,
    scheduledTime: listing.scheduledTime?.toISOString() ?? null,
    privateListing: listing.privateListing,
    shippingMethod: listing.shippingMethod,
    shippingCostType: listing.shippingCostType,
    flatRateShipping: listing.flatRateShipping ? Number(listing.flatRateShipping) : null,
    excludedLocations: listing.excludedLocations,
    combinedShippingRule: listing.combinedShippingRule,
    weightLbs: listing.weightLbs,
    weightOz: Number(listing.weightOz),
    dimLength: Number(listing.dimLength),
    dimWidth: Number(listing.dimWidth),
    dimHeight: Number(listing.dimHeight),
    reservePrice: listing.reservePrice ? Number(listing.reservePrice) : null,
    conditionType: listing.conditionType,
    gradeCompanyEbay: listing.gradeCompanyEbay,
    gradeEbay: listing.gradeEbay,
    certNumberEbay: listing.certNumberEbay,
    cardCondition: listing.cardCondition,
    autographAuthNumber: listing.autographAuthNumber,
    vintage: listing.vintage,
    eventTournament: listing.eventTournament,
    language: listing.language,
    originalOrLicensed: listing.originalOrLicensed,
    californiaProp65: listing.californiaProp65,
    cardThickness: listing.cardThickness,
    customized: listing.customized,
    insertSet: listing.insertSet,
    printRun: listing.printRun,
    customSpecifics: listing.customSpecifics as { name: string; value: string }[] | null,
    existingEbayListingId: listing.ebayListingId,
  };

  const result = await reviseEbayListing(input);

  if (!result.ok) {
    await db.internalListing.update({
      where: { id: listingDbId },
      data: { lastError: result.error ?? "Unknown eBay error" },
    });
    logger.error({
      category: "ebay", action: "ebay.revise-internal.failed",
      message: `Revise failed for internal listing ${listing.player}: ${result.error?.slice(0, 300)}`,
      targetId: listingDbId, targetType: "listing",
      data: { listingDbId, error: result.error },
    });
    return NextResponse.json({ error: result.error ?? "Unknown eBay error" }, { status: 500 });
  }

  // Update status — scheduled if the start time is still in the future
  const isScheduled = !!listing.scheduledTime && listing.scheduledTime.getTime() > Date.now();
  await db.internalListing.update({
    where: { id: listingDbId },
    data: {
      lastError: null,
      status: isScheduled ? "scheduled" : "active",
      ...(result.newListingId ? { ebayListingId: result.newListingId, url: result.newUrl, listedAt: new Date() } : {}),
    },
  });
  logger.info({
    category: "ebay", action: "ebay.internal-listing.revised",
    message: `Revised "${listing.title?.slice(0, 60)}" on eBay`,
    targetId: listingDbId, targetType: "listing",
  });
  return NextResponse.json({ ok: true });
}
