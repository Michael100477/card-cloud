import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { createEbayListing } from "@/lib/ebay-api";
import type { EbayListingInput } from "@/lib/ebay-api";

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const { listingDbId } = await req.json();
  if (!listingDbId) return NextResponse.json({ error: "listingDbId required" }, { status: 400 });

  const listing = await db.internalListing.findUnique({ where: { id: listingDbId } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

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
    isLot:     listing.isLot,
    cardCount: listing.cardCount,
  };

  const result = await createEbayListing(input);

  if (!result.ok) {
    await db.internalListing.update({
      where: { id: listingDbId },
      data: { lastError: result.error ?? "Unknown eBay error" },
    });
    return NextResponse.json({ error: result.error ?? "Unknown eBay error" }, { status: 500 });
  }

  // If the listing was scheduled for a future start time, status should reflect that
  // until eBay actually goes live. Use existing scheduledTime in the DB row to decide.
  const fresh = await db.internalListing.findUnique({ where: { id: listingDbId } });
  const isScheduled = !!fresh?.scheduledTime && fresh.scheduledTime.getTime() > Date.now();
  await db.internalListing.update({
    where: { id: listingDbId },
    data: {
      ebayListingId: result.ebayListingId,
      url: result.url,
      status: isScheduled ? "scheduled" : "active",
      listedAt: new Date(),
      lastError: null,
    },
  });

  return NextResponse.json({ ok: true, ebayListingId: result.ebayListingId, url: result.url });
}
