import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { getAccessToken, getEbayConnectionStatus } from "@/lib/ebay-auth";

async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}

function ek(base: string, isSandbox: boolean): string {
  return isSandbox ? base : `${base}_prod`;
}

function attr(block: string, tag: string): string | null {
  return block.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`))?.[1]?.trim() ?? null;
}

// Decode XML/HTML entities. Run twice to handle double-encoded content from eBay
// (eBay often returns CDATA whose HTML content uses &amp;lt; instead of <).
function decodeEntities(s: string): string {
  const once = (str: string) => str
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&");
  return once(once(s));
}

// Convert eBay HTML description to plain text matching the AI-generated format.
// list-internal/route.ts later wraps plain text back into <p>/<br> via toHtmlDescription().
function htmlToPlain(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Map eBay item specifics names to InternalListing fields
function mapSpecifics(specifics: { name: string; value: string }[]) {
  const get = (keys: string[]) =>
    specifics.find(s => keys.some(k => s.name.toLowerCase() === k.toLowerCase()))?.value ?? null;

  const yearRaw  = get(["Year Manufactured", "Year"]);
  const vintage  = get(["Vintage"]);
  const autographed = get(["Autographed"]);

  return {
    player:          get(["Player/Athlete", "Player", "Players/Athletes", "Card Name"]),
    year:            yearRaw ? parseInt(yearRaw) || null : null,
    manufacturer:    get(["Manufacturer", "Card Manufacturer"]),
    set:             get(["Set", "Card Set", "Card Series"]),
    subset:          get(["Subset", "Insert Set", "Insert"]),
    cardNumber:      get(["Card Number", "#", "Card #"]),
    sport:           get(["Sport"]),
    league:          get(["League"]),
    season:          get(["Season"]),
    team:            get(["Team", "Team/Club"]),
    parallel:        get(["Parallel/Variety", "Parallel", "Variety"]),
    grade:           get(["Grade"]),
    gradeCompany:    get(["Professional Grader", "Grader"]),
    certNumber:      get(["Certification Number", "Cert #", "PSA Cert #", "BGS Cert #"]),
    signedBy:        get(["Signed By", "Autographed by"]),
    autographAuthentication: get(["Autograph Authentication", "Authentication Company"]),
    autographAuthNumber:     get(["Authentication Number", "Autograph Auth #"]),
    autographFormat: get(["Autograph Format"]),
    countryOfOrigin: get(["Country/Region of Manufacture", "Country of Manufacture", "Country of Origin"]),
    language:        get(["Language"]) ?? "English",
    material:        get(["Material", "Card Stock Material"]) ?? "Card Stock",
    cardThickness:   get(["Card Thickness"]) ?? "35 pt.",
    cardCondition:   get(["Card Condition", "Condition"]),
    cardType:        get(["Card Type", "Type"]) ?? "Sports Trading Card",
    cardSize:        get(["Card Size", "Size"]) ?? "Standard",
    originalOrLicensed: get(["Original/Licensed Reprint", "Licensed"]) ?? "Original",
    printRun:        get(["Print Run", "Serial Number/Total"]),
    insertSet:       get(["Insert Set", "Insert Name"]),
    vintage:         vintage === "Yes",
    autographed:     autographed === "Yes",
    graded:          get(["Graded"]) === "Yes" || !!(get(["Professional Grader"])),
    features:        specifics.filter(s => s.name.toLowerCase() === "features").map(s => s.value),
  };
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const { ebayItemId, force } = await req.json();
  if (!ebayItemId) return NextResponse.json({ error: "ebayItemId required" }, { status: 400 });

  // If already imported with real data, return the existing record; otherwise (force flag OR
  // empty player from a previous bad import), delete and re-import fresh from eBay.
  const existing = await db.internalListing.findFirst({ where: { ebayListingId: ebayItemId } });
  if (existing) {
    const shouldReimport = force === true || !existing.player?.trim();
    if (!shouldReimport) return NextResponse.json({ id: existing.id });
    console.log("[import-direct] re-importing — force:", !!force, "| existing id:", existing.id);
    await db.internalListing.delete({ where: { id: existing.id } });
  }

  const connStatus = await getEbayConnectionStatus();
  if (!connStatus.connected) return NextResponse.json({ error: "eBay account not connected" }, { status: 400 });

  let token: string;
  try { token = await getAccessToken(); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }

  const isSandbox = connStatus.environment !== "production";
  const apiBase   = isSandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  const [appId, devId, certId] = await Promise.all([
    getCred(ek("ebay_app_id", isSandbox)),
    getCred("ebay_dev_id"),
    getCred(ek("ebay_cert_id", isSandbox)),
  ]);

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${ebayItemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeItemSpecifics>true</IncludeItemSpecifics>
</GetItemRequest>`;

  const r = await fetch(`${apiBase}/ws/api.dll`, {
    method: "POST",
    headers: {
      "X-EBAY-API-CALL-NAME":           "GetItem",
      "X-EBAY-API-SITEID":              "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-APP-NAME":            appId  ?? "",
      "X-EBAY-API-DEV-NAME":            devId  ?? "",
      "X-EBAY-API-CERT-NAME":           certId ?? "",
      "Content-Type":                   "text/xml;charset=utf-8",
    },
    body: xml,
  });

  const text = await r.text();
  const ack  = text.match(/<Ack>(\w+)<\/Ack>/)?.[1];
  if (ack !== "Success" && ack !== "Warning") {
    const errMsg = text.match(/<LongMessage>([^<]+)<\/LongMessage>/)?.[1]
                ?? text.match(/<ShortMessage>([^<]+)<\/ShortMessage>/)?.[1]
                ?? "GetItem failed";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }

  const itemBlock = text.match(/<Item>([\s\S]*?)<\/Item>/)?.[1] ?? "";

  // Basic fields
  const title        = attr(itemBlock, "Title") ?? "";
  const subtitle     = attr(itemBlock, "SubTitle") ?? null;
  const rawDesc      = itemBlock.match(/<Description>([\s\S]*?)<\/Description>/)?.[1] ?? "";
  // Decode entities (double-pass for &amp;lt;-style double-encoding), then HTML → plain text
  // to match the AI-generated description format the form expects.
  const description  = htmlToPlain(decodeEntities(rawDesc));
  const listingTypeRaw = attr(itemBlock, "ListingType") ?? "Chinese";
  const listingType  = listingTypeRaw === "FixedPriceItem" ? "fixed" : "auction";
  // Price: try StartPrice, then BuyItNowPrice, then SellingStatus/CurrentPrice
  // (fixed-price listings sometimes only populate one of these)
  const startPriceRaw = attr(itemBlock, "StartPrice")
    ?? attr(itemBlock, "BuyItNowPrice")
    ?? attr(itemBlock, "CurrentPrice")
    ?? "0";
  const startPrice    = parseFloat(startPriceRaw) || 0;
  const binPriceStr   = attr(itemBlock, "BuyItNowPrice");
  const binFromEbay   = binPriceStr ? (parseFloat(binPriceStr) || null) : null;
  // The form's active price field is "Start price" for auctions and "Buy It Now price"
  // for fixed-price listings. Mirror the price into BIN for fixed-price so the form shows it.
  const buyItNowPrice = listingType === "fixed" ? (binFromEbay ?? startPrice) : binFromEbay;
  const reservePriceStr = attr(itemBlock, "ReservePrice");
  const reservePrice = reservePriceStr ? parseFloat(reservePriceStr) : null;
  const durationRaw  = attr(itemBlock, "ListingDuration") ?? "Days_7";
  const auctionDuration = parseInt(durationRaw.replace("Days_", "")) || 7;
  const categoryId   = attr(itemBlock, "CategoryID") ?? "261328";
  const viewItemUrl  = attr(itemBlock, "ViewItemURL");
  const startTimeStr = attr(itemBlock, "StartTime");

  // Photos
  const photos = [...itemBlock.matchAll(/<PictureURL>([^<]+)<\/PictureURL>/g)]
    .map(m => m[1].trim()).filter(Boolean);

  // Strip description block before parsing specifics to avoid CDATA interference
  const blockForSpecifics = itemBlock.replace(/<Description>[\s\S]*?<\/Description>/g, "");

  // Item specifics — expand multi-value entries (one row per value)
  const nvLists = [...blockForSpecifics.matchAll(/<NameValueList>([\s\S]*?)<\/NameValueList>/g)];
  const specifics: { name: string; value: string }[] = [];
  for (const nv of nvLists) {
    const name = attr(nv[1], "Name") ?? "";
    if (!name) continue;
    const values = [...nv[1].matchAll(/<Value>([^<]+)<\/Value>/g)].map(m => m[1].trim()).filter(Boolean);
    for (const value of values) specifics.push({ name, value });
  }

  const mapped = mapSpecifics(specifics);
  console.log("[import-direct] specifics count:", specifics.length, "| mapped.player:", mapped.player, "| mapped.sport:", mapped.sport, "| mapped.set:", mapped.set);
  if (specifics.length === 0) {
    const nvRaw = [...text.matchAll(/<NameValueList>/g)].length;
    console.log("[import-direct] WARNING: no specifics parsed. Raw NameValueList count in full XML:", nvRaw, "| ItemSpecifics present:", text.includes("<ItemSpecifics>"));
  }

  // Shipping — note: <FreeShipping> sits inside <ShippingServiceOptions>, but substring
  // search still works since it's anywhere in the item block.
  const freeShipping = itemBlock.includes("<FreeShipping>true</FreeShipping>");
  const shippingTypeRaw = attr(itemBlock, "ShippingType") ?? "";
  const isFlat = shippingTypeRaw === "Flat" || shippingTypeRaw === "FlatDomesticCalculatedInternational";
  // Match the exact strings the form's dropdown expects (see lib/ebay-listing-defaults-shared.ts)
  const shippingCostType = isFlat
    ? "Flat rate: Same cost regardless of buyer location"
    : "Calculated: Cost varies based on buyer location";
  const flatRateShipping = isFlat
    ? (parseFloat(attr(itemBlock, "ShippingServiceCost") ?? "0") || null)
    : null;
  console.log("[import-direct] price:", startPrice, "| BIN:", buyItNowPrice, "| shippingType:", shippingTypeRaw, "| free:", freeShipping, "| flatCost:", flatRateShipping);

  const created = await db.internalListing.create({
    data: {
      // Card identity from item specifics
      player:       mapped.player ?? "",
      year:         mapped.year,
      manufacturer: mapped.manufacturer,
      set:          mapped.set,
      subset:       mapped.subset,
      cardNumber:   mapped.cardNumber,
      sport:        mapped.sport,
      // Store the full league name as eBay returned it (e.g. "National Football League (NFL)")
      // — matches the dropdown label exactly.
      league:       mapped.league || null,
      season:       mapped.season,
      team:         mapped.team,
      parallel:     mapped.parallel,
      features:     mapped.features,
      graded:       mapped.graded,
      grade:        mapped.grade,
      gradeCompany: mapped.gradeCompany,
      certNumber:   mapped.certNumber,
      autographed:    mapped.autographed,
      autographedEbay: mapped.autographed,
      signedBy:       mapped.signedBy,
      autographAuthentication: mapped.autographAuthentication,
      autographAuthNumber:     mapped.autographAuthNumber,
      autographFormat: mapped.autographFormat,
      vintage:      mapped.vintage,
      // Listing config
      title,
      subtitle,
      description,
      startPrice,
      buyItNowPrice,
      reservePrice,
      listingType,
      auctionDuration,
      categoryId,
      freeShipping,
      shippingCostType,
      flatRateShipping,
      photos,
      // Card specifics
      cardType:           mapped.cardType,
      cardSize:           mapped.cardSize,
      cardCondition:      mapped.cardCondition,
      cardThickness:      mapped.cardThickness,
      material:           mapped.material,
      language:           mapped.language,
      countryOfOrigin:    mapped.countryOfOrigin,
      originalOrLicensed: mapped.originalOrLicensed,
      printRun:           mapped.printRun,
      insertSet:          mapped.insertSet,
      // eBay link
      status:        "active",
      ebayListingId: ebayItemId,
      url:           viewItemUrl,
      listedAt:      startTimeStr ? new Date(startTimeStr) : new Date(),
    },
  });

  return NextResponse.json({ id: created.id });
}
