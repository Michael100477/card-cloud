"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { EbayListingDefaults } from "@/lib/ebay-listing-defaults-shared";
import { EBAY_LD_FALLBACKS } from "@/lib/ebay-listing-defaults-shared";
import { LEAGUES, SPORTS, SPORT_LIST } from "@/lib/sports-data";

// Fallback categories used while/if the eBay API is unavailable
const FALLBACK_CATEGORIES: { label: string; id: string }[] = [
  { label: "Trading Card Singles",           id: "261328" },
  { label: "Sealed Trading Card Boxes",      id: "261328" },
  { label: "Sealed Trading Card Cases",      id: "261328" },
  { label: "Sealed Trading Card Packs",      id: "261328" },
  { label: "Trading Card Sets",              id: "261328" },
  { label: "Trading Card Lots",              id: "261328" },
  { label: "Trading Card Box & Case Breaks", id: "261328" },
  { label: "Trading Card Repacks",           id: "261328" },
  { label: "Uncut Trading Card Sheets",      id: "261328" },
  { label: "Storage & Display Supplies",     id: "261328" },
  { label: "Price Guides & Publications",    id: "261328" },
  { label: "Wrappers & Empty Card Boxes",    id: "261328" },
  { label: "Sport Trading Card NFTs",        id: "261328" },
];

interface Listing {
  id: string; status: string; title: string; url: string | null;
  startPrice: number; buyItNowPrice: number | null; soldPrice: number | null;
  subtitle: string | null; description: string;
  reservePrice: number | null; listingType: string | null; auctionDuration: number | null;
  freeShipping: boolean; allowOffers: boolean; minimumOffer: number | null; autoAcceptOffer: number | null;
  shippingMethod: string | null; shippingCostType: string | null; flatRateShipping: number | null;
  excludedLocations: string[]; combinedShippingRule: string | null;
  weightLbs: number | null; weightOz: number | null; dimLength: number | null; dimWidth: number | null; dimHeight: number | null;
  condition: string | null; conditionType: string | null;
  gradeCompanyEbay: string | null; gradeEbay: string | null; certNumberEbay: string | null; cardCondition: string | null;
  categoryId: string | null; sport: string | null; team: string | null; league: string | null; season: string | null;
  parallel: string | null; features: string[]; cardName: string | null; cardType: string | null;
  cardSize: string | null; countryOfOrigin: string | null;
  signedBy: string | null; autographAuthentication: string | null;
  autographFormat: string | null; autographAuthNumber: string | null; autographedEbay: boolean | null;
  material: string | null; vintage: boolean; customized: boolean;
  insertSet: string | null; printRun: string | null; customSpecifics: { name: string; value: string }[] | null;
  language: string | null; originalOrLicensed: string | null; californiaProp65: string | null; cardThickness: string | null;
  playerOverride: string | null; yearOverride: number | null; manufacturerOverride: string | null;
  setOverride: string | null; cardNumberOverride: string | null;
  scheduledTime: string | null; privateListing: boolean | null;
  // Live data from eBay — only populated for active listings
  currentBid: number | null; bidCount: number | null;
  watchCount: number | null; endTime: string | null;
  questionCount: number;
}

// Compact "Nd Nh left" countdown (kept in sync via the `now` useState below).
function timeLeft(endTime: string | null, now: number): string | null {
  if (!endTime) return null;
  const diffMs = new Date(endTime).getTime() - now;
  if (diffMs <= 0) return "ended";
  const m = Math.floor(diffMs / 60_000);
  if (m < 1)  return "ending soon";
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m left`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h left`;
}
function endLabel(endTime: string | null): string | null {
  if (!endTime) return null;
  return new Date(endTime).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour:    "numeric", minute: "2-digit",
  });
}

interface Item {
  id: string; player: string; year: number | null; manufacturer: string | null;
  set: string | null; subset: string | null; cardNumber: string | null; sport: string | null;
  graded: boolean; grade: string | null; gradeCompany: string | null; certNumber: string | null;
  numbered: boolean; serialNumber: string | null;
  autographed: boolean; signedBy: string | null;
  autographAuthentication: string | null; autographAuthNumber: string | null; autographFormat: string | null;
  condition: string | null; notes: string | null; askingPrice: number | null;
  listingType: string | null; desiredPrice: number | null;
  freeShipping: boolean; allowOffers: boolean; minimumOffer: number | null;
  team: string | null; league: string | null; season: string | null;
  parallel: string | null; features: string[];
  cardName: string | null; cardType: string | null; cardSize: string | null;
  countryOfOrigin: string | null; upc: string | null;
  photos: string[];
  status: string; listing: Listing | null;
}

interface Order {
  id: string; status: string; receiptCode: string | null; adminNotes: string | null;
  submittedAt: string; receivedAt: string | null;
  user: { id: string; email: string; displayName: string | null; username: string | null };
  items: Item[];
}

export interface ListingDraft {
  // Core listing
  title: string; subtitle: string; description: string; startPrice: string; buyItNowPrice: string; reservePrice: string;
  playerOverride: string; yearOverride: string; manufacturerOverride: string; setOverride: string; cardNumberOverride: string;
  shippingCostType: string;
  flatRateShipping: string;
  excludedLocations: string[];
  combinedShippingRule: string;
  weightLbs: string; weightOz: string;
  dimLength: string; dimWidth: string; dimHeight: string;
  schedulingEnabled: boolean;
  scheduledTime: string;
  privateListing: boolean;
  shippingMethod: string;
  ebayId: string; url: string;
  savedId: string; // DB id of the saved EbayListing record
  // eBay item specifics — all editable
  condition: string; team: string; league: string; season: string;
  parallel: string; features: string[]; cardName: string; cardType: string;
  cardSize: string; countryOfOrigin: string; upc: string;
  signedBy: string; autographAuthentication: string; autographFormat: string;
  freeShipping: boolean;
  allowOffers: boolean; minimumOffer: string; autoAcceptOffer: string;
  auctionDuration: number;
  listingType: string;
  autographedEbay: boolean;
  material: string;
  conditionType: string;
  gradeCompanyEbay: string;
  gradeEbay: string;
  certNumberEbay: string;
  cardCondition: string;
  categoryId: string;
  sport: string;
  // Extended item specifics
  autographAuthNumber: string;
  vintage: boolean;
  eventTournament: string;
  language: string;
  originalOrLicensed: string;
  californiaProp65: string;
  cardThickness: string;
  customized: boolean;
  insertSet: string;
  printRun: string;
  customSpecifics: { name: string; value: string }[];
  // UI state
  generating: boolean; generatingTitle: boolean; generatingDescription: boolean; open: boolean; saving: boolean; saved: boolean;
  listing: boolean; listingError: string;
  error: string; photosUsed: number;
}

// Typed accessors for the generic EbayListingDefaults record (module-level so
// draftFromItem can also use them without capturing the component closure).
function ldStr (ld: EbayListingDefaults, k: string, fb: string)  { return String(ld[k] ?? fb); }
function ldBool(ld: EbayListingDefaults, k: string, fb: boolean) { return typeof ld[k] === "boolean" ? ld[k] as boolean : fb; }
function ldNum (ld: EbayListingDefaults, k: string, fb: number)  { return typeof ld[k] === "number"  ? ld[k] as number  : fb; }

// emptyDraft is a closure — defined inside the component so it can read `ld` (the
// fetched defaults). A bare function reference is used where the component needs it.


// Maps the short grader codes used on the consignment form / slab scanner
// to the full display names expected by eBay's "Professional Grader" item specific.
const GRADER_TO_EBAY: Record<string, string> = {
  "PSA":  "Professional Sports Authenticator (PSA)",
  "BGS":  "Beckett Grading Services (BGS)",
  "BGGS": "Beckett Grading Services (BGS)",
  "BCCG": "Beckett Collects Club Grading (BCCG)",
  "BVG":  "Becket Vintage Grading (BVG)",
  "SGC":  "Sportscard Guaranty Corporation (SGC)",
  "CGC":  "Certified Guaranty Company (CGC)",
  "CSG":  "Certified Sports Guaranty (CSG)",
  "HGA":  "Other",
  "GMA":  "Gem Mint Authentication (GMA)",
  "KSA":  "K Sportscard Authentication (KSA)",
  "TAG":  "Technical Authentication & Grading (TAG)",
  "TCG":  "Trading Card Grading (TCG)",
  "AGS":  "Automated Grading Systems (AGS)",
  "DSG":  "Diamond Service Grading (DSG)",
  "ACE":  "Ace Grading (Ace)",
  "CGA":  "Card Grading Australia (CGA)",
};

// Builds a card name from year + set only — manufacturer is intentionally omitted.
// "Stadium Club" → "1994 Stadium Club", not "1994 Topps Stadium Club".
function buildCardName(year: number | null, set: string | null): string {
  const y = year ? String(year) : "";
  const s = (set ?? "").trim();
  return [y, s].filter(Boolean).join(" ");
}

const SPORT_LEAGUE: Record<string, string> = {
  "Baseball":   "MLB",
  "Football":   "NFL",
  "Basketball": "NBA",
  "Hockey":     "NHL",
  "Soccer":     "MLS",
  "Golf":       "PGA Tour",
  "Tennis":     "ATP Tour",
  "Boxing":     "Boxing (Various)",
  "MMA":        "UFC",
  "NASCAR":     "NASCAR Cup Series",
  "Wrestling":  "WWE",
};

const CARD_THICKNESS_OPTIONS = [
  "20 pt.", "35 pt.", "55 pt.", "59 pt.", "75 pt.", "79 pt.",
  "100 pt.", "108 pt.", "130 pt.", "138 pt.", "180 pt.", "197 pt.", "240 pt.", "360 pt.",
];

function draftFromItem(item: Item, ld: EbayListingDefaults = EBAY_LD_FALLBACKS): Partial<ListingDraft> {
  return {
    condition:               item.condition               ?? "",
    team:                    item.team                    ?? "",
    listingType:             item.listingType             ?? ldStr(ld, "listingType", "auction"),
    autographedEbay:         item.autographed,
    playerOverride:          item.player       ?? "",
    yearOverride:            item.year         ? String(item.year) : "",
    manufacturerOverride:    item.manufacturer ?? "",
    setOverride:             item.set          ?? "",
    cardNumberOverride:      item.cardNumber   ?? "",
    shippingCostType: ldStr(ld, "shippingCostType", "Calculated: Cost varies based on buyer location"),
    flatRateShipping: "",
    excludedLocations: ["Alaska/Hawaii", "US Territories and Protectorates"],
    combinedShippingRule: "",
    weightLbs: ldStr(ld, item.graded ? "weightLbsGraded" : "weightLbsUngraded", item.graded ? "0" : "0"),
    weightOz:  ldStr(ld, item.graded ? "weightOzGraded"  : "weightOzUngraded",  item.graded ? "3" : "1"),
    dimLength: ldStr(ld, item.graded ? "dimLengthGraded" : "dimLengthUngraded", item.graded ? "11.0" : "10.0"),
    dimWidth:  ldStr(ld, item.graded ? "dimWidthGraded"  : "dimWidthUngraded",  item.graded ? "6.0"  : "4.0"),
    dimHeight: ldStr(ld, item.graded ? "dimHeightGraded" : "dimHeightUngraded", item.graded ? "1.0"  : "1.0"),
    material:                ldStr(ld, "material", "Card Stock"),
    conditionType:           item.graded ? "graded" : "ungraded",
    gradeCompanyEbay:        GRADER_TO_EBAY[item.gradeCompany ?? ""] ?? item.gradeCompany ?? "",
    gradeEbay:               item.grade                   ?? "",
    certNumberEbay:          item.certNumber              ?? "",
    cardCondition:           ldStr(ld, "cardCondition", ""),
    sport:                   item.sport                   ?? "",
    league:                  item.league                  || SPORT_LEAGUE[item.sport ?? ""] || ldStr(ld, "league", ""),
    season:                  item.season                  ?? (item.year ? String(item.year) : ""),
    parallel:                item.parallel                ?? ldStr(ld, "parallel", ""),
    features:                item.features                ?? [],
    cardName:                item.cardName                || buildCardName(item.year, item.set),
    cardType:                item.cardType                || ldStr(ld, "cardType", "Sports Trading Card"),
    cardSize:                item.cardSize                || ldStr(ld, "cardSize", "Standard"),
    countryOfOrigin:         item.countryOfOrigin         || ldStr(ld, "countryOfOrigin", "United States"),
    upc:                     item.upc                     ?? ldStr(ld, "upc", ""),
    signedBy:                item.signedBy                ?? "",
    autographAuthentication: item.autographAuthentication ?? "",
    autographAuthNumber:     item.autographAuthNumber     ?? "",
    autographFormat:         item.autographFormat         ?? "",
    language:                ldStr(ld, "language", "English"),
    originalOrLicensed:      ldStr(ld, "originalOrLicensed", "Original"),
    cardThickness:           ldStr(ld, "cardThickness", "35 pt."),
    vintage:                 ldBool(ld, "vintage", false),
    customized:              ldBool(ld, "customized", false),
    customSpecifics:         [],
    freeShipping:            item.freeShipping            ?? ldBool(ld, "freeShipping", true),
    allowOffers:             item.allowOffers             ?? ldBool(ld, "allowOffers", false),
    minimumOffer:            item.minimumOffer != null ? String(item.minimumOffer) : "",
    autoAcceptOffer:         "",
  };
}

