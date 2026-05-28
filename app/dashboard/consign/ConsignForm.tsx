"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CommissionRates } from "@/lib/commission";
import { gradeToCondition } from "@/lib/graders";
import type { GraderCardData } from "@/lib/graders";

interface CollectionCard {
  id: string; player: string; year: number; manufacturer: string; set: string;
  subset: string | null; cardNumber: string | null; sport: string | null;
  grade: string | null; gradeCompany: string | null; certNumber: string | null;
  serialNumber: string | null; tags: string[]; photos: string[];
}

interface ItemDraft {
  key:          string;
  cardId?:      string;
  photos:       string[];
  uploading:    boolean;
  // Required
  player:       string;
  year:         string;
  sport:        string;
  condition:    string;
  // Grading — required when graded=true
  graded:       boolean;
  grade:        string;
  gradeCompany: string;
  certNumber:   string;
  // Card identity
  manufacturer: string;
  set:          string;
  subset:       string;
  cardNumber:   string;
  // Special attributes
  numbered:     boolean;
  serialNumber: string;
  autographed:  boolean;
  signedBy:     string;
  autographAuthentication: string;
  autographAuthNumber:     string;
  autographFormat:         string;
  // Listing preference
  listingType:  "auction" | "buyitnow";
  desiredPrice: string;
  freeShipping: boolean;
  allowOffers:  boolean;
  minimumOffer: string;
  // Optional eBay specifics
  team:         string;
  league:       string;
  season:       string;
  parallel:     string;
  features:     string[];
  cardName:     string;
  cardType:     string;
  cardSize:     string;
  countryOfOrigin: string;
  upc:          string;
  notes:        string;
  // UI state
  expanded:          boolean;
  showOptional:      boolean;
}

const GRADERS    = ["PSA", "BGS", "BGGS", "SGC", "CGC", "HGA", "CSG"];
const CONDITIONS = [
  "Gem Mint", "Mint", "Near Mint-Mint", "Near Mint",
  "Excellent-Mint", "Excellent", "Very Good-Excellent",
  "Very Good", "Good", "Fair", "Poor",
];
const SPORTS = [
  "Baseball", "Football", "Basketball", "Hockey", "Soccer",
  "Golf", "Tennis", "Boxing", "MMA", "Wrestling",
  "Pokémon", "Magic: The Gathering", "Yu-Gi-Oh!", "Other",
];
const CARD_TYPES = ["Sports Trading Card", "Non-Sport Card", "Game Card", "Other"];
const CARD_SIZES = ["Standard", "Mini", "Oversized", "Jumbo", "Tall Boy"];
const FEATURES_LIST = [
  "Base Set", "Rookie Card", "Insert", "Refractor", "Prizm", "Holo",
  "Autograph", "Relic/Memorabilia", "Patch", "1st Edition",
  "Short Print", "Super Short Print", "Embossed", "Die Cut",
];
const MIN_SIDE = 800;

function blankItem(card?: CollectionCard): ItemDraft {
  return {
    key:          Math.random().toString(36).slice(2),
    cardId:       card?.id,
    photos:       card?.photos ?? [],
    uploading:    false,
    player:       card?.player ?? "",
    year:         card?.year?.toString() ?? "",
    sport:        card?.sport ?? "",
    graded:       !!card?.grade,
    grade:        card?.grade ?? "",
    gradeCompany: card?.gradeCompany ?? "",
    certNumber:   card?.certNumber ?? "",
    condition:    card?.grade && card?.gradeCompany
                    ? gradeToCondition(card.gradeCompany, card.grade)
                    : "",
    manufacturer: card?.manufacturer ?? "",
    set:          card?.set ?? "",
    subset:       card?.subset ?? "",
    cardNumber:   card?.cardNumber ?? "",
    numbered:     !!(card?.serialNumber || card?.tags.includes("Numbered")),
    serialNumber: card?.serialNumber ?? "",
    autographed:  card?.tags.includes("Auto") || card?.tags.includes("Autograph") || false,
    signedBy:     "",
    autographAuthentication: "",
    autographAuthNumber:     "",
    autographFormat:         "",
    listingType:  "auction",
    desiredPrice: "",
    freeShipping: true,   // eBay promotes free shipping listings
    allowOffers:  false,
    minimumOffer: "",
    team:         "",
    league:       "",
    season:       "",
    parallel:     "",
    features:     [],
    cardName:     "",
    cardType:     "Sports Trading Card",
    cardSize:     "Standard",
    countryOfOrigin: "United States",
    upc:          "",
    notes:        "",
    expanded:     true,
    showOptional: false,
  };
}

async function checkResolution(file: File): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { URL.revokeObjectURL(url); resolve({ w: img.width,  h: img.height }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 0, h: 0 }); };
    img.src = url;
  });
}

