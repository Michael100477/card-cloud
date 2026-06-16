import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createEbayListing, type EbayListingInput } from "@/lib/ebay-api";

export interface PublishResult {
  ok: boolean;
  ebayListingId?: string;
  url?: string;
  error?: string;
}

/** Push a single draft/pending EbayListing row to eBay, persist the resulting
 *  IDs/URL on success or the error on failure, and dual-list on The Exchange.
 *  Called by both POST /api/admin/ebay/list (single) and POST
 *  /api/admin/ebay/list-batch (concurrent). */
export async function publishListing(listingDbId: string): Promise<PublishResult> {
  const listing = await db.ebayListing.findUnique({
    where:   { id: listingDbId },
    include: { item: true },
  });
  if (!listing)                       return { ok: false, error: "Listing not found" };
  if (listing.status === "active")    return { ok: false, error: "Already listed on eBay" };

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
    minimumOffer:   listing.minimumOffer   ? Number(listing.minimumOffer)   : null,
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
    autographed:           listing.autographedEbay ?? item.autographed,
    material:              listing.material,
    scheduledTime:         listing.scheduledTime?.toISOString() ?? null,
    privateListing:        listing.privateListing ?? false,
    shippingMethod:        listing.shippingMethod   ?? "Standard shipping: Small to medium items",
    shippingCostType:      listing.shippingCostType   ?? "Calculated: Cost varies based on buyer location",
    flatRateShipping:      listing.flatRateShipping   ? Number(listing.flatRateShipping) : null,
    excludedLocations:     listing.excludedLocations  ?? [],
    combinedShippingRule:  listing.combinedShippingRule ?? "",
    weightLbs:             listing.weightLbs ?? 0,
    weightOz:              listing.weightOz  ? Number(listing.weightOz)  : 3,
    dimLength:             listing.dimLength ? Number(listing.dimLength) : 11.0,
    dimWidth:              listing.dimWidth  ? Number(listing.dimWidth)  : 6.0,
    dimHeight:             listing.dimHeight ? Number(listing.dimHeight) : 1.0,
    reservePrice:          listing.reservePrice ? Number(listing.reservePrice) : null,
    conditionType:         listing.conditionType,
    gradeCompanyEbay:      listing.gradeCompanyEbay,
    gradeEbay:             listing.gradeEbay,
    certNumberEbay:        listing.certNumberEbay,
    cardCondition:         listing.cardCondition,
    auctionDuration:       listing.auctionDuration,
    categoryId:            listing.categoryId,
    autographAuthNumber:   listing.autographAuthNumber,
    vintage:               listing.vintage,
    eventTournament:       listing.eventTournament,
    language:              listing.language,
    originalOrLicensed:    listing.originalOrLicensed,
    californiaProp65:      listing.californiaProp65,
    cardThickness:         listing.cardThickness,
    customized:            listing.customized,
    insertSet:             listing.insertSet,
    printRun:              listing.printRun,
    customSpecifics:       listing.customSpecifics as { name: string; value: string }[] | null,
  };

  const result = await createEbayListing(input);

  if (!result.ok) {
    await db.ebayListing.update({
      where: { id: listingDbId },
      data:  { lastError: result.error ?? "Unknown error" },
    });
    console.error(`[ebay/publish] FAILED listingDbId=${listingDbId} itemId=${item.id}:\n${result.error}`);
    logger.error({
      category: "ebay", action: "ebay.listing.failed",
      message: `eBay listing failed for ${item.player ?? "item"}: ${result.error?.slice(0, 300)}`,
      targetId: listingDbId, targetType: "listing",
      data: { listingDbId, itemId: item.id, error: result.error },
    });
    return { ok: false, error: result.error };
  }

  await db.ebayListing.update({
    where: { id: listingDbId },
    data: {
      ebayListingId: result.ebayListingId,
      url:           result.url,
      status:        "active",
      listedAt:      new Date(),
      lastError:     null,
    },
  });

  await db.consignmentItem.update({
    where: { id: item.id },
    data:  { status: "listed" },
  });

  // Dual-list on The Exchange
  const commissionSetting = await db.siteSetting.findUnique({
    where: { key: "commission_with_photos" },
  });
  const commissionRate = commissionSetting?.value ?? "15";
  const price =
    listing.buyItNowPrice && Number(listing.buyItNowPrice) > 0
      ? Number(listing.buyItNowPrice)
      : Number(listing.startPrice);

  await db.exchangeListing.create({
    data: {
      consignmentItemId: item.id,
      title:             listing.title,
      description:       listing.description,
      photos:            item.photos,
      player:            listing.playerOverride || item.player,
      year:              listing.yearOverride ?? item.year,
      manufacturer:      listing.manufacturerOverride || item.manufacturer,
      set:               listing.setOverride || item.set,
      grade:             item.grade,
      gradeCompany:      item.gradeCompany,
      condition:         listing.condition ?? item.condition,
      sport:             listing.sport || item.sport,
      graded:            item.graded,
      price:             price,
      commissionRate:    parseFloat(commissionRate),
      ebayListingId:     result.ebayListingId,
      ebayUrl:           result.url,
      status:            "active",
    },
  }).catch(e => console.error("[exchange] Failed to create Exchange listing:", e));

  logger.info({
    category: "ebay", action: "ebay.listing.created",
    message: `Listed "${listing.title?.slice(0,60)}" on eBay — ID ${result.ebayListingId}`,
    targetId: listingDbId, targetType: "listing",
    data: { ebayListingId: result.ebayListingId, url: result.url },
  });

  return { ok: true, ebayListingId: result.ebayListingId, url: result.url };
}

/** Run publishListing on many IDs at once, capped at `concurrency` in-flight.
 *  Failures don't stop the batch — every ID gets its own result entry. */
export async function publishListingsBatch(
  listingDbIds: string[],
  concurrency = 5,
): Promise<Array<{ listingDbId: string } & PublishResult>> {
  const results: Array<{ listingDbId: string } & PublishResult> = [];
  for (let i = 0; i < listingDbIds.length; i += concurrency) {
    const wave = listingDbIds.slice(i, i + concurrency);
    const waveResults = await Promise.all(
      wave.map(async (id) => {
        try {
          const r = await publishListing(id);
          return { listingDbId: id, ...r };
        } catch (e) {
          return { listingDbId: id, ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
    results.push(...waveResults);
  }
  return results;
}