function draftFromListing(item: Item): Partial<ListingDraft> {
  const l = item.listing!;
  return {
    title:        l.title ?? "",
    subtitle:     l.subtitle ?? "",
    description:  l.description ?? "",
    startPrice:   String(l.startPrice),
    buyItNowPrice: l.buyItNowPrice  != null ? String(l.buyItNowPrice)  : "",
    reservePrice:  l.reservePrice   != null ? String(l.reservePrice)   : "",
    listingType:   l.listingType   ?? "auction",
    auctionDuration: l.auctionDuration ?? 7,
    freeShipping:    l.freeShipping,
    allowOffers:     l.allowOffers,
    minimumOffer:    l.minimumOffer    != null ? String(l.minimumOffer)    : "",
    autoAcceptOffer: l.autoAcceptOffer != null ? String(l.autoAcceptOffer) : "",
    shippingMethod:     l.shippingMethod   ?? "",
    shippingCostType:   l.shippingCostType ?? "",
    flatRateShipping:   l.flatRateShipping != null ? String(l.flatRateShipping) : "",
    excludedLocations:  l.excludedLocations  ?? [],
    combinedShippingRule: l.combinedShippingRule ?? "",
    weightLbs:  String(l.weightLbs ?? 0),
    weightOz:   l.weightOz  != null ? String(l.weightOz)  : "0",
    dimLength:  l.dimLength != null ? String(l.dimLength) : "11.0",
    dimWidth:   l.dimWidth  != null ? String(l.dimWidth)  : "6.0",
    dimHeight:  l.dimHeight != null ? String(l.dimHeight) : "1.0",
    condition:        l.condition ?? "",
    conditionType:    l.conditionType ?? "",
    gradeCompanyEbay: l.gradeCompanyEbay ?? "",
    gradeEbay:        l.gradeEbay ?? "",
    certNumberEbay:   l.certNumberEbay ?? "",
    cardCondition:    l.cardCondition ?? "",
    categoryId:       l.categoryId ?? "261328",
    sport:     l.sport  ?? item.sport  ?? "",
    team:      l.team   ?? item.team   ?? "",
    league:    l.league ?? item.league ?? "",
    season:    l.season ?? "",
    parallel:  l.parallel ?? "",
    features:  l.features ?? [],
    cardName:  l.cardName  ?? "",
    cardType:  l.cardType  ?? "",
    cardSize:  l.cardSize  ?? "",
    countryOfOrigin: l.countryOfOrigin ?? "",
    signedBy:                l.signedBy ?? "",
    autographAuthentication: l.autographAuthentication ?? "",
    autographFormat:         l.autographFormat ?? "",
    autographAuthNumber:     l.autographAuthNumber ?? "",
    autographedEbay:         l.autographedEbay ?? item.autographed,
    material:   l.material ?? "",
    vintage:    l.vintage  ?? false,
    customized: l.customized ?? false,
    insertSet:  l.insertSet ?? "",
    printRun:   l.printRun  ?? "",
    customSpecifics: l.customSpecifics ?? [],
    language:           l.language ?? "",
    originalOrLicensed: l.originalOrLicensed ?? "",
    californiaProp65:   l.californiaProp65 ?? "",
    cardThickness:      l.cardThickness ?? "",
    playerOverride:       l.playerOverride ?? "",
    yearOverride:         l.yearOverride != null ? String(l.yearOverride) : "",
    manufacturerOverride: l.manufacturerOverride ?? "",
    setOverride:          l.setOverride ?? "",
    cardNumberOverride:   l.cardNumberOverride ?? "",
    schedulingEnabled:    !!l.scheduledTime,
    scheduledTime:        l.scheduledTime ?? "",
    privateListing:       l.privateListing ?? false,
    savedId: l.id,
  };
}

const ITEM_STATUS_STYLE: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  received: "bg-blue-100 text-blue-700",
  missing:  "bg-red-100 text-red-600",
  listed:   "bg-purple-100 text-purple-700",
  sold:     "bg-green-100 text-green-700",
  returned: "bg-slate-100 text-slate-500",
};

