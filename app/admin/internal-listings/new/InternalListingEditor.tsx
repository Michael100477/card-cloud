"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ListingDraft,
  ListingForm,
} from "@/app/admin/consignments/[id]/ConsignmentOrderAdmin";
import type { EbayListingDefaults } from "@/lib/ebay-listing-defaults-shared";
import { canonicalizeLeague, canonicalizeSport } from "@/lib/sports-data";

// Used only when eBay's live category API is unavailable. Once the API responds,
// the live list (full breadcrumbs, all leaf categories under Sports Mem, Cards & Fan Shop)
// replaces this. Includes the most common card + memorabilia leaves.
const FALLBACK_CATEGORIES: { label: string; id: string }[] = [
  { label: "Sports Trading Cards > Trading Card Singles",                                id: "261328" },
  { label: "Sports Trading Cards > Trading Card Sets",                                   id: "183436" },
  { label: "Sports Trading Cards > Trading Card Lots",                                   id: "261329" },
  { label: "Sports Trading Cards > Sealed Trading Card Boxes",                           id: "222" },
  { label: "Sports Trading Cards > Sealed Trading Card Packs",                           id: "183454" },
  { label: "Autographs-Original > Baseball-MLB > Balls",                                 id: "1188" },
  { label: "Autographs-Original > Baseball-MLB > Bats",                                  id: "13150" },
  { label: "Autographs-Original > Baseball-MLB > Jerseys",                               id: "59195" },
  { label: "Autographs-Original > Baseball-MLB > Photos",                                id: "1196" },
  { label: "Autographs-Original > Football-NFL > Balls",                                 id: "1191" },
  { label: "Autographs-Original > Football-NFL > Helmets",                               id: "16129" },
  { label: "Autographs-Original > Football-NFL > Jerseys",                               id: "59197" },
  { label: "Autographs-Original > Football-NFL > Photos",                                id: "1199" },
  { label: "Autographs-Original > Basketball-NBA > Balls",                               id: "1190" },
  { label: "Autographs-Original > Basketball-NBA > Photos",                              id: "1198" },
  { label: "Autographs-Original > Hockey-NHL > Pucks",                                   id: "1193" },
  { label: "Autographs-Original > Hockey-NHL > Photos",                                  id: "1201" },
  { label: "Game Used Memorabilia",                                                       id: "4317" },
  { label: "Fan Apparel & Souvenirs",                                                     id: "64493" },
];

// Default league per sport — keys match SPORT_LIST values (eBay's exact sport names).
// Values match LeagueData labels (eBay's exact league names).
const SPORT_LEAGUE: Record<string, string> = {
  "Baseball":                  "Major League Baseball (MLB)",
  "Football":                  "National Football League (NFL)",
  "Basketball":                "National Basketball Association (NBA)",
  "Ice Hockey":                "National Hockey League (NHL)",
  "Soccer":                    "Major League Soccer (MLS)",
  "Golf":                      "PGA Tour",
  "Tennis":                    "ATP Tour",
  "Mixed Martial Arts (MMA)":  "Ultimate Fighting Championship (UFC)",
  "Auto Racing":               "NASCAR Cup Series",
  "Wrestling":                 "WWE",
};

// ── GRADER_TO_EBAY map ────────────────────────────────────────────────────────
const GRADER_TO_EBAY: Record<string, string> = {
  PSA:  "Professional Sports Authenticator (PSA)",
  BGS:  "Beckett Grading Services (BGS)",
  BGGS: "Beckett Grading Services (BGS)",
  SGC:  "Sportscard Guaranty Corporation (SGC)",
  CGC:  "Certified Guaranty Company (CGC)",
  CSG:  "Certified Sports Guaranty (CSG)",
  GMA:  "Gem Mint Authentication (GMA)",
};