interface ReturnInfo {
  fullName: string | null;
  displayName: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

export function ConsignForm({ collectionCards, startCard, commissionRates, returnInfo }: {
  collectionCards: CollectionCard[];
  startCard: CollectionCard | null;
  commissionRates: CommissionRates;
  returnInfo: ReturnInfo | null | undefined;
}) {
  const router = useRouter();
  const [items,        setItems]        = useState<ItemDraft[]>(startCard ? [blankItem(startCard)] : [blankItem()]);
  const [overallNotes, setOverallNotes] = useState("");
  const [showPicker,   setShowPicker]   = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  // Return address — pre-filled from profile, editable inline
  const [returnName,    setReturnName]    = useState(returnInfo?.fullName ?? returnInfo?.displayName ?? "");
  const [returnPhone,   setReturnPhone]   = useState(returnInfo?.phone ?? "");
  const [returnAddr1,   setReturnAddr1]   = useState(returnInfo?.addressLine1 ?? "");
  const [returnAddr2,   setReturnAddr2]   = useState(returnInfo?.addressLine2 ?? "");
  const [returnCity,    setReturnCity]    = useState(returnInfo?.city ?? "");
  const [returnState,   setReturnState]   = useState(returnInfo?.state ?? "");
  const [returnZip,     setReturnZip]     = useState(returnInfo?.zip ?? "");
  const [returnCountry, setReturnCountry] = useState(returnInfo?.country ?? "United States");
  const [editingReturn, setEditingReturn] = useState(
    // Start in edit mode if the profile address is incomplete
    !returnInfo?.phone || !returnInfo?.addressLine1 || !returnInfo?.city
  );

  const addedIds = new Set(items.map(i => i.cardId).filter(Boolean));

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i));
  }
  function removeItem(key: string) { setItems(prev => prev.filter(i => i.key !== key)); }

  function toggleFeature(key: string, feat: string) {
    setItems(prev => prev.map(i => {
      if (i.key !== key) return i;
      const features = i.features.includes(feat)
        ? i.features.filter(f => f !== feat)
        : [...i.features, feat];
      return { ...i, features };
    }));
  }

  function addFromCollection(card: CollectionCard) {
    setItems(prev => [...prev, blankItem(card)]);
    setShowPicker(false); setPickerSearch("");
  }

  // ── Photo upload ──────────────────────────────────────────────────────────

  async function uploadPhoto(key: string, file: File, slot: "front" | "back" | "extra") {
    updateItem(key, { uploading: true });
    try {
      const { w, h } = await checkResolution(file);
      if (Math.min(w, h) > 0 && Math.min(w, h) < MIN_SIDE) {
        const ok = window.confirm(`Photo is ${w}×${h}px — we recommend at least ${MIN_SIDE}px on the shortest side. Upload anyway?`);
        if (!ok) { updateItem(key, { uploading: false }); return; }
      }
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const { url, error: err } = await r.json();
      if (err) throw new Error(err);
      setItems(prev => prev.map(i => {
        if (i.key !== key) return i;
        let photos = [...i.photos];
        if (slot === "front") photos = [url, ...photos.slice(1)];
        else if (slot === "back") {
          if (photos.length >= 2) photos = [photos[0], url, ...photos.slice(2)];
          else if (photos.length === 1) photos = [photos[0], url];
          else photos = ["", url];
        } else photos = [...photos, url];
        return { ...i, photos, uploading: false };
      }));
    } catch (e) {
      alert(`Upload failed: ${e}`);
      updateItem(key, { uploading: false });
    }
  }

  function removePhoto(key: string, idx: number) {
    setItems(prev => prev.map(i => i.key !== key ? i : { ...i, photos: i.photos.filter((_, pi) => pi !== idx) }));
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};

    // Return address is required
    if (!returnName.trim())  errs["return_name"]  = "Name is required";
    if (!returnPhone.trim()) errs["return_phone"] = "Phone number is required";
    if (!returnAddr1.trim()) errs["return_addr1"] = "Street address is required";
    if (!returnCity.trim())  errs["return_city"]  = "City is required";
    if (!returnState.trim()) errs["return_state"] = "State is required";
    if (!returnZip.trim())   errs["return_zip"]   = "ZIP code is required";
    if (Object.keys(errs).some(k => k.startsWith("return_"))) setEditingReturn(true);

    items.forEach((item, idx) => {
      const prefix = `item_${idx}`;
      if (!item.player.trim())    errs[`${prefix}_player`]    = "Player name is required";
      if (!item.sport)            errs[`${prefix}_sport`]     = "Sport is required";
      if (item.graded) {
        if (!item.gradeCompany)   errs[`${prefix}_company`]   = "Grading company is required";
        if (!item.grade)          errs[`${prefix}_grade`]     = "Grade is required";
        // condition is auto-derived from grade — no separate check needed
      } else {
        if (!item.condition)      errs[`${prefix}_condition`] = "Condition is required";
      }
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Expand items that have errors
      const errorKeys = new Set(Object.keys(errs).map(k => k.split("_")[1]));
      setItems(prev => prev.map((i, idx) => errorKeys.has(String(idx)) ? { ...i, expanded: true } : i));
    }
    return Object.keys(errs).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function submit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/consign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: overallNotes || null,
          returnName:    returnName.trim()    || null,
          returnPhone:   returnPhone.trim()   || null,
          returnAddr1:   returnAddr1.trim()   || null,
          returnAddr2:   returnAddr2.trim()   || null,
          returnCity:    returnCity.trim()    || null,
          returnState:   returnState.trim()   || null,
          returnZip:     returnZip.trim()     || null,
          returnCountry: returnCountry.trim() || null,
          items: items.map(i => ({
            cardId:       i.cardId ?? null,
            clientPhotos: i.photos,
            player:       i.player.trim(),
            year:         i.year ? parseInt(i.year) : null,
            sport:        i.sport,
            condition:    i.condition,
            cardNumber:   i.cardNumber || null,
            manufacturer: i.manufacturer || null,
            set:          i.set || null,
            subset:       i.subset || null,
            graded:       i.graded,
            grade:        i.graded ? i.grade || null : null,
            gradeCompany: i.graded ? i.gradeCompany || null : null,
            certNumber:   i.graded ? i.certNumber || null : null,
            numbered:     i.numbered,
            serialNumber: i.numbered ? i.serialNumber || null : null,
            autographed:  i.autographed,
            signedBy:     i.autographed ? i.signedBy || null : null,
            autographAuthentication: i.autographed ? i.autographAuthentication || null : null,
            autographAuthNumber:     i.autographed ? i.autographAuthNumber || null : null,
            autographFormat:         i.autographed ? i.autographFormat || null : null,
            listingType:  i.listingType,
            desiredPrice: i.desiredPrice ? parseFloat(i.desiredPrice) : null,
            freeShipping: i.freeShipping,
            allowOffers:  i.allowOffers,
            minimumOffer: i.allowOffers && i.minimumOffer ? parseFloat(i.minimumOffer) : null,
            team:         i.team || null,
            league:       i.league || null,
            season:       i.season || null,
            parallel:     i.parallel || null,
            features:     i.features,
            cardName:     i.cardName || null,
            cardType:     i.cardType || null,
            cardSize:     i.cardSize || null,
            countryOfOrigin: i.countryOfOrigin || null,
            upc:          i.upc || null,
            notes:        i.notes || null,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErrors({ _form: d.error ?? "Submission failed" }); setSubmitting(false); return; }
      router.push(`/dashboard/consignments/${d.id}?new=1`);
    } catch (e) { setErrors({ _form: `Error: ${e}` }); setSubmitting(false); }
  }

  // ── Commission summary ────────────────────────────────────────────────────

  const withPhotos    = items.filter(i => i.photos.filter(Boolean).length >= 1).length;
  const withoutPhotos = items.length - withPhotos;

  const filteredCollection = collectionCards.filter(c =>
    !addedIds.has(c.id) &&
    (pickerSearch === "" ||
      c.player.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      c.set.toLowerCase().includes(pickerSearch.toLowerCase()))
  );

  const inp  = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder-slate-400 bg-white";
  const errCls = "border-red-300 focus:ring-red-300";
  const labelReq = <span className="text-red-400 ml-0.5">*</span>;

  const returnErr = (f: string) => errors[`return_${f}`];
  const addressComplete = returnName && returnPhone && returnAddr1 && returnCity && returnState && returnZip;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Return address verification ───────────────────────────────────── */}
      <div className={`bg-white rounded-2xl border ${Object.keys(errors).some(k => k.startsWith("return_")) ? "border-red-300" : "border-slate-200"} overflow-hidden`}>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-navy font-semibold text-sm">Return address</p>
            <p className="text-slate-400 text-xs mt-0.5">Where we ship cards back to if needed.</p>
          </div>
          {addressComplete && !editingReturn && (
            <button onClick={() => setEditingReturn(true)}
              className="text-brand text-xs font-medium hover:underline shrink-0">
              Edit
            </button>
          )}
        </div>

        {!editingReturn && addressComplete ? (
          /* Summary view */
          <div className="px-5 pb-4 border-t border-slate-100 pt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div><span className="text-slate-400 text-xs">Name</span><p className="text-navy">{returnName}</p></div>
            <div><span className="text-slate-400 text-xs">Phone</span><p className="text-navy">{returnPhone}</p></div>
            <div className="col-span-2">
              <span className="text-slate-400 text-xs">Address</span>
              <p className="text-navy">
                {returnAddr1}{returnAddr2 ? `, ${returnAddr2}` : ""}<br />
                {returnCity}, {returnState} {returnZip}{returnCountry && returnCountry !== "United States" ? `, ${returnCountry}` : ""}
              </p>
            </div>
          </div>
        ) : (
          /* Edit form */
          <div className="px-5 pb-5 border-t border-slate-100 pt-4 flex flex-col gap-3">
            {!addressComplete && !editingReturn && (
              <p className="text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Add your return address so we know where to send cards back if needed.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Full name <span className="text-red-400">*</span></label>
                <input value={returnName} onChange={e => setReturnName(e.target.value)}
                  placeholder="Your full name"
                  className={`${inp}${returnErr("name") ? ` ${errCls}` : ""}`} />
                {returnErr("name") && <p className="text-red-500 text-xs mt-1">{returnErr("name")}</p>}
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Phone <span className="text-red-400">*</span></label>
                <input value={returnPhone} onChange={e => setReturnPhone(e.target.value)}
                  placeholder="(860) 555-0123"
                  className={`${inp}${returnErr("phone") ? ` ${errCls}` : ""}`} />
                {returnErr("phone") && <p className="text-red-500 text-xs mt-1">{returnErr("phone")}</p>}
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Address line 1 <span className="text-red-400">*</span></label>
              <input value={returnAddr1} onChange={e => setReturnAddr1(e.target.value)}
                placeholder="Street address"
                className={`${inp}${returnErr("addr1") ? ` ${errCls}` : ""}`} />
              {returnErr("addr1") && <p className="text-red-500 text-xs mt-1">{returnErr("addr1")}</p>}
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Address line 2</label>
              <input value={returnAddr2} onChange={e => setReturnAddr2(e.target.value)}
                placeholder="Apt, suite, unit (optional)" className={inp} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">City <span className="text-red-400">*</span></label>
                <input value={returnCity} onChange={e => setReturnCity(e.target.value)}
                  placeholder="City"
                  className={`${inp}${returnErr("city") ? ` ${errCls}` : ""}`} />
                {returnErr("city") && <p className="text-red-500 text-xs mt-1">{returnErr("city")}</p>}
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">State <span className="text-red-400">*</span></label>
                <input value={returnState} onChange={e => setReturnState(e.target.value)}
                  placeholder="CT" maxLength={2}
                  className={`${inp}${returnErr("state") ? ` ${errCls}` : ""}`} />
                {returnErr("state") && <p className="text-red-500 text-xs mt-1">{returnErr("state")}</p>}
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">ZIP <span className="text-red-400">*</span></label>
                <input value={returnZip} onChange={e => setReturnZip(e.target.value)}
                  placeholder="00000"
                  className={`${inp}${returnErr("zip") ? ` ${errCls}` : ""}`} />
                {returnErr("zip") && <p className="text-red-500 text-xs mt-1">{returnErr("zip")}</p>}
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Country</label>
              <input value={returnCountry} onChange={e => setReturnCountry(e.target.value)}
                placeholder="United States" className={inp} />
            </div>
            {addressComplete && (
              <button onClick={() => setEditingReturn(false)}
                className="self-start text-xs bg-brand text-white font-semibold px-4 py-2 rounded-xl hover:bg-blue-600 transition-colors">
                Confirm address
              </button>
            )}
          </div>
        )}
      </div>

      {items.map((item, idx) => {
        const hasFront  = !!item.photos[0];
        const hasBack   = !!item.photos[1];
        const hasPhotos = hasFront;
        const commRate  = hasPhotos ? commissionRates.withPhotos : commissionRates.withoutPhotos;
        const commCls   = hasPhotos ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
        const err       = (field: string) => errors[`item_${idx}_${field}`];

        return (
          <div key={item.key} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {/* Collapsed header */}
            <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => updateItem(item.key, { expanded: !item.expanded })}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-slate-400 text-xs font-semibold w-5 shrink-0">#{idx + 1}</span>
                {item.photos.filter(Boolean).length > 0 && (
                  <div className="flex gap-1 shrink-0">
                    {item.photos.filter(Boolean).slice(0, 2).map((url, pi) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={pi} src={url} alt="" className="w-7 h-9 object-cover rounded border border-slate-200" />
                    ))}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-navy font-semibold text-sm truncate">
                    {item.player || <span className="text-slate-400 font-normal">New card</span>}
                  </p>
                  {(item.year || item.sport || item.set) && (
                    <p className="text-slate-400 text-xs truncate">
                      {[item.year, item.sport, item.manufacturer, item.set, item.grade && `${item.gradeCompany} ${item.grade}`].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${commCls}`}>{commRate}%</span>
                {item.cardId && <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">collection</span>}
                {Object.keys(errors).some(k => k.startsWith(`item_${idx}_`)) && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">needs info</span>
                )}
                {items.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); removeItem(item.key); }}
                    className="text-slate-300 hover:text-red-400 text-xs px-1">Remove</button>
                )}
                <span className="text-slate-400 text-xs">{item.expanded ? "▲" : "▼"}</span>
              </div>
            </div>

            {item.expanded && (
              <div className="border-t border-slate-100 px-5 pb-6 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* Photos */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Photos</label>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${commCls}`}>
                        {commRate}% commission — {hasPhotos ? "photos provided" : "we photograph"}
                      </span>
                    </div>
                    {item.photos.filter(Boolean).length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-3">
                        {item.photos.map((url, pi) => url ? (
                          <div key={pi} className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="w-16 h-20 object-cover rounded-xl border border-slate-200" />
                            <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-0.5 rounded-b-xl">
                              {pi === 0 ? "Front" : pi === 1 ? "Back" : `#${pi+1}`}
                            </span>
                            <button onClick={() => removePhoto(item.key, pi)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs items-center justify-center hidden group-hover:flex">×</button>
                          </div>
                        ) : null)}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {!hasFront  && <PhotoSlot label="Front" uploading={item.uploading} onFile={f => uploadPhoto(item.key, f, "front")} />}
                      {!hasBack   && <PhotoSlot label="Back"  uploading={item.uploading} onFile={f => uploadPhoto(item.key, f, "back")}  />}
                      {hasFront && hasBack && <PhotoSlot label="+ More" small uploading={item.uploading} onFile={f => uploadPhoto(item.key, f, "extra")} />}
                    </div>
                    <p className="text-slate-400 text-xs mt-2">
                      {!hasFront
                        ? `Upload front + back for ${commissionRates.withPhotos}% commission. Without photos we photograph for ${commissionRates.withoutPhotos}%.`
                        : `✓ Photos provided — ${commissionRates.withPhotos}% commission.`
                      } Min. {MIN_SIDE}×{MIN_SIDE}px recommended.
                    </p>
                  </div>

                  {/* ── Auto-fill from slab ── */}
                  <div className="sm:col-span-2">
                    <SlabAutoFill
                      onFill={(patch, photoUrl) => {
                        const update: Partial<ItemDraft> = { ...patch };
                        if (photoUrl && !item.photos[0]) {
                          update.photos = [photoUrl, ...item.photos.slice(1)];
                        }
                        updateItem(item.key, update);
                      }}
                    />
                  </div>

                  {/* ── Required fields ── */}
                  <div className="sm:col-span-2 mt-1">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">Card identity <span className="text-red-400 font-normal normal-case">(* required)</span></p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-slate-400 text-xs mb-1 block">Player / card name{labelReq}</label>
                    <input value={item.player} onChange={e => updateItem(item.key, { player: e.target.value })}
                      placeholder="e.g. Bo Jackson" className={`${inp} ${err("player") ? errCls : ""}`} />
                    {err("player") && <p className="text-red-500 text-xs mt-1">{err("player")}</p>}
                  </div>

                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Sport{labelReq}</label>
                    <select value={item.sport} onChange={e => updateItem(item.key, { sport: e.target.value })}
                      className={`${inp} ${err("sport") ? errCls : ""}`}>
                      <option value="">Select sport…</option>
                      {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {err("sport") && <p className="text-red-500 text-xs mt-1">{err("sport")}</p>}
                  </div>

                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Year</label>
                    <input type="number" value={item.year} onChange={e => updateItem(item.key, { year: e.target.value })}
                      placeholder="1987" className={inp} />
                  </div>

                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Manufacturer</label>
                    <input value={item.manufacturer} onChange={e => updateItem(item.key, { manufacturer: e.target.value })}
                      placeholder="Topps" className={inp} />
                  </div>

                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Set</label>
                    <input value={item.set} onChange={e => updateItem(item.key, { set: e.target.value })}
                      placeholder="Topps Chrome" className={inp} />
                  </div>

                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Subset / variation</label>
                    <input value={item.subset} onChange={e => updateItem(item.key, { subset: e.target.value })}
                      placeholder="Refractor, Prizm…" className={inp} />
                  </div>

                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Card number</label>
                    <input value={item.cardNumber} onChange={e => updateItem(item.key, { cardNumber: e.target.value })}
                      placeholder="170" className={inp} />
                  </div>

                  {/* ── Grading ── */}
                  <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-1">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">Grading & condition</p>
                  </div>

                  <div className="sm:col-span-2">
                    <Toggle label="This card is graded" checked={item.graded}
                      onChange={v => updateItem(item.key, {
                        graded: v,
                        // auto-derive condition when switching to graded; clear when switching to raw
                        condition: v ? gradeToCondition(item.gradeCompany, item.grade) : "",
                      })} />
                  </div>

                  {item.graded && (
                    <>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Grading company{labelReq}</label>
                        <select value={item.gradeCompany}
                          onChange={e => updateItem(item.key, {
                            gradeCompany: e.target.value,
                            condition: gradeToCondition(e.target.value, item.grade),
                          })}
                          className={`${inp} ${err("company") ? errCls : ""}`}>
                          <option value="">Select…</option>
                          {GRADERS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        {err("company") && <p className="text-red-500 text-xs mt-1">{err("company")}</p>}
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Grade{labelReq}</label>
                        <input value={item.grade}
                          onChange={e => updateItem(item.key, {
                            grade: e.target.value,
                            condition: gradeToCondition(item.gradeCompany, e.target.value),
                          })}
                          placeholder="9.5" className={`${inp} ${err("grade") ? errCls : ""}`} />
                        {err("grade") && <p className="text-red-500 text-xs mt-1">{err("grade")}</p>}
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Cert / slab number</label>
                        <input value={item.certNumber} onChange={e => updateItem(item.key, { certNumber: e.target.value })}
                          placeholder="12345678" className={inp} />
                      </div>
                      {/* Condition is auto-derived from grade — read-only display */}
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Condition</label>
                        {item.condition ? (
                          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm">
                            <span className="text-navy font-medium">{item.condition}</span>
                            <span className="text-slate-400 text-xs">auto-set from grade</span>
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-400">
                            Enter company + grade above
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {!item.graded && (
                    <div className="sm:col-span-2">
                      <label className="text-slate-400 text-xs mb-1 block">Condition{labelReq}</label>
                      <select value={item.condition} onChange={e => updateItem(item.key, { condition: e.target.value })}
                        className={`${inp} ${err("condition") ? errCls : ""}`}>
                        <option value="">Select condition…</option>
                        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {err("condition") && <p className="text-red-500 text-xs mt-1">{err("condition")}</p>}
                      <p className="text-slate-400 text-xs mt-1">Your assessment of the ungraded card&apos;s condition.</p>
                    </div>
                  )}

                  {/* ── Special attributes ── */}
                  <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-1">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">Special attributes</p>
                    <div className="flex flex-wrap gap-4 mb-3">
                      <Toggle label="Numbered"    checked={item.numbered}    onChange={v => updateItem(item.key, { numbered: v })} />
                      <Toggle label="Autographed" checked={item.autographed} onChange={v => updateItem(item.key, { autographed: v })} />
                    </div>
                  </div>

                  {item.numbered && (
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Serial number</label>
                      <input value={item.serialNumber} onChange={e => updateItem(item.key, { serialNumber: e.target.value })}
                        placeholder="45/100" className={inp} />
                    </div>
                  )}

                  {item.autographed && (
                    <>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Signed by</label>
                        <input value={item.signedBy} onChange={e => updateItem(item.key, { signedBy: e.target.value })}
                          placeholder="Player name" className={inp} />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Autograph authentication</label>
                        <input value={item.autographAuthentication} onChange={e => updateItem(item.key, { autographAuthentication: e.target.value })}
                          placeholder="PSA/DNA, Beckett, JSA…" className={inp} />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Authentication number</label>
                        <input value={item.autographAuthNumber} onChange={e => updateItem(item.key, { autographAuthNumber: e.target.value })}
                          placeholder="Auth cert number" className={inp} />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Autograph format</label>
                        <input value={item.autographFormat} onChange={e => updateItem(item.key, { autographFormat: e.target.value })}
                          placeholder="On card, Cut, Sticker…" className={inp} />
                      </div>
                    </>
                  )}

                  {/* ── Listing preferences ── */}
                  <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-1">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">Listing preference</p>
                    <div className="flex gap-2 mb-3">
                      {(["auction", "buyitnow"] as const).map(type => (
                        <button key={type} type="button" onClick={() => updateItem(item.key, { listingType: type })}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                            item.listingType === type
                              ? type === "auction" ? "bg-navy text-white border-navy" : "bg-brand text-white border-brand"
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                          }`}>
                          {type === "auction" ? "🔨 Auction" : "🏷️ Buy It Now"}
                        </button>
                      ))}
                    </div>
                    <div className="mb-3">
                      <label className="text-slate-400 text-xs mb-1 block">
                        {item.listingType === "auction" ? "Desired starting bid" : "Buy It Now price"}
                        <span className="text-slate-300 ml-1">(optional — we research comps if blank)</span>
                      </label>
                      <div className="relative max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input type="number" step="0.01" min="0" value={item.desiredPrice}
                          onChange={e => updateItem(item.key, { desiredPrice: e.target.value })}
                          placeholder={item.listingType === "auction" ? "0.99" : "49.99"}
                          className={inp + " pl-7 max-w-xs"} />
                      </div>
                    </div>
                    <div>
                      <Toggle label="Accept offers" checked={item.allowOffers} onChange={v => updateItem(item.key, { allowOffers: v })} />
                      {item.allowOffers && (
                        <div className="mt-2 max-w-xs">
                          <label className="text-slate-400 text-xs mb-1 block">Minimum offer you&apos;d accept</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                            <input type="number" step="0.01" min="0" value={item.minimumOffer}
                              onChange={e => updateItem(item.key, { minimumOffer: e.target.value })}
                              placeholder="25.00" className={inp + " pl-7"} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Optional eBay specifics ── */}
                  <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-1">
                    <button type="button" onClick={() => updateItem(item.key, { showOptional: !item.showOptional })}
                      className="flex items-center gap-2 text-sm text-slate-500 hover:text-navy transition-colors font-medium">
                      <span>{item.showOptional ? "▲" : "▼"}</span>
                      Additional details
                      <span className="text-slate-300 font-normal text-xs">(optional — improves eBay search visibility)</span>
                    </button>
                  </div>

                  {item.showOptional && (
                    <>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Team</label>
                        <input value={item.team} onChange={e => updateItem(item.key, { team: e.target.value })}
                          placeholder="Kansas City Royals" className={inp} />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">League</label>
                        <input value={item.league} onChange={e => updateItem(item.key, { league: e.target.value })}
                          placeholder="Major League Baseball (MLB)" className={inp} />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Season</label>
                        <input value={item.season} onChange={e => updateItem(item.key, { season: e.target.value })}
                          placeholder="1986 or 2023-24" className={inp} />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Parallel / Variety</label>
                        <input value={item.parallel} onChange={e => updateItem(item.key, { parallel: e.target.value })}
                          placeholder="[Base], Gold, Holo…" className={inp} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-slate-400 text-xs mb-2 block">Features</label>
                        <div className="flex flex-wrap gap-2">
                          {FEATURES_LIST.map(feat => (
                            <button key={feat} type="button"
                              onClick={() => toggleFeature(item.key, feat)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                                item.features.includes(feat)
                                  ? "bg-brand text-white border-brand"
                                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                              }`}>
                              {feat}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Card name</label>
                        <input value={item.cardName} onChange={e => updateItem(item.key, { cardName: e.target.value })}
                          placeholder="Enter your own" className={inp} />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Type</label>
                        <select value={item.cardType} onChange={e => updateItem(item.key, { cardType: e.target.value })} className={inp}>
                          {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Card size</label>
                        <select value={item.cardSize} onChange={e => updateItem(item.key, { cardSize: e.target.value })} className={inp}>
                          {CARD_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Country of origin</label>
                        <input value={item.countryOfOrigin} onChange={e => updateItem(item.key, { countryOfOrigin: e.target.value })}
                          placeholder="United States" className={inp} />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">UPC</label>
                        <input value={item.upc} onChange={e => updateItem(item.key, { upc: e.target.value })}
                          placeholder="Enter number" className={inp} />
                      </div>
                    </>
                  )}

                  {/* Notes */}
                  <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-1">
                    <label className="text-slate-400 text-xs mb-1 block">Additional notes</label>
                    <textarea value={item.notes} onChange={e => updateItem(item.key, { notes: e.target.value })}
                      rows={2} placeholder="Any details we should know…" className={inp + " resize-none"} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add card buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setItems(p => [...p, blankItem()])}
          className="flex items-center gap-1.5 text-sm text-brand border border-brand/30 hover:border-brand/60 hover:bg-brand/5 px-4 py-2.5 rounded-xl transition-colors font-medium">
          + Add a card manually
        </button>
        {collectionCards.length > 0 && (
          <button onClick={() => setShowPicker(p => !p)}
            className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-colors font-medium">
            + Add from my collection
          </button>
        )}
      </div>

      {/* Collection picker */}
      {showPicker && (
        <div className="bg-white rounded-2xl border border-brand/30 p-4">
          <p className="text-navy font-semibold text-sm mb-3">Select cards from your collection</p>
          <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
            placeholder="Search by player or set…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand/30" />
          <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
            {filteredCollection.length === 0
              ? <p className="text-slate-400 text-sm text-center py-4">No matching cards</p>
              : filteredCollection.map(card => (
                <button key={card.id} onClick={() => addFromCollection(card)}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 text-left w-full transition-colors">
                  {card.photos[0]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={card.photos[0]} alt="" className="w-8 h-10 object-cover rounded shrink-0" />
                    : <div className="w-8 h-10 bg-slate-100 rounded shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="text-navy text-sm font-medium truncate">{card.player}</p>
                    <p className="text-slate-400 text-xs truncate">
                      {card.year} · {card.set}{card.grade ? ` · ${card.gradeCompany} ${card.grade}` : ""}
                      {!card.photos.length && <span className="text-amber-600"> · no photos</span>}
                    </p>
                  </div>
                </button>
              ))
            }
          </div>
        </div>
      )}

      {/* Overall notes */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <label className="text-navy font-semibold text-sm mb-2 block">Notes to us (optional)</label>
        <textarea value={overallNotes} onChange={e => setOverallNotes(e.target.value)}
          rows={3} placeholder="Special instructions, preferred timeline, questions…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand/30" />
      </div>

      {/* Commission summary */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <p className="text-navy font-semibold text-sm mb-3">Commission summary</p>
        <div className="flex flex-col gap-1.5 text-sm">
          {withPhotos > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{withPhotos} card{withPhotos !== 1 ? "s" : ""} with photos</span>
              <span className="text-green-700 font-semibold">{commissionRates.withPhotos}% commission</span>
            </div>
          )}
          {withoutPhotos > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{withoutPhotos} card{withoutPhotos !== 1 ? "s" : ""} — we photograph</span>
              <span className="text-amber-700 font-semibold">{commissionRates.withoutPhotos}% commission</span>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 bg-amber-50 -mx-5 -mb-5 px-5 py-4 rounded-b-2xl">
          <p className="text-amber-900 text-xs font-semibold mb-1">⚠ Payout notice</p>
          <p className="text-amber-800 text-xs leading-relaxed">
            We handle all shipping on eBay listings. Your payout is calculated as:
            <strong> sale price − shipping − our commission</strong>.
          </p>
        </div>
      </div>

      {errors._form && <p className="text-red-500 text-sm">{errors._form}</p>}

      <button onClick={submit} disabled={submitting || items.length === 0}
        className="w-full bg-navy text-white font-bold py-4 rounded-2xl text-base hover:bg-navy/80 transition-colors disabled:opacity-50">
        {submitting ? "Submitting…" : `Submit consignment (${items.length} card${items.length !== 1 ? "s" : ""})`}
      </button>
    </div>
  );
}

function PhotoSlot({ label, small, uploading, onFile }: {
  label: string; small?: boolean; uploading: boolean; onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const size = small ? "w-16 h-20" : "w-28 h-36";
  return (
    <label className={`${size} flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-colors ${uploading ? "border-slate-200 bg-slate-50" : "border-slate-200 hover:border-brand hover:bg-brand/5"}`}>
      {uploading
        ? <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        : <><CameraIcon className="w-5 h-5 text-slate-300 mb-1" /><span className="text-slate-400 text-xs text-center leading-tight px-1">{label}</span></>
      }
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" disabled={uploading}
        onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ""; } }} />
    </label>
  );
}

// ── SlabAutoFill ──────────────────────────────────────────────────────────────

function SlabAutoFill({ onFill }: {
  onFill: (patch: Partial<ItemDraft>, photoUrl?: string) => void;
}) {
  const [mode,        setMode]        = useState<"cert" | "scan">("cert");
  const [grader,      setGrader]      = useState("PSA");
  const [certInput,   setCertInput]   = useState("");
  const [certLoading, setCertLoading] = useState(false);
  const [certError,   setCertError]   = useState("");
  const [certApplied, setCertApplied] = useState<string | null>(null); // brief success label
  const [scanFile,    setScanFile]    = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanning,    setScanning]    = useState(false);
  const [scanError,   setScanError]   = useState("");
  const [result,      setResult]      = useState<GraderCardData | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Build the item patch from API/scan data.
  // graded = true whenever we have a cert number from a known grader,
  // even if the free-tier API didn't return a numeric grade.
  function buildPatch(data: GraderCardData): Partial<ItemDraft> {
    const isKnownGrader = data.grader && data.grader !== "Unknown";
    const isGraded      = isKnownGrader && !!data.certNumber;
    const patch: Partial<ItemDraft> = {
      graded:      isGraded,
      gradeCompany: isKnownGrader ? data.grader! : "",
      certNumber:   data.certNumber ?? "",
    };
    if (data.player)       patch.player       = data.player;
    if (data.year)         patch.year         = String(data.year);
    if (data.manufacturer) patch.manufacturer = data.manufacturer;
    if (data.set)          patch.set          = data.set;
    if (data.subset)       patch.subset       = data.subset;
    if (data.cardNumber)   patch.cardNumber   = data.cardNumber;
    if (data.sport)        patch.sport        = data.sport;
    if (data.grade) {
      patch.grade     = data.grade;
      if (isKnownGrader) patch.condition = gradeToCondition(data.grader!, data.grade);
    }
    // BGS subgrades
    if (data.bgsSubCentering != null) patch.gradeCompany = patch.gradeCompany; // keep
    return patch;
  }

  // Cert lookup: auto-applies immediately — PSA API data is authoritative
  async function lookupCert() {
    if (!certInput.trim()) return;
    setCertLoading(true); setCertError(""); setCertApplied(null);
    try {
      const res  = await fetch(`/api/cert?cert=${encodeURIComponent(certInput.trim())}&grader=${grader}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCertError(data.error ?? "Lookup failed");
      } else {
        const patch = buildPatch(data.cardData);
        onFill(patch);
        const label = data.cardData.player
          ? `${data.cardData.player}${data.cardData.grade ? ` · ${grader} ${data.cardData.grade}` : ""}`
          : `${grader} cert applied`;
        setCertApplied(label);
        setCertInput("");
        setTimeout(() => setCertApplied(null), 4000);
      }
    } catch { setCertError("Network error — try again."); }
    setCertLoading(false);
  }

  async function scanPhoto() {
    if (!scanFile) return;
    setScanning(true); setScanError(""); setResult(null); setUploadedUrl(null);

    // Upload the photo so it can be pre-attached to the item
    try {
      const fd = new FormData();
      fd.append("file", scanFile);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (up.ok) setUploadedUrl((await up.json()).url);
    } catch { /* photo upload is best-effort */ }

    // OCR / vision scan — show result card first so user can confirm (OCR can be wrong)
    try {
      const fd = new FormData();
      fd.append("image", scanFile);
      const res  = await fetch("/api/scan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) setScanError(data.error ?? "Scan failed — try a clearer photo of the label.");
      else setResult(data.cardData);
    } catch { setScanError("Network error — try again."); }
    setScanning(false);
  }

  function pickFile(f: File) {
    setScanFile(f);
    setScanPreview(URL.createObjectURL(f));
    setResult(null); setScanError(""); setUploadedUrl(null);
  }

  function resetScan() {
    if (scanPreview) URL.revokeObjectURL(scanPreview);
    setScanFile(null); setScanPreview(null); setResult(null); setScanError(""); setUploadedUrl(null);
  }

  function applyResult() {
    if (!result) return;
    const patch = buildPatch(result);
    onFill(patch, uploadedUrl ?? undefined);
    setResult(null);
    resetScan();
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-1">
      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">Auto-fill from slab</p>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 p-0.5 rounded-lg mb-3 w-fit">
        {(["cert", "scan"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === m ? "bg-brand text-white" : "text-slate-500 hover:text-navy"}`}>
            {m === "cert" ? "PSA cert number" : "Scan label photo"}
          </button>
        ))}
      </div>

      {/* Cert lookup */}
      {mode === "cert" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select value={grader} onChange={e => setGrader(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-2 text-xs text-navy focus:outline-none bg-white shrink-0">
              {GRADERS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input
              value={certInput}
              onChange={e => setCertInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupCert()}
              placeholder="e.g. 80239626"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
            />
            <button onClick={lookupCert} disabled={!certInput.trim() || certLoading}
              className="px-3 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 shrink-0">
              {certLoading ? "…" : "Look up"}
            </button>
          </div>
          {certError   && <p className="text-red-500 text-xs">{certError}</p>}
          {certApplied && (
            <p className="text-green-700 text-xs font-medium bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              ✓ Applied — {certApplied}
            </p>
          )}
          <p className="text-slate-400 text-xs">PSA lookups fill the form automatically. Other graders use label scanning.</p>
        </div>
      )}

      {/* Photo scan */}
      {mode === "scan" && (
        <div className="flex flex-col gap-2">
          {!scanFile ? (
            <button onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl py-5 flex flex-col items-center gap-1.5 text-slate-400 hover:border-brand hover:text-brand transition-colors">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span className="text-xs font-medium">Upload slab photo</span>
              <span className="text-xs">Crop to the label area for best results</span>
            </button>
          ) : (
            <div className="flex gap-3 items-start">
              <img src={scanPreview!} alt="Slab" className="w-20 h-24 object-cover rounded-lg border border-slate-200 shrink-0" />
              <div className="flex flex-col gap-2 flex-1">
                {scanning ? (
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    Reading label…
                  </div>
                ) : scanError ? (
                  <p className="text-red-500 text-xs">{scanError}</p>
                ) : !result ? (
                  <button onClick={scanPhoto}
                    className="px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-blue-600 self-start">
                    Scan this image
                  </button>
                ) : null}
                <button onClick={resetScan} className="text-xs text-slate-400 hover:text-red-400 self-start transition-colors">
                  Change photo
                </button>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-green-700 text-xs font-semibold">
              ✓ {result.grader}{result.certNumber ? ` #${result.certNumber}` : ""}
            </p>
            {result.player && <p className="text-navy font-bold text-sm mt-0.5 truncate">{result.player}</p>}
            {(result.year || result.set) && (
              <p className="text-slate-500 text-xs truncate">
                {[result.year, result.manufacturer, result.set].filter(Boolean).join(" · ")}
              </p>
            )}
            {result.grade && (
              <p className="text-slate-600 text-xs">{result.grader} {result.grade} — {gradeToCondition(result.grader ?? "", result.grade)}</p>
            )}
          </div>
          <button onClick={applyResult}
            className="shrink-0 bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
            Fill form →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div onClick={() => onChange(!checked)} className={`w-9 h-5 rounded-full relative transition-colors ${checked ? "bg-brand" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-sm text-slate-600">{label}</span>
    </label>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
    </svg>
  );
}