export function ConsignmentOrderAdmin({ order: initial, ebaySection, ebayDefaults: ld = EBAY_LD_FALLBACKS }: {
  order: Order;
  ebaySection: string[];
  ebayDefaults?: EbayListingDefaults;
}) {
  function emptyDraft(): ListingDraft {
    return {
      title: "", subtitle: "", description: "", startPrice: "", buyItNowPrice: "", reservePrice: "",
      playerOverride: "", yearOverride: "", manufacturerOverride: "", setOverride: "", cardNumberOverride: "",
      shippingCostType: ldStr(ld, "shippingCostType", "Calculated: Cost varies based on buyer location"),
      flatRateShipping: "",
      excludedLocations: ["Alaska/Hawaii", "US Territories and Protectorates"],
      combinedShippingRule: "",
      weightLbs: ldStr(ld, "weightLbsGraded", "0"), weightOz: ldStr(ld, "weightOzGraded", "3"),
      dimLength: ldStr(ld, "dimLengthGraded", "11.0"), dimWidth: ldStr(ld, "dimWidthGraded", "6.0"), dimHeight: ldStr(ld, "dimHeightGraded", "1.0"),
      schedulingEnabled: false, scheduledTime: "", privateListing: ldBool(ld, "privateListing", false),
      shippingMethod: ldStr(ld, "shippingMethod", "Standard shipping: Small to medium items"),
      ebayId: "", url: "", savedId: "",
      condition: "", team: "", league: "", season: "",
      parallel: ldStr(ld, "parallel", ""), features: [], cardName: "", cardType: ldStr(ld, "cardType", "Sports Trading Card"), cardSize: ldStr(ld, "cardSize", "Standard"),
      countryOfOrigin: ldStr(ld, "countryOfOrigin", "United States"), upc: ldStr(ld, "upc", ""),
      signedBy: "", autographAuthentication: "", autographFormat: "",
      freeShipping: ldBool(ld, "freeShipping", true),
      allowOffers: ldBool(ld, "allowOffers", false), minimumOffer: "", autoAcceptOffer: "",
      auctionDuration: ldNum(ld, "auctionDuration", 7),
      listingType: ldStr(ld, "listingType", "auction"),
      autographedEbay: ldBool(ld, "autographedEbay", false),
      material: ldStr(ld, "material", "Card Stock"),
      conditionType: ldStr(ld, "conditionType", ""),
      gradeCompanyEbay: "",
      gradeEbay: "",
      certNumberEbay: "",
      cardCondition: ldStr(ld, "cardCondition", ""),
      categoryId: ldStr(ld, "categoryId", "261328"),
      sport: "",
      autographAuthNumber: "",
      vintage: ldBool(ld, "vintage", false),
      eventTournament: ldStr(ld, "eventTournament", ""),
      language: ldStr(ld, "language", "English"),
      originalOrLicensed: ldStr(ld, "originalOrLicensed", "Original"),
      californiaProp65: ldStr(ld, "californiaProp65", ""),
      cardThickness: ldStr(ld, "cardThickness", "35 pt."),
      customized: ldBool(ld, "customized", false),
      insertSet: ldStr(ld, "insertSet", ""),
      printRun: ldStr(ld, "printRun", ""),
      customSpecifics: [],
      generating: false, generatingTitle: false, generatingDescription: false, open: false, saving: false, saved: false,
      listing: false, listingError: "",
      error: "", photosUsed: 0,
    };
  }

  const router = useRouter();
  const [order,       setOrder]       = useState(initial);
  const [receiptCode, setReceiptCode] = useState(initial.receiptCode ?? "");
  const [adminNotes,  setAdminNotes]  = useState(initial.adminNotes ?? "");
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderSaved,  setOrderSaved]  = useState(false);
  const [drafts,      setDrafts]      = useState<Record<string, ListingDraft>>({});
  const [checkingIn,  setCheckingIn]  = useState<Record<string, { open: boolean; notes: string; saving: boolean }>>({});
  const [categories,    setCategories]    = useState<{ label: string; id: string }[]>(FALLBACK_CATEGORIES);
  const [catStatus,     setCatStatus]     = useState<"loading" | "ok" | "error">("loading");
  const [shippingRules,    setShippingRules]    = useState<{ id: string; name: string }[]>([]);
  const [shippingRulesSrc, setShippingRulesSrc] = useState<"loading" | "ok" | "none">("loading");

  // Ticking clock for the "time left" labels on active eBay listings.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/admin/ebay/shipping-rules")
      .then(r => r.json())
      .then(d => { setShippingRules(d.rules ?? []); setShippingRulesSrc(d.rules?.length ? "ok" : "none"); })
      .catch(() => setShippingRulesSrc("none"));
  }, []);

  useEffect(() => {
    fetch("/api/admin/ebay/categories")
      .then(r => r.json())
      .then(d => {
        if (d.categories?.length) {
          setCategories(d.categories);
          setCatStatus("ok");
        } else {
          setCatStatus("error");
        }
      })
      .catch(() => setCatStatus("error"));
  }, []);

  const userName = order.user.displayName ?? order.user.username ?? order.user.email;
  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder-slate-400";

  // ── Order-level actions ────────────────────────────────────────────────────

  async function markReceived() {
    if (!receiptCode.trim()) { alert("Enter a receipt code first."); return; }
    setOrderSaving(true);
    await fetch(`/api/admin/consignments/${order.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "received", receiptCode: receiptCode.trim(), adminNotes }),
    });
    setOrder(o => ({ ...o, status: "received", receiptCode: receiptCode.trim(), receivedAt: new Date().toISOString() }));
    setOrderSaving(false); setOrderSaved(true); setTimeout(() => setOrderSaved(false), 2500);
  }

  async function saveNotes() {
    setOrderSaving(true);
    await fetch(`/api/admin/consignments/${order.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNotes }),
    });
    setOrderSaving(false); setOrderSaved(true); setTimeout(() => setOrderSaved(false), 2500);
  }

  // ── List on eBay ────────────────────────────────────────────────────────

  async function listOnEbay(itemId: string) {
    const draft = drafts[itemId];
    const savedId = draft?.savedId || order.items.find(i => i.id === itemId)?.listing?.id;
    if (!savedId) { patchDraft(itemId, { listingError: "Save the listing first before listing on eBay." }); return; }

    patchDraft(itemId, { listing: true, listingError: "" });
    try {
      const r = await fetch("/api/admin/ebay/list", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingDbId: savedId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Listing failed");

      // Update item in state with the live eBay URL
      setOrder(o => ({
        ...o,
        items: o.items.map(i => i.id === itemId ? {
          ...i, status: "listed",
          listing: { ...i.listing!, status: "active", url: d.url, id: savedId,
            title: drafts[itemId]?.title ?? i.listing?.title ?? "",
            startPrice: Number(drafts[itemId]?.startPrice ?? i.listing?.startPrice ?? 0),
            buyItNowPrice: drafts[itemId]?.buyItNowPrice ? Number(drafts[itemId].buyItNowPrice) : null,
            soldPrice: null },
        } : i),
      }));
      patchDraft(itemId, { listing: false, url: d.url, ebayId: d.ebayListingId });
    } catch (e) {
      patchDraft(itemId, { listing: false, listingError: String(e) });
    }
  }

  // ── Delete draft listing ─────────────────────────────────────────────────

  async function deleteDraft(itemId: string, listingId: string) {
    if (!confirm("Delete this draft? You'll need to generate a new listing to relist.")) return;
    patchDraft(itemId, { saving: true, error: "" });
    const r = await fetch(`/api/admin/listings/${listingId}`, { method: "DELETE" });
    if (r.ok) {
      setOrder(o => ({
        ...o,
        items: o.items.map(i => i.id === itemId ? { ...i, listing: null } : i),
      }));
      patchDraft(itemId, emptyDraft());
    } else {
      const d = await r.json().catch(() => ({}));
      patchDraft(itemId, { saving: false, error: d.error ?? "Failed to delete draft" });
    }
  }

  // ── Revise live eBay listing ─────────────────────────────────────────────

  async function reviseOnEbay(itemId: string) {
    const savedId = drafts[itemId]?.savedId || order.items.find(i => i.id === itemId)?.listing?.id;
    if (!savedId) { patchDraft(itemId, { listingError: "Save changes first, then click Revise on eBay." }); return; }
    patchDraft(itemId, { listing: true, listingError: "" });
    try {
      const r = await fetch("/api/admin/ebay/revise", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingDbId: savedId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Revision failed");
      router.push("/admin/listings");
    } catch (e) {
      patchDraft(itemId, { listing: false, listingError: String(e) });
    }
  }

  // ── Card check-in ────────────────────────────────────────────────────────

  async function checkInCard(itemId: string, status: "received" | "missing") {
    const ci = checkingIn[itemId];
    setCheckingIn(p => ({ ...p, [itemId]: { ...p[itemId], saving: true } }));
    await fetch(`/api/admin/consignment-items/${itemId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, checkInNotes: ci?.notes ?? null }),
    });
    setOrder(o => ({
      ...o,
      status: o.items.filter(i => i.id !== itemId).every(i => i.status !== "pending") ? "in_progress" : o.status,
      items:  o.items.map(i => i.id === itemId ? { ...i, status, notes: ci?.notes || i.notes } : i),
    }));
    setCheckingIn(p => ({ ...p, [itemId]: { open: false, notes: "", saving: false } }));
  }

  function openCheckIn(itemId: string) {
    setCheckingIn(p => ({ ...p, [itemId]: { open: true, notes: p[itemId]?.notes ?? "", saving: false } }));
  }

  // ── Listing generation ────────────────────────────────────────────────────

  function patchDraft(itemId: string, patch: Partial<ListingDraft>) {
    setDrafts(d => ({ ...d, [itemId]: { ...(d[itemId] ?? emptyDraft()), ...patch } }));
  }

  // Shared payload builder so both phases send the same card details
  function cardPayload(item: Item) {
    return {
      player: item.player, year: item.year, manufacturer: item.manufacturer,
      set: item.set, subset: item.subset, cardNumber: item.cardNumber, sport: item.sport,
      graded: item.graded, grade: item.grade, gradeCompany: item.gradeCompany,
      certNumber: item.certNumber, numbered: item.numbered, serialNumber: item.serialNumber,
      autographed: item.autographed, notes: item.notes,
      askingPrice: item.askingPrice, listingType: item.listingType,
      desiredPrice: item.desiredPrice, allowOffers: item.allowOffers, minimumOffer: item.minimumOffer,
      signedBy: item.signedBy, autographAuthentication: item.autographAuthentication, autographFormat: item.autographFormat,
      condition: item.condition, team: item.team, league: item.league, season: item.season,
      parallel: item.parallel, features: item.features, cardName: item.cardName,
      cardType: item.cardType, cardSize: item.cardSize, countryOfOrigin: item.countryOfOrigin,
      upc: item.upc, photos: item.photos,
    };
  }

  async function generateListing(item: Item) {
    // Open the form INSTANTLY with all item-derived fields — zero AI wait time.
    // Title, pricing, and description are generated in the background.
    patchDraft(item.id, {
      ...draftFromItem(item, ld),
      open:                  true,
      generating:            false,
      generatingTitle:       true,
      generatingDescription: true,
      title:                 "",
      description:           "",
      error:                 "",
    });

    const payload = cardPayload(item);

    // ── Phase 1 (background): title + pricing via Haiku ───────────────────
    let generatedTitle = "";
    fetch("/api/admin/listings/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: "quick", ...payload }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        const isBIN = item.listingType === "buyitnow";
        generatedTitle = d.title ?? "";
        patchDraft(item.id, {
          generatingTitle: false,
          title:           generatedTitle,
          startPrice:      isBIN ? "" : (item.desiredPrice != null ? String(item.desiredPrice) : (d.suggestedStartPrice != null ? String(d.suggestedStartPrice) : "")),
          buyItNowPrice:   isBIN
            ? (item.desiredPrice != null ? String(item.desiredPrice) : (d.suggestedBuyItNow != null ? String(d.suggestedBuyItNow) : ""))
            : (d.suggestedBuyItNow != null ? String(d.suggestedBuyItNow) : ""),
          photosUsed: d.photosUsed ?? 0,
        });
      })
      .catch(e => patchDraft(item.id, { generatingTitle: false, error: String(e) }));

    // ── Phase 2 (background): description via Haiku/Sonnet ───────────────
    fetch("/api/admin/listings/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: "description", title: generatedTitle, ...payload }),
    })
      .then(r => r.json())
      .then(d => patchDraft(item.id, { generatingDescription: false, description: d.description ?? "" }))
      .catch(() => patchDraft(item.id, { generatingDescription: false }));
  }

  async function saveListing(itemId: string) {
    const draft = drafts[itemId];
    if (!draft?.title || !draft?.startPrice) {
      patchDraft(itemId, { error: "Title and start price are required." }); return;
    }
    if (!draft?.sport) {
      patchDraft(itemId, { error: "Sport is required." }); return;
    }
    patchDraft(itemId, { saving: true, error: "" });
    try {
      const r = await fetch("/api/admin/listings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consignmentItemId: itemId,
          title:         draft.title,
          subtitle:      draft.subtitle || null,
          description:   draft.description,
          startPrice:    parseFloat(draft.startPrice),
          buyItNowPrice: draft.buyItNowPrice ? parseFloat(draft.buyItNowPrice) : null,
          reservePrice:  draft.reservePrice  ? parseFloat(draft.reservePrice)  : null,
          scheduledTime: draft.schedulingEnabled && draft.scheduledTime ? draft.scheduledTime : null,
          privateListing: draft.privateListing,
          shippingMethod:        draft.shippingMethod,
          shippingCostType:      draft.shippingCostType,
          flatRateShipping:      draft.flatRateShipping ? parseFloat(draft.flatRateShipping) : null,
          excludedLocations:     draft.excludedLocations,
          combinedShippingRule:  draft.combinedShippingRule || null,
          weightLbs: draft.weightLbs ? parseInt(draft.weightLbs) : 0,
          weightOz:  draft.weightOz  ? parseFloat(draft.weightOz) : 0,
          dimLength: draft.dimLength ? parseFloat(draft.dimLength) : 0,
          dimWidth:  draft.dimWidth  ? parseFloat(draft.dimWidth)  : 0,
          dimHeight: draft.dimHeight ? parseFloat(draft.dimHeight) : 0,
          ebayListingId: draft.ebayId || null,
          url:           draft.url    || null,
          // Item specifics
          condition:               draft.condition               || null,
          team:                    draft.team                    || null,
          league:                  draft.league                  || null,
          season:                  draft.season                  || null,
          parallel:                draft.parallel                || null,
          features:                draft.features,
          cardName:                draft.cardName                || null,
          cardType:                draft.cardType                || null,
          cardSize:                draft.cardSize                || null,
          countryOfOrigin:         draft.countryOfOrigin         || null,
          upc:                     draft.upc                     || null,
          signedBy:                draft.signedBy                || null,
          autographAuthentication: draft.autographAuthentication || null,
          autographFormat:         draft.autographFormat         || null,
          freeShipping:            draft.freeShipping,
          allowOffers:             draft.allowOffers,
          minimumOffer:            draft.allowOffers && draft.minimumOffer    ? parseFloat(draft.minimumOffer)    : null,
          autoAcceptOffer:         draft.allowOffers && draft.autoAcceptOffer ? parseFloat(draft.autoAcceptOffer) : null,
          auctionDuration:         draft.auctionDuration,
          listingType:             draft.listingType,
          autographedEbay:         draft.autographedEbay,
          playerOverride:          draft.playerOverride       || null,
          yearOverride:            draft.yearOverride         || null,
          manufacturerOverride:    draft.manufacturerOverride || null,
          setOverride:             draft.setOverride          || null,
          cardNumberOverride:      draft.cardNumberOverride   || null,
          material:                draft.material         || "Card Stock",
          conditionType:           draft.conditionType    || null,
          gradeCompanyEbay:        draft.gradeCompanyEbay || null,
          gradeEbay:               draft.gradeEbay        || null,
          certNumberEbay:          draft.certNumberEbay   || null,
          cardCondition:           draft.cardCondition    || null,
          categoryId:              draft.categoryId,
          sport:                   draft.sport || null,
          autographAuthNumber:     draft.autographAuthNumber     || null,
          vintage:                 draft.vintage,
          eventTournament:         draft.eventTournament         || null,
          language:                draft.language                || "English",
          originalOrLicensed:      draft.originalOrLicensed      || "Original",
          californiaProp65:        draft.californiaProp65        || null,
          cardThickness:           draft.cardThickness           || "35 pt.",
          customized:              draft.customized,
          insertSet:               draft.insertSet               || null,
          printRun:                draft.printRun                || null,
          customSpecifics:         draft.customSpecifics,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) {
        patchDraft(itemId, { saving: false, error: d?.error ?? `Server error ${r.status} — check Admin → Logs` });
        return;
      }
      // Keep the form open so the "List on eBay" button is immediately visible
      patchDraft(itemId, { saving: false, saved: true, open: true, savedId: d.id });
      setOrder(o => ({
        ...o,
        items: o.items.map(i => i.id === itemId ? {
          ...i, status: "listed",
          listing: {
            ...(i.listing ?? {} as Listing),
            id: d.id, status: "draft", title: draft.title, url: draft.url || null,
            startPrice: parseFloat(draft.startPrice),
            buyItNowPrice: draft.buyItNowPrice ? parseFloat(draft.buyItNowPrice) : null,
            soldPrice: null,
          },
        } : i),
      }));
    } catch (e) {
      patchDraft(itemId, { saving: false, error: String(e) });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const pendingItems   = order.items.filter(i => i.status === "pending");
  const receivedItems  = order.items.filter(i => i.status === "received");
  const missingItems   = order.items.filter(i => i.status === "missing");
  const listedItems    = order.items.filter(i => i.status === "listed" || i.status === "sold");

  const allCheckedIn = order.items.every(i => i.status !== "pending");

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">{userName}&apos;s Consignment</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            <p className="text-slate-400 text-sm">{order.user.email}</p>
            <span className="text-slate-300 text-sm">·</span>
            <p className="text-slate-400 text-sm">
              Submitted <span className="text-navy font-medium">{new Date(order.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </p>
            {order.receivedAt && (
              <>
                <span className="text-slate-300 text-sm">·</span>
                <p className="text-slate-400 text-sm">
                  Received <span className="text-navy font-medium">{new Date(order.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  {order.receiptCode && <span className="text-slate-400 font-mono ml-1.5">#{order.receiptCode}</span>}
                </p>
              </>
            )}
          </div>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
          order.status === "pending"     ? "bg-amber-100 text-amber-700" :
          order.status === "received"    ? "bg-blue-100 text-blue-700"   :
          order.status === "in_progress" ? "bg-purple-100 text-purple-700" :
          order.status === "completed"   ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
        }`}>{order.status.replace("_"," ")}</span>
      </div>

      {/* ── STEP 1: Mark order received ── */}
      {order.status === "pending" && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <h2 className="text-amber-900 font-bold">Confirm you have the package</h2>
          </div>
          <p className="text-amber-700 text-sm mb-4 ml-8">
            Once the package arrives, enter any reference code (your own order number, tracking number, or anything you&apos;ll recognize) and click the button. This unlocks the card check-in step.
          </p>
          <div className="flex gap-2 ml-8">
            <input value={receiptCode} onChange={e => setReceiptCode(e.target.value)}
              placeholder="e.g. CC-001, tracking #, or any ID"
              className="flex-1 border border-amber-300 bg-white rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <button onClick={markReceived} disabled={orderSaving || !receiptCode.trim()}
              className="bg-amber-600 text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap">
              {orderSaving ? "Saving…" : "Package received →"}
            </button>
          </div>
          {orderSaved && <p className="text-green-600 text-xs mt-2 ml-8">✓ Saved</p>}
        </div>
      )}

      {/* ── STEP 2: Check in each card ── */}
      {(order.status === "received" || order.status === "in_progress") && pendingItems.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <h2 className="text-blue-900 font-bold">Check in each card</h2>
            </div>
            <span className="text-blue-600 text-sm font-medium">
              {order.items.filter(i => i.status !== "pending").length} / {order.items.length} done
            </span>
          </div>
          <p className="text-blue-700 text-sm mb-4 ml-8">
            Pull each card out of the package and match it to the list below. Click <strong>Received</strong> to confirm it&apos;s in hand, or <strong>Missing</strong> if it wasn&apos;t in the package.
          </p>

          <div className="flex flex-col gap-2 ml-8">
            {pendingItems.map(item => {
              const ci = checkingIn[item.id];
              return (
                <div key={item.id} className="bg-white rounded-xl border border-blue-200 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="text-navy font-semibold text-sm">{item.player}</p>
                      <p className="text-slate-400 text-xs">
                        {[item.year, item.manufacturer, item.set, item.subset].filter(Boolean).join(" · ")}
                        {item.cardNumber ? ` #${item.cardNumber}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.graded && <span className="text-xs bg-navy/10 text-navy px-1.5 py-0.5 rounded font-mono">{item.gradeCompany} {item.grade}</span>}
                        {item.autographed && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Auto</span>}
                        {item.numbered && item.serialNumber && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{item.serialNumber}</span>}
                        {item.certNumber && <span className="text-xs text-slate-400">Cert #{item.certNumber}</span>}
                      </div>
                    </div>
                    {!ci?.open ? (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => checkInCard(item.id, "received")}
                          className="flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <CheckIcon /> Received
                        </button>
                        <button
                          onClick={() => openCheckIn(item.id)}
                          className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          + Notes / Missing
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setCheckingIn(p => ({ ...p, [item.id]: { ...p[item.id], open: false } }))}
                        className="text-slate-400 text-xs hover:text-slate-600 shrink-0">✕</button>
                    )}
                  </div>
                  {/* Expanded notes / missing panel */}
                  {ci?.open && (
                    <div className="border-t border-blue-100 bg-slate-50 p-3.5 flex flex-col gap-2">
                      <textarea
                        value={ci.notes}
                        onChange={e => setCheckingIn(p => ({ ...p, [item.id]: { ...p[item.id], notes: e.target.value } }))}
                        rows={2}
                        placeholder="Condition notes (e.g. cracked case, different grade than stated)…"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => checkInCard(item.id, "received")} disabled={ci.saving}
                          className="flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                          {ci.saving ? <Spinner /> : <CheckIcon />} Mark received
                        </button>
                        <button onClick={() => checkInCard(item.id, "missing")} disabled={ci.saving}
                          className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-3 py-2 rounded-lg hover:bg-red-200 disabled:opacity-50">
                          {ci.saving ? <Spinner /> : "✕"} Not in package
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 3: Create listings ── */}
      {receivedItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {allCheckedIn && (
                <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
              )}
              <h2 className="text-navy font-semibold">
                Ready to list ({receivedItems.length})
              </h2>
            </div>
            {receivedItems.length > 1 && (
              <button
                onClick={() => receivedItems.forEach(item => { if (!drafts[item.id]?.open) generateListing(item); })}
                className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 font-medium flex items-center gap-1"
              >
                ✨ Generate all listings
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {receivedItems.map(item => {
              const draft = drafts[item.id] ?? emptyDraft();
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
                  {/* Card row */}
                  <div className="flex items-start justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">✓ In hand</span>
                        {item.listingType === "buyitnow"
                          ? <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-semibold">🏷️ Buy It Now</span>
                          : <span className="text-xs bg-navy/10 text-navy px-2 py-0.5 rounded-full font-semibold">🔨 Auction</span>
                        }
                        {item.desiredPrice != null && (
                          <span className="text-xs text-slate-500">
                            {item.listingType === "buyitnow" ? "BIN:" : "Start:"} ${item.desiredPrice.toLocaleString()}
                          </span>
                        )}
                        {item.notes && <span className="text-xs text-slate-400 italic">{item.notes}</span>}
                      </div>
                      <p className="text-navy font-semibold">{item.player}</p>
                      <p className="text-slate-400 text-sm mt-0.5">
                        {[item.year, item.manufacturer, item.set, item.subset].filter(Boolean).join(" · ")}
                        {item.cardNumber ? ` #${item.cardNumber}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {item.graded && <span className="text-xs bg-navy/10 text-navy px-2 py-0.5 rounded-full font-mono">{item.gradeCompany} {item.grade}</span>}
                        {item.autographed && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Auto</span>}
                        {item.numbered && item.serialNumber && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{item.serialNumber}</span>}
                        {item.askingPrice && <span className="text-xs text-amber-700">Asking ${item.askingPrice}</span>}
                        {item.photos.length > 0 && (
                          <span className="text-xs text-blue-600 font-medium">📷 {item.photos.length} photo{item.photos.length !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {(() => {
                        const hasDraft = !!(draft.savedId || item.listing?.status === "draft");
                        const listingId = draft.savedId || item.listing?.id;
                        const isLive    = !!(draft.url || item.listing?.status === "active");

                        // State 3: live on eBay
                        if (isLive) return (
                          <span className="text-green-600 text-xs font-medium">✓ Live on eBay</span>
                        );

                        // State 2: draft exists — show List on eBay + Delete draft
                        if (!draft.open && hasDraft) return (
                          <div className="flex flex-col gap-1.5 items-end">
                            <button onClick={() => listOnEbay(item.id)} disabled={draft.listing}
                              className="flex items-center gap-1.5 text-xs bg-[#e43137] text-white font-bold px-3 py-1.5 rounded-lg hover:bg-[#c0282d] disabled:opacity-50 whitespace-nowrap transition-colors">
                              {draft.listing ? <><Spinner /> Listing…</> : <><EbayIcon /> List on eBay</>}
                            </button>
                            {listingId && (
                              <button onClick={() => deleteDraft(item.id, listingId)}
                                className="text-slate-400 hover:text-red-500 text-xs transition-colors">
                                Delete draft
                              </button>
                            )}
                            {draft.listingError && (
                              <p className="text-red-500 text-xs max-w-xs text-right">{draft.listingError.slice(0, 120)}</p>
                            )}
                          </div>
                        );

                        // State 1: no draft — show Generate listing
                        if (!draft.open) return (
                          <button onClick={() => generateListing(item)} disabled={draft.generating}
                            className="flex items-center gap-1.5 text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium whitespace-nowrap">
                            {draft.generating ? <><Spinner />Generating…</> : <>✨ Generate listing</>}
                          </button>
                        );

                        return null;
                      })()}
                    </div>
                  </div>

                  {/* Inline listing form */}
                  {(draft.open || draft.generating) && (
                    <div className="border-t border-slate-100 bg-slate-50 p-5">
                      {false ? null : (  // form always opens immediately now
                        <ListingForm
                          item={item}
                          draft={draft}
                          inp={inp}
                          sectionOrder={ebaySection}
                          categories={categories}
                          catStatus={catStatus}
                          shippingRules={shippingRules}
                          shippingRulesSrc={shippingRulesSrc}
                          onPatch={patch => patchDraft(item.id, patch)}
                          onSave={() => saveListing(item.id)}
                          onRedo={() => generateListing(item)}
                          onListOnEbay={() => listOnEbay(item.id)}
                          onClose={() => patchDraft(item.id, { open: false })}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Missing cards */}
      {missingItems.length > 0 && (
        <div>
          <h2 className="text-navy font-semibold mb-2 flex items-center gap-2">
            <span className="text-red-500">⚠</span> Not received ({missingItems.length})
          </h2>
          <div className="flex flex-col gap-2">
            {missingItems.map(item => (
              <div key={item.id} className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-navy font-medium text-sm">{item.player}</p>
                  <p className="text-slate-400 text-xs">{[item.year, item.set].filter(Boolean).join(" · ")}{item.graded ? ` · ${item.gradeCompany} ${item.grade}` : ""}</p>
                  {item.notes && <p className="text-slate-500 text-xs italic mt-0.5">{item.notes}</p>}
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">Missing</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Already listed */}
      {listedItems.length > 0 && (
        <div>
          <h2 className="text-navy font-semibold mb-2">Listed / Sold ({listedItems.length})</h2>
          <div className="flex flex-col gap-2">
            {listedItems.map(item => {
              const draft = drafts[item.id] ?? emptyDraft();
              return (
                <div key={item.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <div className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-navy font-medium text-sm">{item.player}</p>
                      <p className="text-slate-400 text-xs">{[item.year, item.set].filter(Boolean).join(" · ")}{item.graded ? ` · ${item.gradeCompany} ${item.grade}` : ""}</p>
                      {item.listing && <p className="text-slate-500 text-xs mt-0.5 truncate max-w-xs">{item.listing.title}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ITEM_STATUS_STYLE[item.status] ?? ""}`}>{item.status}</span>
                      {item.listing?.url && <a href={item.listing.url} target="_blank" rel="noopener noreferrer" className="text-brand text-xs hover:underline">eBay →</a>}
                      {item.listing?.soldPrice && <span className="text-green-600 text-xs font-semibold">Sold ${item.listing.soldPrice.toLocaleString()}</span>}
                      {item.listing?.status === "active" && item.listing.currentBid != null && (item.listing.bidCount ?? 0) > 0 && (
                        <span className="text-green-700 text-xs font-semibold">${item.listing.currentBid.toFixed(2)} ({item.listing.bidCount} bid{item.listing.bidCount === 1 ? "" : "s"})</span>
                      )}
                      {item.listing?.status === "active" && (item.listing.watchCount ?? 0) > 0 && (
                        <span className="text-slate-500 text-xs" title="Watchers on eBay">👁 {item.listing.watchCount} watching</span>
                      )}
                      {(item.listing?.questionCount ?? 0) > 0 && (
                        <span className="text-amber-700 text-xs" title="Buyer questions in last 30 days">💬 {item.listing!.questionCount} question{item.listing!.questionCount === 1 ? "" : "s"}</span>
                      )}
                      {item.listing?.status === "active" && timeLeft(item.listing.endTime, now) && (
                        <>
                          <span className="text-navy text-xs">{timeLeft(item.listing.endTime, now)}</span>
                          <span className="text-slate-500 text-xs">ends {endLabel(item.listing.endTime)}</span>
                        </>
                      )}
                      {item.status === "listed" && item.listing?.status === "active" && !draft.open && (
                        <button
                          onClick={() => {
                            setDrafts(prev => ({
                              ...prev,
                              [item.id]: { ...emptyDraft(), ...draftFromItem(item, ld), ...draftFromListing(item), open: true },
                            }));
                          }}
                          className="text-brand text-xs hover:underline font-medium mt-0.5"
                        >
                          Edit listing
                        </button>
                      )}
                      {draft.saved && <span className="text-green-600 text-xs">✓ Revised</span>}
                    </div>
                  </div>
                  {draft.open && (
                    <div className="border-t border-slate-100 bg-slate-50 p-5">
                      <ListingForm
                        item={item}
                        draft={draft}
                        inp={inp}
                        sectionOrder={ebaySection}
                        categories={categories}
                        catStatus={catStatus}
                        shippingRules={shippingRules}
                        shippingRulesSrc={shippingRulesSrc}
                        onPatch={patch => patchDraft(item.id, patch)}
                        onSave={() => saveListing(item.id)}
                        onRedo={() => generateListing(item)}
                        onListOnEbay={() => listOnEbay(item.id)}
                        onReviseOnEbay={() => reviseOnEbay(item.id)}
                        onClose={() => patchDraft(item.id, { open: false })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin notes */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-navy font-semibold text-sm mb-2">Internal notes</h2>
        <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3}
          placeholder="Notes for your records…" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 mb-2" />
        <div className="flex items-center gap-2">
          <button onClick={saveNotes} disabled={orderSaving}
            className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50">
            {orderSaving ? "Saving…" : "Save notes"}
          </button>
          {orderSaved && <span className="text-green-600 text-xs">✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}

function EbayErrorPanel({ error }: { error: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied,   setCopied]   = useState(false);

  // Try to extract a human-readable summary from the eBay error JSON
  let summary = error;
  let detail  = "";
  try {
    const match = error.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const errs   = parsed.errors ?? parsed.Errors ?? [];
      if (errs.length > 0) {
        summary = errs[0].longMessage ?? errs[0].message ?? errs[0].ShortMessage ?? error;
        detail  = JSON.stringify(parsed, null, 2);
      }
    }
  } catch { /* leave summary as-is */ }

  function copy() {
    navigator.clipboard.writeText(error).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-red-700 text-xs font-semibold mb-1">eBay listing failed</p>
          <p className="text-red-600 text-sm leading-snug">{summary}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={copy}
            className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-2 py-1 transition-colors bg-white">
            {copied ? "✓ Copied" : "Copy"}
          </button>
          {detail && (
            <button onClick={() => setExpanded(e => !e)}
              className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-2 py-1 transition-colors bg-white">
              {expanded ? "Hide" : "Details"}
            </button>
          )}
        </div>
      </div>
      {expanded && detail && (
        <pre className="mt-2 text-xs text-red-700 bg-red-100 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
          {detail}
        </pre>
      )}
      <p className="text-red-400 text-xs mt-2">
        Full error also logged to PM2 — run <code className="bg-red-100 px-1 rounded">pm2 logs card-cloud-app --lines 50</code> in the terminal for the complete trace.
      </p>
    </div>
  );
}

function CheckIcon() { return <span className="text-sm leading-none">✓</span>; }
function Spinner() { return <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />; }
function EbayIcon() {
  return (
    <svg width="48" height="20" viewBox="0 0 200 80" fill="currentColor" aria-hidden="true">
      <text x="0" y="65" fontFamily="Arial" fontWeight="bold" fontSize="80" fill="white">ebay</text>
    </svg>
  );
}

// ── ListingForm ───────────────────────────────────────────────────────────────
// Renders the eBay listing form with sections in the admin-configured order.

const UNGRADED_CONDITIONS = [
  { label: "Near mint or better",  description: "Comparable to a fresh pack",                    value: "Near mint or better"  },
  { label: "Excellent",            description: "Has clearly visible signs of wear",               value: "Excellent"            },
  { label: "Very good",            description: "Has moderate-to-heavy damage all oversized",      value: "Very good"            },
  { label: "Poor",                 description: "Is extremely worn and displays flaws all over",   value: "Poor"                 },
];

// For lot listings (eBay category 183444), Card Condition uses eBay's
// standard New / Used inventory conditions. Labels and descriptions match
// what eBay displays in its own listing flow so the seller sees the same
// language on both sides.
const LOT_CONDITIONS = [
  { label: "New",  description: "A brand-new, unused, unopened, undamaged item (including handmade items). See the seller's listing for full details.", value: "New"  },
  { label: "Used", description: "An item that has been used previously. See the seller's listing for full details and description of any imperfections.", value: "Used" },
];

export function ListingForm({ item, draft, inp, sectionOrder, categories, catStatus, shippingRules, shippingRulesSrc, onPatch, onSave, onRedo, onListOnEbay, onReviseOnEbay, onClose, defaultScheduledTime }: {
  item: Item;
  draft: ListingDraft;
  inp: string;
  sectionOrder: string[];
  categories: { label: string; id: string }[];
  catStatus: "loading" | "ok" | "error";
  shippingRules: { id: string; name: string }[];
  shippingRulesSrc: "loading" | "ok" | "none";
  onPatch: (p: Partial<ListingDraft>) => void;
  onSave: () => void;
  onRedo: () => void;
  onListOnEbay: () => void;
  onReviseOnEbay?: () => void;
  onClose: () => void;
  defaultScheduledTime?: string;
}) {
  const [graders,    setGraders]    = useState<string[]>([]);
  const [graderSrc,  setGraderSrc]  = useState<"loading" | "ebay" | "fallback">("loading");

  useEffect(() => {
    fetch("/api/admin/ebay/graders")
      .then(r => r.json())
      .then(d => { setGraders(d.graders ?? []); setGraderSrc(d.source === "ebay" ? "ebay" : "fallback"); })
      .catch(() => setGraderSrc("fallback"));
  }, []);
  const si   = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-brand/30 placeholder-slate-300";
  const ro   = si + " bg-slate-50 text-slate-500";
  const dimmed = "opacity-40 pointer-events-none";
  const L = (t: string) => <label className="text-slate-400 text-xs mb-1 block">{t}</label>;
  const fi = (field: keyof ListingDraft, ph = "") => (
    <input value={(draft[field] as string) ?? ""} onChange={e => onPatch({ [field]: e.target.value } as Partial<ListingDraft>)} placeholder={ph} className={si} />
  );
  const locked = (lbl: string, val: string | number | null | undefined) => (
    <div>{L(lbl)}<div className={ro}>{val ?? <span className="text-slate-300">—</span>}</div></div>
  );
  const addCustom = () => onPatch({ customSpecifics: [...draft.customSpecifics, { name: "", value: "" }] });
  const setCustom = (i: number, k: "name" | "value", v: string) =>
    onPatch({ customSpecifics: draft.customSpecifics.map((s, j) => j === i ? { ...s, [k]: v } : s) });
  const rmCustom = (i: number) =>
    onPatch({ customSpecifics: draft.customSpecifics.filter((_, j) => j !== i) });

  // allowOverflow: pass true for sections containing absolute-positioned dropdowns
  const wrap = (key: string, label: string, content: React.ReactNode, allowOverflow = false) => (
    <div key={key} className={`border border-slate-200 rounded-xl ${allowOverflow ? "" : "overflow-hidden"}`}>
      <p className={`text-xs font-semibold text-slate-500 uppercase tracking-wide px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 ${allowOverflow ? "rounded-t-xl" : ""}`}>{label}</p>
      <div className="p-3.5">{content}</div>
    </div>
  );

  function renderSection(key: string): React.ReactNode {
    switch (key) {

      case "ebay_title":
        return wrap(key, "Title & Subtitle", (
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 text-xs">Title</label>
                {draft.generatingTitle
                  ? <span className="flex items-center gap-1 text-xs text-slate-400"><span className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin inline-block" /> Generating…</span>
                  : <span className={`text-xs ${draft.title.length > 80 ? "text-red-500" : "text-slate-400"}`}>{draft.title.length}/80</span>
                }
              </div>
              <input
                value={draft.title}
                onChange={e => onPatch({ title: e.target.value })}
                placeholder={draft.generatingTitle ? "Writing title…" : ""}
                className={si + (draft.generatingTitle ? " opacity-50" : "")}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 text-xs">Subtitle <span className="text-slate-300">(optional)</span></label>
                <span className={`text-xs ${draft.subtitle.length > 55 ? "text-red-500" : "text-slate-400"}`}>{draft.subtitle.length}/55</span>
              </div>
              <input value={draft.subtitle} onChange={e => onPatch({ subtitle: e.target.value.slice(0, 55) })} placeholder="e.g. PSA 10 Gem Mint · Ships Fast" className={si} />
            </div>
          </div>
        ));

      case "ebay_description":
        return wrap(key, "Description", (
          <div className="relative">
            <textarea
              ref={el => {
                if (el) {
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
              value={draft.description}
              onChange={e => {
                onPatch({ description: e.target.value });
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              rows={3}
              placeholder={draft.generatingDescription ? "" : "Listing description…"}
              className={si + " resize-none overflow-hidden w-full" + (draft.generatingDescription ? " opacity-50" : "")}
            />
            {draft.generatingDescription && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none">
                <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-500 font-medium">Writing description…</span>
              </div>
            )}
          </div>
        ));

      case "ebay_pricing": {
        const isAuction = draft.listingType === "auction";
        return wrap(key, draft.generatingTitle ? "Pricing  ·  generating…" : "Pricing", (
          <div className="flex flex-col gap-3">
            {/* Listing type toggle */}
            <div>
              {L("Listing type")}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                {(["auction", "buyitnow"] as const).map(t => (
                  <button key={t} type="button" onClick={() => onPatch({ listingType: t })}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${draft.listingType === t ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
                    {t === "auction" ? "🔨 Auction" : "🏷️ Buy It Now"}
                  </button>
                ))}
              </div>
            </div>
            {/* Prices — dim the one that doesn't apply */}
            <div className="grid grid-cols-2 gap-3">
              <div className={isAuction ? "" : dimmed}>
                {L(isAuction ? "Start price *" : "Start price (n/a)")}
                <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                  <input type="number" step="0.01" value={draft.startPrice} onChange={e => onPatch({ startPrice: e.target.value })} placeholder="0.99" className={si + " pl-6"} /></div>
              </div>
              <div className={!isAuction ? "" : dimmed}>
                {L(!isAuction ? "Buy It Now price *" : "Buy It Now (optional)")}
                <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                  <input type="number" step="0.01" value={draft.buyItNowPrice} onChange={e => onPatch({ buyItNowPrice: e.target.value })} placeholder={isAuction ? "Optional" : "49.99"} className={si + " pl-6"} /></div>
              </div>
              <div className={isAuction ? "" : dimmed}>
                {L("Reserve price (optional)")}
                <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                  <input type="number" step="0.01" value={draft.reservePrice} onChange={e => onPatch({ reservePrice: e.target.value })} placeholder="Hidden minimum to sell" className={si + " pl-6"} /></div>
              </div>
            </div>
          </div>
        ));
      }

      case "ebay_category":
        return wrap(key, "Category", (
          <div>
            <div className="flex items-center justify-between mb-1">
              {L("eBay category")}
              <span className="text-xs text-slate-400">
                {catStatus === "loading" && "Loading from eBay…"}
                {catStatus === "ok"      && "✓ Live from eBay"}
                {catStatus === "error"   && "⚠ Fallback IDs"}
              </span>
            </div>
            <select value={draft.categoryId} onChange={e => onPatch({ categoryId: e.target.value })} className={si + " bg-white"}>
              <option value=""></option>
              {/* If the current categoryId isn't in the loaded categories list
                  (e.g. set via the lot toggle to 261329 before eBay's API
                  responds, or set to a leaf the API doesn't surface), show a
                  synthetic option so the select still displays it. */}
              {draft.categoryId && !categories.some(c => c.id === draft.categoryId) && (
                <option value={draft.categoryId}>
                  {draft.categoryId === "261329" ? "Trading Card Lots" : `Category #${draft.categoryId}`} ({draft.categoryId})
                </option>
              )}
              {categories.map(c => <option key={c.id} value={c.id}>{c.label} ({c.id})</option>)}
            </select>
          </div>
        ));

      case "ebay_duration":
        return draft.listingType === "auction" ? wrap(key, "Auction Duration", (
          <div className="flex gap-2">
            {[1, 3, 5, 7, 10].map(days => (
              <button key={days} type="button" onClick={() => onPatch({ auctionDuration: days })}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${draft.auctionDuration === days ? "bg-navy text-white border-navy" : "bg-white text-slate-600 border-slate-200 hover:border-navy"}`}>
                {days}d
              </button>
            ))}
          </div>
        )) : null;

      case "ebay_card_identity":
        return wrap(key, "Card Identity", (
          <div className="grid grid-cols-2 gap-2.5">
            {/* Row 1 */}
            <div>
              {L("Player / Athlete")}
              <input value={draft.playerOverride} onChange={e => onPatch({ playerOverride: e.target.value })}
                placeholder={item.player ?? ""} className={si} />
              {draft.playerOverride && draft.playerOverride !== item.player && (
                <p className="text-slate-400 text-xs mt-0.5">Consignment: {item.player}</p>
              )}
            </div>
            <div>{L("Season")}{fi("season", "1986 or 2023-24")}</div>
            {/* Row 2 */}
            <div>
              {L("Year manufactured")}
              <input value={draft.yearOverride} onChange={e => onPatch({ yearOverride: e.target.value })}
                type="number" min={1800} max={2099} placeholder={item.year ? String(item.year) : ""} className={si} />
              {draft.yearOverride && draft.yearOverride !== String(item.year ?? "") && (
                <p className="text-slate-400 text-xs mt-0.5">Consignment: {item.year}</p>
              )}
            </div>
            <div>
              {L("Card number")}
              <input value={draft.cardNumberOverride} onChange={e => onPatch({ cardNumberOverride: e.target.value })}
                placeholder={item.cardNumber ?? ""} className={si} />
              {draft.cardNumberOverride && draft.cardNumberOverride !== item.cardNumber && (
                <p className="text-slate-400 text-xs mt-0.5">Consignment: {item.cardNumber}</p>
              )}
            </div>
            {/* Row 3 */}
            <div>
              {L("Manufacturer")}
              <input value={draft.manufacturerOverride} onChange={e => onPatch({ manufacturerOverride: e.target.value })}
                placeholder={item.manufacturer ?? ""} className={si} />
              {draft.manufacturerOverride && draft.manufacturerOverride !== item.manufacturer && (
                <p className="text-slate-400 text-xs mt-0.5">Consignment: {item.manufacturer}</p>
              )}
            </div>
            <div>
              {L("Set")}
              <input value={draft.setOverride} onChange={e => onPatch({ setOverride: e.target.value })}
                placeholder={item.set ?? ""} className={si} />
              {draft.setOverride && draft.setOverride !== item.set && (
                <p className="text-slate-400 text-xs mt-0.5">Consignment: {item.set}</p>
              )}
            </div>
            {/* Row 4 */}
            <div>{L("Parallel / Variety")}{fi("parallel", "[Base], Gold…")}</div>
            <div>{L("Card name")}{fi("cardName", item.player ?? "")}</div>
            {/* Row 5 */}
            <div>{L("Print run")}{fi("printRun")}</div>
            <div>{L("Type")}{fi("cardType", "Sports Trading Card")}</div>
            {/* Row 6 */}
            <div>{L("Event / Tournament")}{fi("eventTournament")}</div>
            <div>{L("Insert set")}{fi("insertSet")}</div>
            {/* Row 7 — Features spans full width */}
            <div className="col-span-2">
              {L("Features (comma-separated)")}
              <input value={draft.features.join(", ")} onChange={e => onPatch({ features: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="Rookie Card, Refractor…" className={si} />
            </div>
          </div>
        ));

      case "ebay_features":
        return null; // merged into ebay_card_identity

      case "ebay_compliance":
        return wrap(key, "UPC & Compliance", (
          <div className="grid grid-cols-2 gap-2.5">
            <div>{L("UPC")}{fi("upc")}</div>
            <div>{L("California Prop 65 warning")}{fi("californiaProp65")}</div>
          </div>
        ));

      case "ebay_sport":
        return wrap(key, "Sport *", (
          <div>
            <select
              value={draft.sport}
              onChange={e => {
                const s = e.target.value;
                onPatch({ sport: s, league: SPORT_LEAGUE[s] || draft.league });
              }}
              className={si + " bg-white" + (!draft.sport ? " border-red-300 focus:ring-red-300" : "")}
            >
              <option value="" disabled>Select sport…</option>
              <option value=""></option>
              {SPORT_LIST.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {!draft.sport && (
              <p className="text-red-500 text-xs mt-1">Sport is required before saving.</p>
            )}
          </div>
        ));

      case "ebay_team_league": {
        const leagueData = LEAGUES.find(l => l.label === draft.league);
        const teamOptions = leagueData?.teams ?? [];
        return wrap(key, "League & Team", (
          <div className="grid grid-cols-2 gap-2.5">
            {/* League — LEFT */}
            <div>
              {L("League")}
              <select
                value={draft.league}
                onChange={e => onPatch({ league: e.target.value })}
                className={si + " bg-white"}
              >
                <option value="" disabled>Select league…</option>
                <option value=""></option>
                {SPORTS.map(sport => {
                  const sportLeagues = LEAGUES.filter(l => l.sport === sport);
                  return (
                    <optgroup key={sport} label={sport}>
                      {sportLeagues.map(l => (
                        <option key={l.label} value={l.label}>{l.label}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            {/* Team — RIGHT (custom searchable combobox) */}
            <div>
              {L("Team")}
              <TeamCombobox
                value={draft.team}
                onChange={v => onPatch({ team: v })}
                teams={teamOptions}
                si={si}
              />
            </div>
          </div>
        ), true);
      }

      case "ebay_physical":
        return wrap(key, "Physical Attributes", (
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              {L("Card thickness")}
              <select value={draft.cardThickness} onChange={e => onPatch({ cardThickness: e.target.value })} className={si + " bg-white"}>
                <option value=""></option>
                {THICKNESS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              {L("Material")}
              <select value={draft.material} onChange={e => onPatch({ material: e.target.value })} className={si + " bg-white"}>
                <option value=""></option>
                {["Aluminum","Card Stock","Metal","Paper","Paperboard","Plastic"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              {L("Card size")}
              <select value={draft.cardSize} onChange={e => onPatch({ cardSize: e.target.value })} className={si + " bg-white"}>
                <option value=""></option>
                {["Booklet","Bowman","Japanese","Oversized","Standard","Tall","Tobacco","Widevision"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>{L("Country of origin")}{fi("countryOfOrigin", "United States")}</div>
            <div>{L("Language")}{fi("language", "English")}</div>
            <div>
              {L("Original or licensed reprint")}
              <select value={draft.originalOrLicensed} onChange={e => onPatch({ originalOrLicensed: e.target.value })} className={si + " bg-white"}>
                <option value=""></option>
                <option value="Original">Original</option>
                <option value="Licensed Reprint">Licensed Reprint</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => onPatch({ vintage: !draft.vintage })} className={`w-8 rounded-full relative transition-colors ${draft.vintage ? "bg-brand" : "bg-slate-200"}`} style={{ height: "18px" }}>
                  <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${draft.vintage ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-xs text-slate-700 font-medium">Vintage</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => onPatch({ customized: !draft.customized })} className={`w-8 rounded-full relative transition-colors ${draft.customized ? "bg-brand" : "bg-slate-200"}`} style={{ height: "18px" }}>
                  <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${draft.customized ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-xs text-slate-700 font-medium">Customized</span>
              </label>
            </div>
          </div>
        ));

      case "ebay_features":
        return wrap(key, "Features & Variants", (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2">
              {L("Features (comma-separated)")}
              <input value={draft.features.join(", ")} onChange={e => onPatch({ features: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="Rookie Card, Refractor…" className={si} />
            </div>
            <div>{L("Insert set")}{fi("insertSet")}</div>
            <div>{L("Print run")}{fi("printRun")}</div>
            <div>{L("Event / Tournament")}{fi("eventTournament")}</div>
            <div>{L("California Prop 65 warning")}{fi("californiaProp65")}</div>
          </div>
        ));

      case "ebay_condition":
        return wrap(key, "Condition", (
          <div className="flex flex-col gap-3">
            {/* Lot listings use a simple New/Used condition (eBay's Trading
                Card Lots category accepts these two values). Singles use the
                graded/ungraded distinction. */}
            {draft.categoryId !== "261329" && (
              <div>
                {L("Condition type")}
                <select
                  value={draft.conditionType}
                  onChange={e => onPatch({ conditionType: e.target.value })}
                  className={si + " bg-white" + (!draft.conditionType ? " border-amber-300" : "")}
                >
                  <option value="">Select condition type…</option>
                  <option value="graded">Graded — Professionally graded</option>
                  <option value="ungraded">Ungraded — Not in original package or professionally graded</option>
                </select>
              </div>
            )}

            {/* Item condition dropdown — only for Trading Card Lots category.
                eBay's listing UI calls this "Item condition" (not Card or Lot
                Condition) so we match that label. */}
            {draft.categoryId === "261329" && (
              <div>
                {L("Item condition")}
                <select
                  value={draft.cardCondition}
                  onChange={e => onPatch({ cardCondition: e.target.value })}
                  className={si + " bg-white" + (!draft.cardCondition ? " border-amber-300" : "")}
                >
                  <option value="" disabled>Select condition…</option>
                  {LOT_CONDITIONS.map(c => (
                    <option key={c.value} value={c.value}>
                      {c.label} — {c.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Graded sub-fields — only for singles (lots are sold as a
                bundle, not individually graded) */}
            {draft.categoryId !== "261329" && draft.conditionType === "graded" && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    {L("Professional grader")}
                    <span className="text-xs text-slate-400">
                      {graderSrc === "loading" && "Loading…"}
                      {graderSrc === "ebay"    && "✓ Live from eBay"}
                      {graderSrc === "fallback" && "Fallback list"}
                    </span>
                  </div>
                  <select
                    value={draft.gradeCompanyEbay}
                    onChange={e => onPatch({ gradeCompanyEbay: e.target.value })}
                    className={si + " bg-white"}
                  >
                    <option value="" disabled>Select grading company…</option>
                    <option value=""></option>
                    {graders.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  {L("Grade")}
                  <input
                    value={draft.gradeEbay}
                    onChange={e => onPatch({ gradeEbay: e.target.value })}
                    placeholder="e.g. 10, 9.5"
                    className={si}
                  />
                </div>
                <div>
                  {L("Certification number")}
                  <input
                    value={draft.certNumberEbay}
                    onChange={e => onPatch({ certNumberEbay: e.target.value })}
                    placeholder="e.g. 12345678"
                    className={si}
                  />
                </div>
              </>
            )}

            {/* Ungraded "Card condition" sub-field — only for singles. For
                lots, the Item condition (New / Used) dropdown above is the
                only condition selector eBay accepts. */}
            {draft.categoryId !== "261329" && draft.conditionType === "ungraded" && (
              <div>
                {L("Card condition")}
                <select
                  value={draft.cardCondition}
                  onChange={e => onPatch({ cardCondition: e.target.value })}
                  className={si + " bg-white"}
                >
                  <option value="" disabled>Select condition…</option>
                  <option value=""></option>
                  {UNGRADED_CONDITIONS.map(c => (
                    <option key={c.value} value={c.value}>
                      {c.label} — {c.description}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ));

      case "ebay_autograph":
        return wrap(key, "Autograph Details", (
          <div className="flex flex-col gap-3">
            {/* Toggle — overrides what the user selected on the consignment form */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-medium text-slate-700">Autographed</p>
                {item.autographed !== draft.autographedEbay && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Consignment says {item.autographed ? "Yes" : "No"} — overridden here
                  </p>
                )}
              </div>
              <div
                onClick={() => onPatch({ autographedEbay: !draft.autographedEbay })}
                className={`w-10 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${draft.autographedEbay ? "bg-brand" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${draft.autographedEbay ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
            </label>
            <div className={`grid grid-cols-2 gap-2.5 ${draft.autographedEbay ? "" : dimmed}`}>
              <div>{L("Signed by")}{fi("signedBy", "Player name")}</div>
              <div>{L("Authentication")}{fi("autographAuthentication", "PSA/DNA, Beckett…")}</div>
              <div>{L("Auth number")}{fi("autographAuthNumber")}</div>
              <div>
                {L("Autograph format")}
                <input
                  list="autograph-format-suggestions"
                  value={draft.autographFormat}
                  onChange={e => onPatch({ autographFormat: e.target.value })}
                  placeholder="Pick a suggestion or type your own"
                  className={si}
                />
                <datalist id="autograph-format-suggestions">
                  <option value="Label or Sticker" />
                  <option value="Hard Signed" />
                  <option value="Cut" />
                </datalist>
              </div>
            </div>
          </div>
        ));

      case "ebay_shipping": {
        const dimInp = "w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-navy text-center focus:outline-none focus:ring-1 focus:ring-brand/30";
        return wrap(key, "Shipping", (
          <div className="flex flex-col gap-4">
            <div>
              {L("Cost type")}
              <select value={draft.shippingCostType} onChange={e => onPatch({ shippingCostType: e.target.value })} className={si + " bg-white"}>
                <option value=""></option>
                <option value="Flat rate: Same cost regardless of buyer location">Flat rate: Same cost regardless of buyer location</option>
                <option value="Calculated: Cost varies based on buyer location">Calculated: Cost varies based on buyer location</option>
              </select>
            </div>
            {/* Buyer pays — only shown for flat rate */}
            {draft.shippingCostType === "Flat rate: Same cost regardless of buyer location" && (
              <div>
                {L("Buyer pays")}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={draft.flatRateShipping}
                    onChange={e => {
                      const val = e.target.value;
                      // A flat rate cost means shipping isn't free
                      onPatch({ flatRateShipping: val, ...(val ? { freeShipping: false } : {}) });
                    }}
                    placeholder="0.00"
                    className={si + " pl-6"}
                  />
                </div>
              </div>
            )}
            <div>
              {L("Shipping method")}
              <select value={draft.shippingMethod} onChange={e => onPatch({ shippingMethod: e.target.value })} className={si + " bg-white"}>
                <option value=""></option>
                <option value="Standard shipping: Small to medium items">Standard shipping: Small to medium items</option>
                <option value="Freight: Oversized items">Freight: Oversized items</option>
                <option value="Local pickup only: Sell to buyers near you">Local pickup only: Sell to buyers near you</option>
              </select>
            </div>

            {/* Package weight */}
            <div>
              <label className="text-slate-500 text-sm font-medium block mb-2">Package weight</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" value={draft.weightLbs}
                  onChange={e => onPatch({ weightLbs: e.target.value })}
                  className={dimInp + " w-20"} placeholder="0" />
                <span className="text-slate-500 text-sm">lbs.</span>
                <input type="number" min="0" max="15" step="0.1" value={draft.weightOz}
                  onChange={e => onPatch({ weightOz: e.target.value })}
                  className={dimInp + " w-20"} placeholder="0" />
                <span className="text-slate-500 text-sm">oz.</span>
              </div>
            </div>

            {/* Package dimensions */}
            <div>
              <label className="text-slate-500 text-sm font-medium block mb-2">Package dimensions</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.1" value={draft.dimLength}
                  onChange={e => onPatch({ dimLength: e.target.value })}
                  className={dimInp} placeholder="0" />
                <span className="text-slate-500 text-sm">in.</span>
                <span className="text-slate-300 text-sm font-medium">×</span>
                <input type="number" min="0" step="0.1" value={draft.dimWidth}
                  onChange={e => onPatch({ dimWidth: e.target.value })}
                  className={dimInp} placeholder="0" />
                <span className="text-slate-500 text-sm">in.</span>
                <span className="text-slate-300 text-sm font-medium">×</span>
                <input type="number" min="0" step="0.1" value={draft.dimHeight}
                  onChange={e => onPatch({ dimHeight: e.target.value })}
                  className={dimInp} placeholder="0" />
                <span className="text-slate-500 text-sm">in.</span>
              </div>
              <p className="text-slate-400 text-xs mt-1.5">
                {Number(draft.weightLbs) > 0 ? `${draft.weightLbs} lbs ` : ""}
                {draft.weightOz ? `${draft.weightOz} oz` : "0 oz"},{" "}
                {[draft.dimLength, draft.dimWidth, draft.dimHeight].map(v => v || "0").join(" × ")} in.
              </p>
            </div>

            {/* Combined shipping rule */}
            <div>
              <div className="flex items-center justify-between mb-1">
                {L("Combined shipping rule (optional)")}
                <span className="text-xs text-slate-400">
                  {shippingRulesSrc === "loading" && "Loading…"}
                  {shippingRulesSrc === "ok"      && "✓ From your eBay account"}
                  {shippingRulesSrc === "none"    && "No rules found in your account"}
                </span>
              </div>
              <select
                value={draft.combinedShippingRule}
                onChange={e => onPatch({ combinedShippingRule: e.target.value })}
                className={si + " bg-white"}
              >
                <option value="">None</option>
                {shippingRules.map(r => (
                  <option key={r.id} value={r.id}>{r.name || r.id}</option>
                ))}
              </select>
            </div>

            {/* Excluded locations */}
            <div>
              {L("Excluded locations")}
              <div className="flex flex-col gap-1.5 mt-1">
                {[
                  { value: "Alaska/Hawaii",                       label: "Alaska / Hawaii" },
                  { value: "US Territories and Protectorates",    label: "US Territories & Protectorates (Puerto Rico, Guam, USVI, etc.)" },
                  { value: "APO/FPO",                             label: "APO / FPO (Military addresses)" },
                  { value: "PO Box",                              label: "PO Box" },
                  { value: "Freight",                             label: "Freight" },
                ].map(opt => {
                  const checked = draft.excludedLocations.includes(opt.value);
                  return (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onPatch({
                          excludedLocations: checked
                            ? draft.excludedLocations.filter(l => l !== opt.value)
                            : [...draft.excludedLocations, opt.value],
                        })}
                        className="mt-0.5 accent-brand shrink-0"
                      />
                      <span className="text-xs text-slate-700">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => onPatch({
                  freeShipping: !draft.freeShipping,
                  // Enabling free shipping clears any flat rate amount
                  ...(!draft.freeShipping ? { flatRateShipping: "" } : {}),
                })}
                className={`w-8 rounded-full relative transition-colors ${draft.freeShipping ? "bg-green-600" : "bg-slate-200"}`}
                style={{ height: "18px" }}>
                <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${draft.freeShipping ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-xs text-slate-700 font-medium">Free shipping</span>
              {draft.freeShipping && <span className="text-xs text-green-600">✓ Promoted by eBay</span>}
            </label>
          </div>
        ));
      }

      case "ebay_offers":
        return wrap(key, "Offers", (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => onPatch({ allowOffers: !draft.allowOffers })} className={`w-8 rounded-full relative transition-colors ${draft.allowOffers ? "bg-brand" : "bg-slate-200"}`} style={{ height: "18px" }}>
                <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${draft.allowOffers ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-xs text-slate-600 font-medium">Accept offers</span>
            </label>
            {draft.allowOffers && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {L("Minimum offer")}
                  <p className="text-slate-400 text-xs mb-1">eBay auto-declines below this amount.</p>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                    <input type="number" step="0.01" value={draft.minimumOffer}
                      onChange={e => onPatch({ minimumOffer: e.target.value })}
                      placeholder="e.g. 25.00" className={si + " pl-6"} />
                  </div>
                </div>
                <div>
                  {L("Auto-accept price")}
                  <p className="text-slate-400 text-xs mb-1">eBay auto-accepts at or above this.</p>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                    <input type="number" step="0.01" value={draft.autoAcceptOffer}
                      onChange={e => onPatch({ autoAcceptOffer: e.target.value })}
                      placeholder="e.g. 45.00" className={si + " pl-6"} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ));

      case "ebay_schedule":
        return (
          <div key={key} className="border border-slate-200 rounded-xl p-3.5">
            <ScheduleWidget
              enabled={draft.schedulingEnabled}
              scheduledTime={draft.scheduledTime}
              defaultTime={defaultScheduledTime}
              onPatch={onPatch}
            />
          </div>
        );

      case "ebay_private":
        return wrap(key, "Private Listing", (
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-medium text-slate-700">Private listing</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Buyer and bidder usernames are hidden from public view.
                </p>
              </div>
              <div
                onClick={() => onPatch({ privateListing: !draft.privateListing })}
                className={`w-10 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${draft.privateListing ? "bg-brand" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${draft.privateListing ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
            </label>
          </div>
        ));

      case "ebay_custom":
        return wrap(key, "Custom Item Specifics", (
          <div className="flex flex-col gap-2">
            {draft.customSpecifics.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={s.name}  onChange={e => setCustom(i, "name",  e.target.value)} placeholder="Name"  className={si + " flex-1"} />
                <input value={s.value} onChange={e => setCustom(i, "value", e.target.value)} placeholder="Value" className={si + " flex-1"} />
                <button type="button" onClick={() => rmCustom(i)} className="text-slate-400 hover:text-red-400 text-xs px-1">✕</button>
              </div>
            ))}
            <button type="button" onClick={addCustom} className="text-xs text-brand hover:underline font-medium self-start">+ Add custom specific</button>
          </div>
        ));

      default: return null;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header — always first */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-navy font-semibold text-sm">eBay Listing</p>
          {draft.photosUsed > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              📷 {draft.photosUsed} photo{draft.photosUsed !== 1 ? "s" : ""} used by AI
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 text-xs hover:text-slate-600">✕ Close</button>
      </div>

      {/* Photo strip — always shown when photos exist */}
      {item.photos.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-blue-800 text-xs font-semibold mb-2">
            📷 {item.photos.length} photo{item.photos.length !== 1 ? "s" : ""} — will be uploaded to eBay automatically
          </p>
          <div className="flex gap-2 flex-wrap">
            {item.photos.map((url, pi) => (
              <a key={pi} href={url} target="_blank" rel="noopener noreferrer"
                className="block w-16 h-20 rounded-lg overflow-hidden border-2 border-blue-200 hover:border-blue-400 transition-colors shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${pi + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Layout-driven sections — order set in Admin → Page Layout → eBay Listing */}
      {sectionOrder.map(key => renderSection(key))}

      {/* Fixed bottom: errors, buttons */}
      {draft.error && <p className="text-red-500 text-sm">{draft.error}</p>}
      {draft.listingError && (
        <EbayErrorPanel error={draft.listingError} />
      )}
      {!onReviseOnEbay && (
        <div className="flex gap-2">
          <button onClick={onSave} disabled={draft.saving || draft.saved}
            className="flex-1 bg-navy text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-navy/80 disabled:opacity-50">
            {draft.saving ? "Saving…" : draft.saved ? "✓ Saved" : "Save listing"}
          </button>
          <button onClick={onRedo} disabled={draft.generating}
            className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-xl hover:bg-brand/5 disabled:opacity-50">
            ↻ Redo
          </button>
        </div>
      )}
      {(draft.saved || draft.savedId) && !draft.url && !draft.listing && !onReviseOnEbay && (
        <p className="text-xs text-slate-500 text-center">
          ✓ Listing saved — click the button below to publish it live on eBay
        </p>
      )}
      {(draft.saved || draft.savedId) && !onReviseOnEbay && (
        <button onClick={onListOnEbay} disabled={draft.listing}
          className="w-full flex items-center justify-center gap-2 bg-[#e43137] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#c0282d] transition-colors disabled:opacity-50">
          {draft.listing ? (
            <><Spinner /> Uploading photos &amp; creating listing…</>
          ) : draft.url ? (
            <><span>✓ Listed on eBay</span><a href={draft.url} target="_blank" rel="noopener noreferrer" className="underline text-white/80 ml-1" onClick={e => e.stopPropagation()}>View →</a></>
          ) : (
            <><EbayIcon /> List on eBay</>
          )}
        </button>
      )}
      {onReviseOnEbay && (
        <button onClick={onReviseOnEbay} disabled={draft.listing}
          className="w-full flex items-center justify-center gap-2 bg-[#e43137] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#c0282d] transition-colors disabled:opacity-50">
          {draft.listing ? (
            <><Spinner /> Updating listing on eBay…</>
          ) : draft.saved ? (
            <>✓ Listing revised</>
          ) : (
            <><EbayIcon /> Revise on eBay</>
          )}
        </button>
      )}
    </div>
  );
}

// ── TeamCombobox ──────────────────────────────────────────────────────────────
// Searchable dropdown for teams — clicking the arrow always shows the full list.

function TeamCombobox({ value, onChange, teams, si }: {
  value: string;
  onChange: (v: string) => void;
  teams: string[];
  si: string;
}) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep query in sync when value changes externally
  useEffect(() => { setQuery(value); }, [value]);

  // Close when clicking outside. Commit whatever the user typed (free-text) — eBay's Team
  // aspect is FREE_TEXT so custom team names are valid. Only revert if the input is empty.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        const typed = query.trim();
        if (typed && typed !== value) onChange(typed);
        else if (!typed) setQuery(value);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [value, query, onChange]);

  const filtered = query
    ? teams.filter(t => t.toLowerCase().includes(query.toLowerCase()))
    : teams;

  function select(team: string) {
    onChange(team);
    setQuery(team);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={teams.length ? "Search or browse teams…" : "Enter team name…"}
          className={si + " pr-8"}
        />
        {/* Arrow button — always shows the full list */}
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={e => {
            e.preventDefault();
            if (open) { setOpen(false); } else { setQuery(""); setOpen(true); }
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
          {/* Blank option — always first */}
          <button type="button"
            onMouseDown={e => { e.preventDefault(); select(""); }}
            className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 transition-colors ${
              value === "" ? "bg-brand/10 text-brand" : "hover:bg-slate-50"
            }`}
          >&nbsp;</button>
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-slate-400 text-xs">
              {teams.length ? `No teams match "${query}"` : "Select a league first"}
            </p>
          ) : (
            filtered.map(t => (
              <button key={t} type="button"
                onMouseDown={e => { e.preventDefault(); select(t); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  t === value ? "bg-brand/10 text-brand font-medium" : "text-navy hover:bg-slate-50"
                }`}>
                {t}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── ScheduleWidget ────────────────────────────────────────────────────────────

const SCHED_HOURS   = ["12","1","2","3","4","5","6","7","8","9","10","11"];
const SCHED_MINUTES = ["00","05","10","15","20","25","30","35","40","45","50","55"];

function ScheduleWidget({ enabled, scheduledTime, defaultTime, onPatch }: {
  enabled: boolean;
  scheduledTime: string;
  defaultTime?: string;  // "HH:MM" (24-hour) — default scheduled time from admin settings
  onPatch: (p: Partial<ListingDraft>) => void;
}) {
  const inp = "border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-navy bg-white focus:outline-none focus:ring-1 focus:ring-brand/30";

  // Parse existing ISO time or use sensible defaults. Use LOCAL date — toISOString gives
  // the UTC date, which can be the wrong day for timestamps near midnight.
  const parsed = scheduledTime ? new Date(scheduledTime) : null;
  const localDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const todayStr = localDateStr(new Date());

  // Parse defaultTime "HH:MM" → { hr12, min, ampm } so a brand-new listing
  // starts at the admin-configured default scheduled time.
  const dt = (defaultTime ?? "22:00").match(/^(\d{1,2}):(\d{2})$/);
  const defHr24 = dt ? Math.min(23, Math.max(0, parseInt(dt[1]))) : 22;
  const defMin  = dt ? dt[2] : "00";
  const defAmpm = defHr24 >= 12 ? "PM" : "AM";
  const defHr12 = String(defHr24 % 12 || 12);

  const [date, setDate] = useState(parsed ? localDateStr(parsed) : todayStr);
  const [hour, setHour] = useState(parsed ? String(parsed.getHours() % 12 || 12) : defHr12);
  const [min,  setMin]  = useState(parsed ? String(parsed.getMinutes()).padStart(2, "0") : defMin);
  const [ampm, setAmpm] = useState(parsed ? (parsed.getHours() >= 12 ? "PM" : "AM") : defAmpm);

  function commit(d: string, h: string, m: string, ap: string) {
    const [y, mo, dy] = d.split("-").map(Number);
    let hrs = parseInt(h);
    if (ap === "PM" && hrs !== 12) hrs += 12;
    if (ap === "AM" && hrs === 12) hrs = 0;
    // new Date(year, month, day, ...) creates a date in the BROWSER's local timezone.
    // .toISOString() correctly converts that to UTC.
    const local = new Date(y, mo - 1, dy, hrs, parseInt(m));
    onPatch({ scheduledTime: local.toISOString() });
  }

  // Show the user the actual browser timezone abbreviation (not a hardcoded "EST").
  const tzAbbr = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
    .formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value ?? "local";
  // Build a preview "your time → UTC" so the user can sanity-check before saving.
  const previewLocal = (() => {
    const [y, mo, dy] = date.split("-").map(Number);
    let hrs = parseInt(hour);
    if (ampm === "PM" && hrs !== 12) hrs += 12;
    if (ampm === "AM" && hrs === 12) hrs = 0;
    return new Date(y, mo - 1, dy, hrs, parseInt(min));
  })();

  return (
    <div>
      {/* Header row: title + toggle */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-navy">Schedule your listing</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Your listing goes live immediately, unless you select a time and date you want it to start.
          </p>
        </div>
        <div
          onClick={() => {
            const next = !enabled;
            onPatch({ schedulingEnabled: next });
            // When enabling scheduling, commit the displayed default
            // date/time immediately. Without this, draft.scheduledTime
            // stays empty unless the user touches a picker, and the
            // save logic (schedulingEnabled && scheduledTime) silently
            // resolves to null — eBay would then publish immediately.
            if (next && !scheduledTime) {
              commit(date, hour, min, ampm);
            }
          }}
          className={`w-10 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ml-4 mt-0.5 ${enabled ? "bg-brand" : "bg-slate-200"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
        </div>
      </div>

      {/* Date + time pickers — only shown when enabled */}
      {enabled && (
        <div className="flex items-end gap-5 mt-1">
          {/* Day */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Day</label>
            <input
              type="date"
              value={date}
              min={todayStr}
              onChange={e => { setDate(e.target.value); commit(e.target.value, hour, min, ampm); }}
              className={inp + " w-36"}
            />
          </div>

          {/* Time */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Time</label>
            <div className="flex items-center gap-1.5">
              <select value={hour} onChange={e => { setHour(e.target.value); commit(date, e.target.value, min, ampm); }} className={inp + " w-16"}>
                {SCHED_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-slate-400 text-sm font-medium">:</span>
              <select value={min} onChange={e => { setMin(e.target.value); commit(date, hour, e.target.value, ampm); }} className={inp + " w-16"}>
                {SCHED_MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={ampm} onChange={e => { setAmpm(e.target.value); commit(date, hour, min, e.target.value); }} className={inp + " w-16"}>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
              <span className="text-xs text-slate-400 font-medium">{tzAbbr}</span>
            </div>
          </div>
        </div>
      )}
      {enabled && (
        <p className="text-xs text-slate-500 mt-2">
          Will go live at <span className="font-medium text-navy">{previewLocal.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} {tzAbbr}</span>
        </p>
      )}
    </div>
  );
}

const THICKNESS_OPTIONS = [
  "20 pt.","35 pt.","55 pt.","59 pt.","75 pt.","79 pt.",
  "100 pt.","108 pt.","130 pt.","138 pt.","180 pt.","197 pt.","240 pt.","360 pt.",
];

function ItemSpecificsEditor({ item, draft, onChange }: {
  item: Item;
  draft: ListingDraft;
  onChange: (patch: Partial<ListingDraft>) => void;
}) {
  const [open, setOpen] = useState(true);

  // Shared input styles
  const si   = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:ring-1 focus:ring-brand/30 placeholder-slate-300";
  const ro   = si + " bg-slate-50 text-slate-500"; // read-only display
  const dimmed = "opacity-40 pointer-events-none";

  // Editable text field helper
  const fi = (field: keyof ListingDraft, ph = "") => (
    <input value={(draft[field] as string) ?? ""}
      onChange={e => onChange({ [field]: e.target.value } as Partial<ListingDraft>)}
      placeholder={ph} className={si} />
  );

  // Toggle helper
  const tog = (field: keyof ListingDraft, lbl: string) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <div onClick={() => onChange({ [field]: !(draft[field] as boolean) } as Partial<ListingDraft>)}
        className={`w-8 rounded-full relative transition-colors shrink-0 ${draft[field] ? "bg-brand" : "bg-slate-200"}`}
        style={{ height: "18px" }}>
        <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${draft[field] ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-xs text-slate-700 font-medium">{lbl}</span>
    </label>
  );

  const L = (t: string) => <label className="text-slate-400 text-xs mb-1 block">{t}</label>;
  const S = (t: string) => (
    <div className="col-span-2 pt-2.5 pb-0.5 border-t border-slate-100 mt-1">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t}</p>
    </div>
  );
  // Read-only field from consignment item (locked, shown for reference)
  const locked = (lbl: string, val: string | number | null | undefined) => (
    <div>
      <label className="text-slate-400 text-xs mb-1 flex items-center gap-1 block">
        {lbl} <span className="text-slate-300 text-xs normal-case font-normal">(from consignment)</span>
      </label>
      <div className={ro}>{val ?? <span className="text-slate-300">—</span>}</div>
    </div>
  );

  const addCustom = () => onChange({ customSpecifics: [...draft.customSpecifics, { name: "", value: "" }] });
  const setCustom = (i: number, k: "name" | "value", v: string) =>
    onChange({ customSpecifics: draft.customSpecifics.map((s, j) => j === i ? { ...s, [k]: v } : s) });
  const rmCustom = (i: number) =>
    onChange({ customSpecifics: draft.customSpecifics.filter((_, j) => j !== i) });

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">eBay item specifics</span>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5">

          {/* ── Card identity ── */}
          {S("Card identity")}
          <div>{L("Player / Athlete")}<input value={draft.playerOverride} onChange={e => onChange({ playerOverride: e.target.value })} placeholder={item.player ?? ""} className={si} /></div>
          <div>{L("Card name (editable full title)")}{fi("cardName", item.player ?? "")}</div>
          <div>{L("Card number")}<input value={draft.cardNumberOverride} onChange={e => onChange({ cardNumberOverride: e.target.value })} placeholder={item.cardNumber ?? ""} className={si} /></div>
          <div>{L("Set")}<input value={draft.setOverride} onChange={e => onChange({ setOverride: e.target.value })} placeholder={item.set ?? ""} className={si} /></div>
          <div>{L("Parallel / Variety")}{fi("parallel", "[Base], Gold…")}</div>
          <div>{L("Manufacturer")}<input value={draft.manufacturerOverride} onChange={e => onChange({ manufacturerOverride: e.target.value })} placeholder={item.manufacturer ?? ""} className={si} /></div>
          <div>{L("Year manufactured")}<input value={draft.yearOverride} onChange={e => onChange({ yearOverride: e.target.value })} type="number" placeholder={item.year ? String(item.year) : ""} className={si} /></div>
          <div>{L("Season")}{fi("season", "1986 or 2023-24")}</div>
          <div>{L("UPC")}{fi("upc", "")}</div>
          <div>{L("Type")}{fi("cardType", "Sports Trading Card")}</div>

          {/* ── Team & league ── */}
          {S("Team & league")}
          <div>{L("Team")}{fi("team", "Kansas City Royals")}</div>
          <div>{L("League")}{fi("league", "MLB")}</div>

          {/* ── Physical ── */}
          {S("Physical")}
          <div>
            {L("Card thickness")}
            <select value={draft.cardThickness}
              onChange={e => onChange({ cardThickness: e.target.value })}
              className={si + " bg-white"}>
              <option value=""></option>
              {THICKNESS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>{L("Country of origin")}{fi("countryOfOrigin", "United States")}</div>
          <div>{L("Language")}{fi("language", "English")}</div>
          <div>
            {L("Original or licensed reprint")}
            <select value={draft.originalOrLicensed}
              onChange={e => onChange({ originalOrLicensed: e.target.value })}
              className={si + " bg-white"}>
              <option value=""></option>
              <option value="Original">Original</option>
              <option value="Licensed Reprint">Licensed Reprint</option>
            </select>
          </div>
          <div className="col-span-2 flex gap-6 pt-1">
            {tog("vintage",   "Vintage")}
            {tog("customized","Customized")}
          </div>

          {/* ── Features & variants ── */}
          {S("Features & variants")}
          <div className="col-span-2">
            {L("Features (comma-separated)")}
            <input
              value={draft.features.join(", ")}
              onChange={e => onChange({ features: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
              placeholder="Rookie Card, Refractor, Autograph…"
              className={si}
            />
          </div>
          <div>{L("Insert set")}{fi("insertSet")}</div>
          <div>{L("Print run")}{fi("printRun")}</div>
          <div>{L("Event / Tournament")}{fi("eventTournament")}</div>
          <div>{L("California Prop 65 warning")}{fi("californiaProp65")}</div>

          {/* ── Autograph ── */}
          {S("Autograph")}
          <div className="col-span-2">
            <p className="text-xs text-slate-500 mb-1">
              Autographed:{" "}
              <strong className={item.autographed ? "text-green-600" : "text-slate-400"}>
                {item.autographed ? "Yes" : "No"}
              </strong>
              <span className="text-slate-400 ml-1.5">(from consignment form)</span>
            </p>
          </div>
          <div className={item.autographed ? "" : dimmed}>{L("Signed by")}{fi("signedBy", "Player name")}</div>
          <div className={item.autographed ? "" : dimmed}>{L("Autograph authentication")}{fi("autographAuthentication", "PSA/DNA, Beckett…")}</div>
          <div className={item.autographed ? "" : dimmed}>{L("Auth number")}{fi("autographAuthNumber")}</div>
          <div className={item.autographed ? "" : dimmed}>
            {L("Autograph format")}
            <input
              list="autograph-format-suggestions-2"
              value={draft.autographFormat}
              onChange={e => onChange({ autographFormat: e.target.value })}
              placeholder="Pick a suggestion or type your own"
              className={si}
            />
            <datalist id="autograph-format-suggestions-2">
              <option value="Label or Sticker" />
              <option value="Hard Signed" />
              <option value="Cut" />
            </datalist>
          </div>

          {/* ── Shipping & offers ── */}
          {S("Shipping & offers")}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer mb-1">
              <div
                onClick={() => onChange({
                  freeShipping: !draft.freeShipping,
                  ...(!draft.freeShipping ? { flatRateShipping: "" } : {}),
                })}
                className={`w-8 rounded-full relative transition-colors ${draft.freeShipping ? "bg-green-600" : "bg-slate-200"}`}
                style={{ height: "18px" }}>
                <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${draft.freeShipping ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-xs text-slate-700 font-medium">Free shipping</span>
              {draft.freeShipping && <span className="text-xs text-green-600">✓ Promoted by eBay</span>}
            </label>
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <div onClick={() => onChange({ allowOffers: !draft.allowOffers })}
                className={`w-8 rounded-full relative transition-colors ${draft.allowOffers ? "bg-brand" : "bg-slate-200"}`}
                style={{ height: "18px" }}>
                <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${draft.allowOffers ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <span className="text-xs text-slate-600 font-medium">Accept offers</span>
            </label>
            {draft.allowOffers && (
              <div className="max-w-xs">
                {L("Minimum offer")}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                  <input type="number" step="0.01" value={draft.minimumOffer}
                    onChange={e => onChange({ minimumOffer: e.target.value })}
                    placeholder="25.00" className={si + " pl-6"} />
                </div>
              </div>
            )}
          </div>

          {/* ── Custom item specifics ── */}
          {S("Custom item specifics")}
          {draft.customSpecifics.map((s, i) => (
            <div key={i} className="col-span-2 flex gap-2 items-center">
              <input value={s.name}  onChange={e => setCustom(i, "name",  e.target.value)}
                placeholder="Specific name" className={si + " flex-1"} />
              <input value={s.value} onChange={e => setCustom(i, "value", e.target.value)}
                placeholder="Value" className={si + " flex-1"} />
              <button type="button" onClick={() => rmCustom(i)}
                className="text-slate-400 hover:text-red-400 text-xs px-1 shrink-0">✕</button>
            </div>
          ))}
          <div className="col-span-2">
            <button type="button" onClick={addCustom}
              className="text-xs text-brand hover:underline font-medium">
              + Add custom item specific
            </button>
          </div>

        </div>
      )}
    </div>
  );
}