// ── makeEmptyDraft ────────────────────────────────────────────────────────────
function makeEmptyDraft(ld: EbayListingDefaults): ListingDraft {
  return {
    title: "",
    subtitle: "",
    description: "",
    // Pre-fill Start Price from the admin default (Settings → Rates → eBay listing defaults)
    startPrice: String(ld.defaultStartPrice ?? ""),
    buyItNowPrice: "",
    reservePrice: "",
    playerOverride: "",
    yearOverride: "",
    manufacturerOverride: "",
    setOverride: "",
    cardNumberOverride: "",
    shippingCostType: String(
      ld.shippingCostType ?? "Flat rate: Same cost regardless of buyer location"
    ),
    // Auto-fill the flat rate amount from Settings → Rates → Shipping →
    // Bubble mailer min cost when the default type is flat. Seller can
    // override per-listing.
    flatRateShipping: ld.defaultShippingType === "flat" && ld.bubbleMailerMin
      ? String(ld.bubbleMailerMin)
      : "",
    excludedLocations: ["Alaska/Hawaii", "US Territories and Protectorates"],
    combinedShippingRule: "",
    // Default to UNGRADED package dimensions/weight since new listings start with graded=false.
    // setGraded() (in the component) re-applies graded defaults when the user toggles graded ON.
    weightLbs: String(ld.weightLbsUngraded ?? "0"),
    weightOz:  String(ld.weightOzUngraded  ?? "1"),
    dimLength: String(ld.dimLengthUngraded ?? "10.0"),
    dimWidth:  String(ld.dimWidthUngraded  ?? "4.0"),
    dimHeight: String(ld.dimHeightUngraded ?? "1.0"),
    schedulingEnabled: false,
    scheduledTime: "",
    privateListing:
      typeof ld.privateListing === "boolean" ? ld.privateListing : false,
    shippingMethod: String(
      ld.shippingMethod ?? "Standard shipping: Small to medium items"
    ),
    ebayId: "",
    url: "",
    savedId: "",
    condition: "",
    team: "",
    league: "",
    season: "",
    parallel: String(ld.parallel ?? ""),
    features: [],
    cardName: "",
    cardType: String(ld.cardType ?? "Sports Trading Card"),
    cardSize: String(ld.cardSize ?? "Standard"),
    countryOfOrigin: String(ld.countryOfOrigin ?? "United States"),
    upc: String(ld.upc ?? ""),
    signedBy: "",
    autographAuthentication: "",
    autographFormat: "",
    freeShipping:
      typeof ld.freeShipping === "boolean" ? ld.freeShipping : true,
    allowOffers:
      typeof ld.allowOffers === "boolean" ? ld.allowOffers : false,
    minimumOffer: "",
    autoAcceptOffer: "",
    auctionDuration:
      typeof ld.auctionDuration === "number" ? ld.auctionDuration : 7,
    listingType: String(ld.listingType ?? "auction"),
    autographedEbay:
      typeof ld.autographedEbay === "boolean" ? ld.autographedEbay : false,
    material: String(ld.material ?? "Card Stock"),
    conditionType: "",
    gradeCompanyEbay: "",
    gradeEbay: "",
    certNumberEbay: "",
    // Default raw/ungraded singles to "Excellent" — Mike's most-common
    // condition for the cards he sells. Lot listings override this to "Used"
    // via setIsLot; graded listings ignore cardCondition entirely (eBay
    // identifies them via Professional Grader instead).
    cardCondition: "Excellent",
    categoryId: String(ld.categoryId ?? "261328"),
    sport: "",
    autographAuthNumber: "",
    vintage: typeof ld.vintage === "boolean" ? ld.vintage : false,
    eventTournament: String(ld.eventTournament ?? ""),
    language: String(ld.language ?? "English"),
    originalOrLicensed: String(ld.originalOrLicensed ?? "Original"),
    californiaProp65: String(ld.californiaProp65 ?? ""),
    cardThickness: String(ld.cardThickness ?? "35 pt."),
    customized: typeof ld.customized === "boolean" ? ld.customized : false,
    insertSet: String(ld.insertSet ?? ""),
    printRun: String(ld.printRun ?? ""),
    customSpecifics: [],
    generating: false,
    generatingTitle: false,
    generatingDescription: false,
    open: false,
    saving: false,
    saved: false,
    listing: false,
    listingError: "",
    error: "",
    photosUsed: 0,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InternalListingEditor({
  ebaySection,
  ebayDefaults,
  existing,
}: {
  ebaySection: string[];
  ebayDefaults: EbayListingDefaults;
  existing?: Record<string, any> | null;
}) {
  const e = existing;
  // Card details state — pre-populated from existing listing if editing
  const [player, setPlayer] = useState(e?.player ?? "");
  const [year, setYear] = useState(e?.year ? String(e.year) : "");
  const [manufacturer, setManufacturer] = useState(e?.manufacturer ?? "");
  const [set, setSet] = useState(e?.set ?? "");
  const [subset, setSubset] = useState(e?.subset ?? "");
  const [cardNumber, setCardNumber] = useState(e?.cardNumber ?? "");
  const [sport, setSport] = useState(e?.sport ?? "");
  const [team, setTeam] = useState(e?.team ?? "");
  const [graded, _setGraded] = useState(e?.graded ?? false);
  // Wrap setGraded so toggling also resets package weight + dimensions to the
  // graded/ungraded defaults from ebayDefaults. Only applies for new listings —
  // skip the reset when editing an existing listing so we don't overwrite saved
  // values. Also skip when isLot is on — lots have their own 11x6x1 default
  // applied by setIsLot, and we don't want graded toggling to clobber it.
  function setGraded(next: boolean | ((g: boolean) => boolean)) {
    _setGraded((prev: boolean) => {
      const newGraded = typeof next === "function" ? next(prev) : next;
      if (!e && !isLot) {
        const ld = ebayDefaults;
        if (newGraded) {
          patchDraft({
            weightLbs: String(ld.weightLbsGraded ?? "0"),
            weightOz:  String(ld.weightOzGraded  ?? "3"),
            dimLength: String(ld.dimLengthGraded ?? "11.0"),
            dimWidth:  String(ld.dimWidthGraded  ?? "6.0"),
            dimHeight: String(ld.dimHeightGraded ?? "1.0"),
          });
        } else {
          patchDraft({
            weightLbs: String(ld.weightLbsUngraded ?? "0"),
            weightOz:  String(ld.weightOzUngraded  ?? "1"),
            dimLength: String(ld.dimLengthUngraded ?? "10.0"),
            dimWidth:  String(ld.dimWidthUngraded  ?? "4.0"),
            dimHeight: String(ld.dimHeightUngraded ?? "1.0"),
          });
        }
      }
      return newGraded;
    });
  }
  const [grade, setGrade] = useState(e?.grade ?? "");
  const [gradeCompany, setGradeCompany] = useState(e?.gradeCompany ?? "");
  const [certNumber, setCertNumber] = useState(e?.certNumber ?? "");
  const [autographed, _setAutographed] = useState(e?.autographed ?? false);
  // Wrap setAutographed so that flipping the autograph toggle ON also bumps
  // package dimensions to 11x6x1 — autographed cards almost always ship in
  // the larger graded-style bubble mailer to protect the signature. Like
  // setGraded, only applies for new listings (not when editing) and is a
  // no-op when isLot is on (lots already use 11x6x1).
  function setAutographed(next: boolean | ((a: boolean) => boolean)) {
    _setAutographed((prev: boolean) => {
      const newAutographed = typeof next === "function" ? next(prev) : next;
      if (!e && !isLot && newAutographed) {
        patchDraft({ dimLength: "11.0", dimWidth: "6.0", dimHeight: "1.0" });
      }
      return newAutographed;
    });
  }
  const [signedBy, setSignedBy] = useState(e?.signedBy ?? "");
  const [condition, setCondition] = useState(e?.condition ?? "");
  const [photos, setPhotos] = useState<string[]>(e?.photos ?? []);
  const [purchasePrice, setPurchasePrice] = useState(e?.purchasePrice ? String(e.purchasePrice) : "");
  const [notes, setNotes] = useState(e?.notes ?? "");

  // Card-lot mode — when on, this listing is a bundle of multiple cards
  // rather than a single card. Auto-switches the eBay category to Trading
  // Card Lots (183444) and exposes a Number of Cards input.
  const [isLot, _setIsLot]       = useState<boolean>(e?.isLot ?? false);
  const [cardCount, setCardCount] = useState<string>(e?.cardCount ? String(e.cardCount) : "");
  const [lotContents, setLotContents] = useState<string>(e?.lotContents ?? "");
  function setIsLot(next: boolean) {
    _setIsLot(next);
    patchDraft({
      categoryId: next ? "261329" : "261328",
      // Lots ship in a larger envelope/box than singles. 11x6x1 is the typical
      // size for a small/medium card lot in a bubble mailer.
      // Pre-select 'Used' as the lot condition — it's the right answer for
      // almost every lot Mike sells (bulk/pulled-from-packs inventory).
      // Singles use the graded/ungraded grading-scale flow, so we leave
      // cardCondition alone when toggling lot OFF (the form's conditionType
      // gate handles that side).
      ...(next ? { dimLength: "11.0", dimWidth: "6.0", dimHeight: "1.0", cardCondition: "Used" } : {}),
    });
  }

  // Listing form state — pre-populated from existing listing if editing
  const [draft, setDraft] = useState<ListingDraft>(() => {
    const base = makeEmptyDraft(ebayDefaults);
    if (!e) return base;
    return {
      ...base,
      title:              e.title             ?? "",
      subtitle:           e.subtitle          ?? "",
      description:        e.description       ?? "",
      startPrice:         e.startPrice        != null ? String(e.startPrice)        : "",
      buyItNowPrice:      e.buyItNowPrice      != null ? String(e.buyItNowPrice)      : "",
      reservePrice:       e.reservePrice       != null ? String(e.reservePrice)       : "",
      listingType:        e.listingType        ?? base.listingType,
      auctionDuration:    e.auctionDuration    ?? base.auctionDuration,
      categoryId:         e.categoryId         ?? base.categoryId,
      freeShipping:       e.freeShipping       ?? base.freeShipping,
      allowOffers:        e.allowOffers        ?? base.allowOffers,
      minimumOffer:       e.minimumOffer        != null ? String(e.minimumOffer)        : "",
      autoAcceptOffer:    e.autoAcceptOffer     != null ? String(e.autoAcceptOffer)     : "",
      flatRateShipping:   e.flatRateShipping    != null ? String(e.flatRateShipping)    : "",
      shippingMethod:     e.shippingMethod      ?? base.shippingMethod,
      shippingCostType:   e.shippingCostType    ?? base.shippingCostType,
      excludedLocations:  e.excludedLocations   ?? base.excludedLocations,
      weightLbs:          e.weightLbs           != null ? String(e.weightLbs)           : base.weightLbs,
      weightOz:           e.weightOz            != null ? String(e.weightOz)            : base.weightOz,
      dimLength:          e.dimLength           != null ? String(e.dimLength)           : base.dimLength,
      dimWidth:           e.dimWidth            != null ? String(e.dimWidth)            : base.dimWidth,
      dimHeight:          e.dimHeight           != null ? String(e.dimHeight)           : base.dimHeight,
      privateListing:     e.privateListing      ?? base.privateListing,
      scheduledTime:      e.scheduledTime       ?? "",
      schedulingEnabled:  !!e.scheduledTime,
      material:           e.material            ?? base.material,
      conditionType:      e.conditionType       ?? "",
      gradeCompanyEbay:   e.gradeCompanyEbay    ?? "",
      gradeEbay:          e.gradeEbay           ?? "",
      certNumberEbay:     e.certNumberEbay      ?? "",
      cardCondition:      e.cardCondition       ?? "",
      cardName:           e.cardName            ?? "",
      cardType:           e.cardType            ?? base.cardType,
      cardSize:           e.cardSize            ?? base.cardSize,
      countryOfOrigin:    e.countryOfOrigin     ?? base.countryOfOrigin,
      sport:              canonicalizeSport(e.sport),
      team:               e.team                ?? "",
      league:             canonicalizeLeague(e.league) || (e.sport ? canonicalizeLeague(SPORT_LEAGUE[e.sport]) : ""),
      season:             e.season              ?? "",
      parallel:           e.parallel            ?? "",
      features:           e.features            ?? [],
      vintage:            e.vintage             ?? base.vintage,
      customized:         e.customized          ?? base.customized,
      language:           e.language            ?? base.language,
      originalOrLicensed: e.originalOrLicensed  ?? base.originalOrLicensed,
      californiaProp65:   e.californiaProp65     ?? "",
      cardThickness:      e.cardThickness        ?? base.cardThickness,
      insertSet:          e.insertSet            ?? "",
      printRun:           e.printRun             ?? "",
      autographedEbay:    e.autographedEbay      ?? e.autographed ?? base.autographedEbay,
      signedBy:           e.signedBy             ?? "",
      autographAuthentication: e.autographAuthentication ?? "",
      autographFormat:    e.autographFormat      ?? "",
      autographAuthNumber: e.autographAuthNumber ?? "",
      playerOverride:     e.player               ?? "",
      yearOverride:       e.year                 ? String(e.year) : "",
      manufacturerOverride: e.manufacturer       ?? "",
      setOverride:        e.set                  ?? "",
      cardNumberOverride: e.cardNumber            ?? "",
      customSpecifics:    (e.customSpecifics as { name: string; value: string }[]) ?? [],
      savedId:            e.id                   ?? "",
      open:               !!(e.title),
    };
  });
  const [savedId, setSavedId] = useState<string | null>(e?.id ?? null);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg,  setScanMsg]  = useState("");
  const [listError, setListError] = useState("");
  const [categories,    setCategories]    = useState<{ label: string; id: string }[]>(FALLBACK_CATEGORIES);
  const [catStatus,     setCatStatus]     = useState<"loading" | "ok" | "error">("loading");
  const [shippingRules,    setShippingRules]    = useState<{ id: string; name: string }[]>([]);
  const [shippingRulesSrc, setShippingRulesSrc] = useState<"loading" | "ok" | "none">("loading");
  const router = useRouter();

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder-slate-400";

  useEffect(() => {
    fetch("/api/admin/ebay/categories")
      .then(r => r.json())
      .then(d => { if (d.categories?.length) { setCategories(d.categories); setCatStatus("ok"); } else setCatStatus("error"); })
      .catch(() => setCatStatus("error"));
  }, []);

  useEffect(() => {
    fetch("/api/admin/ebay/shipping-rules")
      .then(r => r.json())
      .then(d => { setShippingRules(d.rules ?? []); setShippingRulesSrc(d.rules?.length ? "ok" : "none"); })
      .catch(() => setShippingRulesSrc("none"));
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function patchDraft(patch: Partial<ListingDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  async function scanSlab(photoUrl: string) {
    setScanning(true);
    setScanMsg("Reading label with AI…");
    try {
      // For remote URLs (R2, custom domain), have the server fetch the image
      // — browsers can't cross-origin fetch from R2 without CORS configured.
      // For local /uploads/ URLs, fall through to the FormData path.
      let r: Response;
      if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
        r = await fetch("/api/scan", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ photoUrl }),
        });
      } else {
        const imgRes = await fetch(photoUrl);
        const blob   = await imgRes.blob();
        const fd     = new FormData();
        fd.append("image", blob, "slab.jpg");
        r = await fetch("/api/scan", { method: "POST", body: fd });
      }
      const d  = await r.json();
      if (!r.ok || !d.success) {
        setScanMsg(d.error ?? "Could not read label — fill in manually.");
        return;
      }
      const c = d.cardData;

      // Multi-card lot — auto-switch category to Trading Card Lots and skip
      // single-card identification (player/year/etc. will be empty so the user
      // can describe the lot as a whole).
      if (c.isLot || (typeof c.cardCount === "number" && c.cardCount >= 2)) {
        patchDraft({
          categoryId:    "261329",             // Sports Trading Cards > Trading Card Lots
          dimLength:     "11.0",               // lot-specific package defaults — fit
          dimWidth:      "6.0",                //   typical bubble mailer
          dimHeight:     "1.0",
          cardCondition: "Used",               // sensible default for almost every lot
        });
        _setIsLot(true);                       // also flip the manual toggle on
        if (typeof c.cardCount === "number") setCardCount(String(c.cardCount));
        if (c.sport) setSport(c.sport);
        if (c.set)   setSet(c.set);            // optional: useful if all cards are same set
        setScanMsg(`✓ Detected a lot of ${c.cardCount ?? "multiple"} cards — category set to Trading Card Lots. Fill in the rest manually.`);
        return;
      }

      // Single card — auto-fill all the per-card fields
      if (c.isGraded !== undefined) setGraded(!!c.isGraded);
      if (c.player)       setPlayer(c.player);
      if (c.year)         setYear(String(c.year));
      if (c.manufacturer) setManufacturer(c.manufacturer);
      if (c.set)          setSet(c.set);
      if (c.subset)       setSubset(c.subset);
      if (c.cardNumber)   setCardNumber(c.cardNumber);
      if (c.sport)        setSport(c.sport);
      if (c.grade)        setGrade(c.grade);
      if (c.grader && c.grader !== "Unknown") setGradeCompany(c.grader);
      if (c.certNumber)   setCertNumber(c.certNumber);
      // Autograph: turn the toggle on if AI saw a signature/auto indicator,
      // and default Signed By to the detected player name (still editable).
      if (c.isAutographed) {
        setAutographed(true);
        if (c.player && !signedBy) setSignedBy(c.player);
      }
      setScanMsg(`✓ Label read (${d.source}) — review fields above`);
    } catch (err) {
      setScanMsg(`Scan failed: ${String(err)}`);
    } finally {
      setScanning(false);
    }
  }

  function buildCardData() {
    return {
      player,
      year: parseInt(year) || null,
      manufacturer,
      set,
      subset,
      cardNumber,
      printRun: draft.printRun,
      sport,
      team,
      graded,
      grade,
      gradeCompany,
      certNumber,
      numbered: !!draft.printRun,
      serialNumber: draft.printRun || null,
      autographed,
      signedBy,
      autographAuthentication: "",
      autographFormat: "",
      condition,
      notes,
      listingType: draft.listingType,
      desiredPrice: parseFloat(draft.startPrice) || null,
      allowOffers: draft.allowOffers,
      minimumOffer: draft.minimumOffer ? parseFloat(draft.minimumOffer) : null,
      askingPrice: null,
      photos,
      isLot,
      cardCount: isLot && cardCount ? parseInt(cardCount, 10) : null,
      lotContents: isLot ? lotContents : null,
    };
  }

  function buildItem() {
    return {
      id: savedId || "",
      player,
      year: parseInt(year) || null,
      manufacturer: manufacturer || null,
      set: set || null,
      subset: subset || null,
      cardNumber: cardNumber || null,
      sport: sport || null,
      graded,
      grade: grade || null,
      gradeCompany: gradeCompany || null,
      certNumber: certNumber || null,
      numbered: false,
      serialNumber: null,
      autographed,
      signedBy: signedBy || null,
      autographAuthentication: null,
      autographAuthNumber: null,
      autographFormat: null,
      condition: condition || null,
      notes: notes || null,
      askingPrice: null,
      listingType: draft.listingType || null,
      desiredPrice: parseFloat(draft.startPrice) || null,
      freeShipping: draft.freeShipping,
      allowOffers: draft.allowOffers,
      minimumOffer: draft.minimumOffer ? parseFloat(draft.minimumOffer) : null,
      team: draft.team || null,
      league: draft.league || null,
      season: draft.season || null,
      parallel: draft.parallel || null,
      features: draft.features,
      cardName: draft.cardName || null,
      cardType: draft.cardType || null,
      cardSize: draft.cardSize || null,
      countryOfOrigin: draft.countryOfOrigin || null,
      upc: draft.upc || null,
      photos,
      status: "received",
      listing: null,
    };
  }

  // ── generateListing ────────────────────────────────────────────────────────
  async function generateListing() {
    // Client-side validation for lot listings — only Number of Cards is
    // truly required (eBay's category demands it). Lot contents is optional;
    // when empty, the server falls back to a generic lot description.
    if (isLot) {
      if (!cardCount || parseInt(cardCount, 10) < 2) {
        patchDraft({ error: "Lot listings need a Number of Cards (≥ 2)." });
        return;
      }
    }
    patchDraft({ generating: true, error: "" });
    const cardData = buildCardData();
    try {
      // Phase 1: quick
      const r1 = await fetch("/api/admin/listings/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "quick", ...cardData }),
      });
      if (!r1.ok) {
        const e = await r1.json().catch(() => ({}));
        throw new Error(e.error || `Generate failed (${r1.status})`);
      }
      const d1 = await r1.json();
      const gradeCompanyEbay = graded
        ? (GRADER_TO_EBAY[gradeCompany] ?? gradeCompany ?? "")
        : "";
      patchDraft({
        title:         d1.title ?? "",
        startPrice:    d1.suggestedStartPrice ? String(d1.suggestedStartPrice) : "",
        buyItNowPrice: d1.suggestedBuyItNow  ? String(d1.suggestedBuyItNow)   : "",
        // Sync card-detail state into the draft so ListingForm widgets are pre-filled
        playerOverride:       player,
        yearOverride:         year,
        manufacturerOverride: manufacturer,
        setOverride:          set,
        cardNumberOverride:   cardNumber,
        cardName:             [year, set, subset].filter(v => v?.trim()).join(" "),
        parallel:             subset,
        season:               year,
        vintage:              !!(parseInt(year) && parseInt(year) < 1980),
        sport,
        league: team ? "" : (SPORT_LEAGUE[sport] ?? ""),
        team,
        conditionType:   graded ? "graded" : "ungraded",
        gradeCompanyEbay,
        gradeEbay:       grade,
        certNumberEbay:  certNumber,
        autographedEbay: autographed,
        signedBy,
      });

      // Phase 2: description
      const r2 = await fetch("/api/admin/listings/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "description", ...cardData }),
      });
      if (!r2.ok) {
        const e = await r2.json().catch(() => ({}));
        throw new Error(e.error || `Description generate failed (${r2.status})`);
      }
      const d2 = await r2.json();
      patchDraft({
        description: d2.description ?? "",
        open: true,
        generating: false,
      });
    } catch (e) {
      patchDraft({ error: String(e), generating: false });
    }
  }

  // ── saveDraft ──────────────────────────────────────────────────────────────
  async function saveDraft() {
    patchDraft({ saving: true, saved: false });
    try {
      const body = {
        // Card fields
        player,
        year: parseInt(year) || null,
        manufacturer,
        set,
        subset,
        cardNumber,
        sport:  draft.sport  || sport,
        team:   draft.team   || team,
        league: draft.league || null,
        season: draft.season || null,
        parallel: draft.parallel || null,
        features: draft.features,
        graded,
        grade,
        gradeCompany,
        certNumber,
        autographed,
        signedBy: draft.signedBy || signedBy || null,
        autographAuthentication: draft.autographAuthentication || null,
        autographAuthNumber:     draft.autographAuthNumber     || null,
        autographFormat:         draft.autographFormat         || null,
        condition,
        photos,
        notes,
        purchasePrice: parseFloat(purchasePrice) || null,
        // Listing fields
        title: draft.title,
        subtitle: draft.subtitle,
        description: draft.description,
        startPrice: parseFloat(draft.startPrice) || 0,
        buyItNowPrice: parseFloat(draft.buyItNowPrice) || null,
        reservePrice: parseFloat(draft.reservePrice) || null,
        listingType: draft.listingType,
        auctionDuration: draft.auctionDuration,
        categoryId: draft.categoryId,
        freeShipping: draft.freeShipping,
        allowOffers: draft.allowOffers,
        minimumOffer: parseFloat(draft.minimumOffer) || null,
        autoAcceptOffer: parseFloat(draft.autoAcceptOffer) || null,
        flatRateShipping: parseFloat(draft.flatRateShipping) || null,
        shippingMethod: draft.shippingMethod,
        shippingCostType: draft.shippingCostType,
        excludedLocations: draft.excludedLocations,
        combinedShippingRule: draft.combinedShippingRule,
        weightLbs: parseInt(draft.weightLbs) || 0,
        weightOz: parseFloat(draft.weightOz) || 3,
        dimLength: parseFloat(draft.dimLength) || 11,
        dimWidth: parseFloat(draft.dimWidth) || 6,
        dimHeight: parseFloat(draft.dimHeight) || 1,
        privateListing: draft.privateListing,
        scheduledTime: draft.scheduledTime || null,
        material: draft.material,
        conditionType: draft.conditionType || null,
        gradeCompanyEbay: draft.gradeCompanyEbay || null,
        gradeEbay: draft.gradeEbay || null,
        certNumberEbay: draft.certNumberEbay || null,
        cardCondition: draft.cardCondition || null,
        cardName: draft.cardName || null,
        cardType: draft.cardType || null,
        cardSize: draft.cardSize || null,
        countryOfOrigin: draft.countryOfOrigin || null,
        vintage: draft.vintage,
        customized: draft.customized,
        language: draft.language,
        originalOrLicensed: draft.originalOrLicensed,
        californiaProp65: draft.californiaProp65 || null,
        cardThickness: draft.cardThickness,
        insertSet: draft.insertSet || null,
        printRun: draft.printRun || null,
        autographedEbay: draft.autographedEbay,
        customSpecifics: draft.customSpecifics,
        eventTournament: draft.eventTournament || null,
        upc: draft.upc || null,
        isLot,
        cardCount: isLot && cardCount ? parseInt(cardCount, 10) : null,
        lotContents: isLot ? (lotContents || null) : null,
      };

      let id = savedId;
      if (id) {
        const r = await fetch(`/api/admin/internal-listings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || `Save failed (${r.status})`);
        }
      } else {
        const r = await fetch("/api/admin/internal-listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || `Save failed (${r.status})`);
        }
        const d = await r.json();
        id = d.id;
        setSavedId(id);
      }
      patchDraft({ saving: false, saved: true, savedId: id ?? "" });
    } catch (e) {
      patchDraft({ saving: false, error: String(e) });
    }
  }

  // ── listOnEbay ─────────────────────────────────────────────────────────────
  async function listOnEbay() {
    if (!savedId) {
      alert("Save the listing first");
      return;
    }
    patchDraft({ listing: true, listingError: "" });
    setListError("");
    try {
      // Persist any in-memory edits (scheduling toggle, condition change,
      // etc.) before listing — the list-internal route reads from the DB,
      // so anything left in React state would be silently ignored.
      // Without this, toggling 'Schedule listing' after the last Save and
      // then clicking List on eBay caused the listing to publish
      // immediately because the DB still had scheduledTime=null.
      await saveDraft();
      const r = await fetch("/api/admin/ebay/list-internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingDbId: savedId }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `List on eBay failed (${r.status})`);
      }
      router.push("/admin/listings?tab=internal");
    } catch (e) {
      const msg = String(e);
      patchDraft({ listing: false, listingError: msg });
      setListError(msg);
    }
  }

  // ── addToBatch — flip the draft to "pending" on OUR side (no eBay call) ──
  //
  // The intent here is a Card-Cloud-side staging step. Once several drafts
  // are in 'pending', the operator goes to /admin/listings → Drafts and
  // publishes them in one parallel wave. This must NOT touch eBay.
  async function addToBatch() {
    if (!savedId) { alert("Save the listing first"); return; }
    patchDraft({ addingToBatch: true, listingError: "" });
    setListError("");
    try {
      // Persist any in-memory edits first so the queued draft reflects the
      // very latest changes (same belt-and-suspenders save listOnEbay does).
      await saveDraft();
      const r = await fetch(`/api/admin/internal-listings/${savedId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "pending" }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `Add to batch failed (${r.status})`);
      }
      // Land back on the Internal tab where the operator came from.
      // ?fast=1 skips the page's eBay sync block so the destination
      // renders from DB only — under a second instead of 20+.
      router.push("/admin/listings?tab=internal&fast=1");
    } catch (e) {
      const msg = String(e);
      patchDraft({ addingToBatch: false, listingError: msg });
      setListError(msg);
    }
  }

  // ── reviseOnEbay (for listings already live or scheduled on eBay) ─────────
  async function reviseOnEbay() {
    if (!savedId) {
      alert("Save your edits first, then click Revise on eBay.");
      return;
    }
    patchDraft({ listing: true, listingError: "" });
    setListError("");
    try {
      // Persist any unsaved edits before revising — the revise route reads from the DB.
      await saveDraft();
      const r = await fetch("/api/admin/ebay/revise-internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingDbId: savedId }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `Revise on eBay failed (${r.status})`);
      }
      router.push("/admin/listings?tab=internal");
    } catch (e) {
      const msg = String(e);
      patchDraft({ listing: false, listingError: msg });
      setListError(msg);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{e ? `Edit — ${e.player ?? "Internal Listing"}` : "New Internal Listing"}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {e ? "Edit this listing and revise it on eBay" : "List a card from your own inventory directly on eBay"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {e?.ebayListingId && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Discard your edits and re-import this listing fresh from eBay?")) return;
                const r = await fetch("/api/admin/ebay/import-direct", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ebayItemId: e.ebayListingId, force: true }),
                });
                const d = await r.json();
                if (!r.ok) { alert(d.error || "Re-import failed"); return; }
                router.push(`/admin/internal-listings/${d.id}`);
                router.refresh();
              }}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              ↻ Re-import from eBay
            </button>
          )}
          <Link
            href="/admin/listings?tab=internal"
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            ✕ Cancel
          </Link>
        </div>
      </div>

      {/* Card + Listing form — same card, same inline flow as consignment */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
      <div className="p-6 flex flex-col gap-4">
        <h2 className="text-navy font-semibold">Card Details</h2>

        {/* Photos */}
        <div>
          <label className="text-slate-400 text-xs mb-1 block">
            Photos (max 12)
          </label>
          <div className="flex flex-wrap gap-2">
            {photos.map((url, i) => (
              <div
                key={i}
                className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() =>
                    setPhotos((p) => p.filter((_, j) => j !== i))
                  }
                  className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < 12 && (
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-brand text-slate-400 text-2xl">
                +
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={async (ev) => {
                    const files = Array.from(ev.target.files ?? []);
                    setUploading(true);
                    const newUrls: string[] = [];
                    for (const f of files.slice(0, 12 - photos.length)) {
                      const fd = new FormData();
                      fd.append("file", f);
                      const r = await fetch("/api/upload", { method: "POST", body: fd });
                      if (r.ok) { const d = await r.json(); newUrls.push(d.url); }
                    }
                    setPhotos((p) => {
                      const updated = [...p, ...newUrls];
                      // Always scan first photo — AI detects graded vs raw and fills fields
                      if (p.length === 0 && newUrls.length > 0) {
                        scanSlab(newUrls[0]);
                      }
                      return updated;
                    });
                    setUploading(false);
                    ev.target.value = "";
                  }}
                />
              </label>
            )}
            {uploading && (
              <span className="text-slate-400 text-xs self-center">
                Uploading…
              </span>
            )}
          </div>
        </div>

        {/* Lot toggle */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <input
            type="checkbox"
            id="isLot"
            checked={isLot}
            onChange={(e) => setIsLot(e.target.checked)}
            className="accent-brand h-4 w-4"
          />
          <label htmlFor="isLot" className="text-sm text-navy font-medium cursor-pointer select-none flex-1">
            This listing is a <strong>lot of multiple cards</strong>
            <span className="text-slate-500 font-normal"> — auto-switches category to Trading Card Lots</span>
          </label>
        </div>

        {isLot && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Number of Cards *</label>
                <input
                  value={cardCount}
                  onChange={(e) => setCardCount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 50"
                  inputMode="numeric"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <p className="text-slate-400 text-xs mt-1">Required by eBay for the Trading Card Lots category</p>
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Cards included in the lot (optional)</label>
              <textarea
                value={lotContents}
                onChange={(e) => setLotContents(e.target.value)}
                placeholder={`Optional — list the cards in this lot, one per line, e.g.\n1989 Topps Ken Griffey Jr. #41\n1989 Upper Deck Ken Griffey Jr. #1\n1990 Topps Frank Thomas #414`}
                rows={6}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 font-mono"
              />
              <p className="text-slate-400 text-xs mt-1">If listed, the description generator bullets each card. If left blank, it describes the lot in general terms from the photos and other details.</p>
            </div>
          </div>
        )}

        {/* Player + Year */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">
              {isLot ? "Featured player (optional)" : "Player / Athlete *"}
            </label>
            <input
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              placeholder={isLot ? "Leave blank if a mixed lot" : "e.g. Bo Jackson"}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Year</label>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 1990"
              type="number"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        {/* Manufacturer + Set + Subset */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">
              Manufacturer
            </label>
            <input
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g. Topps"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Set</label>
            <input
              value={set}
              onChange={(e) => setSet(e.target.value)}
              placeholder="e.g. Archives"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Subset</label>
            <input
              value={subset}
              onChange={(e) => setSubset(e.target.value)}
              placeholder="e.g. Autoproofs"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        {/* Card Number + Print Run + Sport */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">
              Card Number
            </label>
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="e.g. #44"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">
              Print run
            </label>
            <input
              value={draft.printRun}
              onChange={(e) => patchDraft({ printRun: e.target.value })}
              placeholder="e.g. 058/300"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Sport</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">Select sport…</option>
              {[
                "Baseball",
                "Football",
                "Basketball",
                "Hockey",
                "Soccer",
                "Golf",
                "Tennis",
                "Boxing",
                "MMA",
                "Wrestling",
                "Pokémon",
                "Magic: The Gathering",
                "Yu-Gi-Oh!",
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Graded toggle */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setGraded(g => !g)}
              className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${
                graded ? "bg-brand" : "bg-slate-200"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  graded ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sm text-navy font-medium">Graded</span>
          </label>
          {graded && (
            <div className="flex gap-2 flex-1">
              <select
                value={gradeCompany}
                onChange={(e) => setGradeCompany(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">Grader…</option>
                {["PSA", "BGS", "SGC", "CGC", "CSG", "HGA", "GMA", "KSA"].map(
                  (g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  )
                )}
              </select>
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Grade (e.g. 10)"
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 w-24"
              />
              <input
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                placeholder="Cert #"
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 flex-1"
              />
            </div>
          )}
        </div>

        {/* Scan status */}
        {(scanning || scanMsg) && (
          <p className={`text-xs ${scanning ? "text-slate-400" : scanMsg.startsWith("✓") ? "text-green-600" : "text-amber-600"}`}>
            {scanning ? "⏳ " : ""}{scanMsg}
          </p>
        )}

        {/* Autographed toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => setAutographed((a) => !a)}
            className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${
              autographed ? "bg-brand" : "bg-slate-200"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                autographed ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          <span className="text-sm text-navy font-medium">Autographed</span>
        </label>
        {autographed && (
          <input
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            placeholder="Signed by…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        )}

        {/* Purchase price + Notes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">
              Purchase Price (internal)
            </label>
            <input
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="$0.00"
              type="number"
              step="0.01"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">
              Notes (internal)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any internal notes…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        {/* Generate button */}
        <div className="flex items-center gap-3 pt-2 flex-wrap">
          <button
            onClick={generateListing}
            disabled={!player.trim() || draft.generating}
            className="flex items-center gap-1.5 text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium whitespace-nowrap"
          >
            {draft.generating ? "Generating…" : "✨ Generate listing"}
          </button>
          {draft.error && <p className="text-red-500 text-xs">{draft.error}</p>}
        </div>
      </div>

      {/* Listing form — inline in same card, identical to consignment flow */}
      {(draft.open || draft.generating) && (
        <div className="border-t border-slate-100 bg-slate-50 p-5">
          <ListingForm
            item={buildItem()}
            draft={draft}
            inp={inp}
            sectionOrder={ebaySection}
            categories={categories}
            catStatus={catStatus}
            shippingRules={shippingRules}
            shippingRulesSrc={shippingRulesSrc}
            onPatch={patchDraft}
            onSave={saveDraft}
            onRedo={generateListing}
            onListOnEbay={listOnEbay}
            onAddToBatch={addToBatch}
            {...(e?.ebayListingId ? { onReviseOnEbay: reviseOnEbay } : {})}
            defaultScheduledTime={String(ebayDefaults.defaultScheduledTime ?? "22:00")}
            onClose={() => patchDraft({ open: false })}
          />
        </div>
      )}
    </div>
    </div>
  );
}
