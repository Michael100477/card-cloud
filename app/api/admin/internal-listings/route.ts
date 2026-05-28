import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const listings = await db.internalListing.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(listings.map(l => ({
    ...l,
    purchasePrice: l.purchasePrice ? Number(l.purchasePrice) : null,
    startPrice: Number(l.startPrice),
    buyItNowPrice: l.buyItNowPrice ? Number(l.buyItNowPrice) : null,
    reservePrice: l.reservePrice ? Number(l.reservePrice) : null,
    minimumOffer: l.minimumOffer ? Number(l.minimumOffer) : null,
    autoAcceptOffer: l.autoAcceptOffer ? Number(l.autoAcceptOffer) : null,
    flatRateShipping: l.flatRateShipping ? Number(l.flatRateShipping) : null,
    weightOz: Number(l.weightOz),
    dimLength: Number(l.dimLength),
    dimWidth: Number(l.dimWidth),
    dimHeight: Number(l.dimHeight),
    soldPrice: l.soldPrice ? Number(l.soldPrice) : null,
    scheduledTime: l.scheduledTime?.toISOString() ?? null,
    listedAt: l.listedAt?.toISOString() ?? null,
    soldAt: l.soldAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  })));
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }
  const body = await req.json();
  if (!body.player?.trim()) return NextResponse.json({ error: "player is required" }, { status: 400 });
  const listing = await db.internalListing.create({
    data: {
      player: body.player,
      year: body.year ?? null,
      manufacturer: body.manufacturer ?? null,
      set: body.set ?? null,
      subset: body.subset ?? null,
      cardNumber: body.cardNumber ?? null,
      sport: body.sport ?? null,
      team: body.team ?? null,
      league: body.league ?? null,
      season: body.season ?? null,
      parallel: body.parallel ?? null,
      features: body.features ?? [],
      graded: body.graded ?? false,
      grade: body.grade ?? null,
      gradeCompany: body.gradeCompany ?? null,
      certNumber: body.certNumber ?? null,
      numbered: body.numbered ?? false,
      serialNumber: body.serialNumber ?? null,
      autographed: body.autographed ?? false,
      signedBy: body.signedBy ?? null,
      autographAuthentication: body.autographAuthentication ?? null,
      autographAuthNumber: body.autographAuthNumber ?? null,
      autographFormat: body.autographFormat ?? null,
      condition: body.condition ?? null,
      photos: body.photos ?? [],
      notes: body.notes ?? null,
      purchasePrice: body.purchasePrice ?? null,
      // Listing fields
      title: body.title ?? "",
      subtitle: body.subtitle ?? null,
      description: body.description ?? "",
      startPrice: body.startPrice ?? 0,
      buyItNowPrice: body.buyItNowPrice ?? null,
      reservePrice: body.reservePrice ?? null,
      listingType: body.listingType ?? "auction",
      auctionDuration: body.auctionDuration ?? 7,
      categoryId: body.categoryId ?? "261328",
      freeShipping: body.freeShipping ?? true,
      allowOffers: body.allowOffers ?? false,
      minimumOffer: body.minimumOffer ?? null,
      autoAcceptOffer: body.autoAcceptOffer ?? null,
      flatRateShipping: body.flatRateShipping ?? null,
      shippingMethod: body.shippingMethod ?? "Standard shipping: Small to medium items",
      shippingCostType: body.shippingCostType ?? "Calculated: Cost varies based on buyer location",
      excludedLocations: body.excludedLocations ?? [],
      combinedShippingRule: body.combinedShippingRule ?? "",
      weightLbs: body.weightLbs ?? 0,
      weightOz: body.weightOz ?? 3,
      dimLength: body.dimLength ?? 11.0,
      dimWidth: body.dimWidth ?? 6.0,
      dimHeight: body.dimHeight ?? 1.0,
      privateListing: body.privateListing ?? false,
      scheduledTime: body.scheduledTime ? new Date(body.scheduledTime) : null,
      material: body.material ?? "Card Stock",
      conditionType: body.conditionType ?? null,
      gradeCompanyEbay: body.gradeCompanyEbay ?? null,
      gradeEbay: body.gradeEbay ?? null,
      certNumberEbay: body.certNumberEbay ?? null,
      cardCondition: body.cardCondition ?? null,
      cardName: body.cardName ?? null,
      cardType: body.cardType ?? null,
      cardSize: body.cardSize ?? null,
      countryOfOrigin: body.countryOfOrigin ?? null,
      upc: body.upc ?? null,
      vintage: body.vintage ?? false,
      customized: body.customized ?? false,
      language: body.language ?? "English",
      originalOrLicensed: body.originalOrLicensed ?? "Original",
      californiaProp65: body.californiaProp65 ?? null,
      cardThickness: body.cardThickness ?? "35 pt.",
      insertSet: body.insertSet ?? null,
      printRun: body.printRun ?? null,
      autographedEbay: body.autographedEbay ?? null,
      customSpecifics: body.customSpecifics ?? null,
      eventTournament: body.eventTournament ?? null,
    },
  });
  return NextResponse.json({ id: listing.id });
}
