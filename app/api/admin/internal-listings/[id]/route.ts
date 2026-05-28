import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const listing = await db.internalListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...listing,
    purchasePrice: listing.purchasePrice ? Number(listing.purchasePrice) : null,
    startPrice: Number(listing.startPrice),
    buyItNowPrice: listing.buyItNowPrice ? Number(listing.buyItNowPrice) : null,
    reservePrice: listing.reservePrice ? Number(listing.reservePrice) : null,
    minimumOffer: listing.minimumOffer ? Number(listing.minimumOffer) : null,
    autoAcceptOffer: listing.autoAcceptOffer ? Number(listing.autoAcceptOffer) : null,
    flatRateShipping: listing.flatRateShipping ? Number(listing.flatRateShipping) : null,
    weightOz: Number(listing.weightOz),
    dimLength: Number(listing.dimLength),
    dimWidth: Number(listing.dimWidth),
    dimHeight: Number(listing.dimHeight),
    soldPrice: listing.soldPrice ? Number(listing.soldPrice) : null,
    scheduledTime: listing.scheduledTime?.toISOString() ?? null,
    listedAt: listing.listedAt?.toISOString() ?? null,
    soldAt: listing.soldAt?.toISOString() ?? null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const body = await req.json();
  console.log("[internal-listings PATCH]", id, "team:", JSON.stringify(body.team), "league:", JSON.stringify(body.league), "season:", JSON.stringify(body.season));
  const data: Record<string, unknown> = {};

  if ("player" in body) data.player = body.player;
  if ("year" in body) data.year = body.year;
  if ("manufacturer" in body) data.manufacturer = body.manufacturer;
  if ("set" in body) data.set = body.set;
  if ("subset" in body) data.subset = body.subset;
  if ("cardNumber" in body) data.cardNumber = body.cardNumber;
  if ("sport" in body) data.sport = body.sport;
  if ("team" in body) data.team = body.team;
  if ("league" in body) data.league = body.league;
  if ("season" in body) data.season = body.season;
  if ("parallel" in body) data.parallel = body.parallel;
  if ("features" in body) data.features = body.features;
  if ("graded" in body) data.graded = body.graded;
  if ("grade" in body) data.grade = body.grade;
  if ("gradeCompany" in body) data.gradeCompany = body.gradeCompany;
  if ("certNumber" in body) data.certNumber = body.certNumber;
  if ("numbered" in body) data.numbered = body.numbered;
  if ("serialNumber" in body) data.serialNumber = body.serialNumber;
  if ("autographed" in body) data.autographed = body.autographed;
  if ("signedBy" in body) data.signedBy = body.signedBy;
  if ("autographAuthentication" in body) data.autographAuthentication = body.autographAuthentication;
  if ("autographAuthNumber" in body) data.autographAuthNumber = body.autographAuthNumber;
  if ("autographFormat" in body) data.autographFormat = body.autographFormat;
  if ("condition" in body) data.condition = body.condition;
  if ("photos" in body) data.photos = body.photos;
  if ("notes" in body) data.notes = body.notes;
  if ("purchasePrice" in body) data.purchasePrice = body.purchasePrice;
  if ("title" in body) data.title = body.title;
  if ("subtitle" in body) data.subtitle = body.subtitle;
  if ("description" in body) data.description = body.description;
  if ("startPrice" in body) data.startPrice = body.startPrice;
  if ("buyItNowPrice" in body) data.buyItNowPrice = body.buyItNowPrice;
  if ("reservePrice" in body) data.reservePrice = body.reservePrice;
  if ("listingType" in body) data.listingType = body.listingType;
  if ("auctionDuration" in body) data.auctionDuration = body.auctionDuration;
  if ("categoryId" in body) data.categoryId = body.categoryId;
  if ("freeShipping" in body) data.freeShipping = body.freeShipping;
  if ("allowOffers" in body) data.allowOffers = body.allowOffers;
  if ("minimumOffer" in body) data.minimumOffer = body.minimumOffer;
  if ("autoAcceptOffer" in body) data.autoAcceptOffer = body.autoAcceptOffer;
  if ("flatRateShipping" in body) data.flatRateShipping = body.flatRateShipping;
  if ("shippingMethod" in body) data.shippingMethod = body.shippingMethod;
  if ("shippingCostType" in body) data.shippingCostType = body.shippingCostType;
  if ("excludedLocations" in body) data.excludedLocations = body.excludedLocations;
  if ("combinedShippingRule" in body) data.combinedShippingRule = body.combinedShippingRule;
  if ("weightLbs" in body) data.weightLbs = body.weightLbs;
  if ("weightOz" in body) data.weightOz = body.weightOz;
  if ("dimLength" in body) data.dimLength = body.dimLength;
  if ("dimWidth" in body) data.dimWidth = body.dimWidth;
  if ("dimHeight" in body) data.dimHeight = body.dimHeight;
  if ("privateListing" in body) data.privateListing = body.privateListing;
  if ("scheduledTime" in body) data.scheduledTime = body.scheduledTime ? new Date(body.scheduledTime) : null;
  if ("material" in body) data.material = body.material;
  if ("conditionType" in body) data.conditionType = body.conditionType;
  if ("gradeCompanyEbay" in body) data.gradeCompanyEbay = body.gradeCompanyEbay;
  if ("gradeEbay" in body) data.gradeEbay = body.gradeEbay;
  if ("certNumberEbay" in body) data.certNumberEbay = body.certNumberEbay;
  if ("cardCondition" in body) data.cardCondition = body.cardCondition;
  if ("cardName" in body) data.cardName = body.cardName;
  if ("cardType" in body) data.cardType = body.cardType;
  if ("cardSize" in body) data.cardSize = body.cardSize;
  if ("countryOfOrigin" in body) data.countryOfOrigin = body.countryOfOrigin;
  if ("upc" in body) data.upc = body.upc;
  if ("vintage" in body) data.vintage = body.vintage;
  if ("customized" in body) data.customized = body.customized;
  if ("language" in body) data.language = body.language;
  if ("originalOrLicensed" in body) data.originalOrLicensed = body.originalOrLicensed;
  if ("californiaProp65" in body) data.californiaProp65 = body.californiaProp65;
  if ("cardThickness" in body) data.cardThickness = body.cardThickness;
  if ("insertSet" in body) data.insertSet = body.insertSet;
  if ("printRun" in body) data.printRun = body.printRun;
  if ("autographedEbay" in body) data.autographedEbay = body.autographedEbay;
  if ("customSpecifics" in body) data.customSpecifics = body.customSpecifics;
  if ("eventTournament" in body) data.eventTournament = body.eventTournament;

  const updated = await db.internalListing.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const { id } = await params;
  const listing = await db.internalListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only block deletion if the listing is actually live on eBay (has a real listing ID).
  // Orphan records (status=active but no ebayListingId, from a failed publish before the
  // route fix) should be deletable so the user can clean them up.
  const liveOnEbay = (listing.status === "active" || listing.status === "scheduled") && !!listing.ebayListingId;
  if (liveOnEbay) {
    return NextResponse.json({ error: "End the eBay listing first before deleting." }, { status: 400 });
  }
  await db.internalListing.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
