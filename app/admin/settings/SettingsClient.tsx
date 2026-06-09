"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface EbayStatus {
  connected: boolean;
  seller: string | null;
  expiresAt: string | null;
  environment: string;
}

interface ShippingRates {
  envelopeCost: number;
  envelopeMaxValue: number;
  bubbleMailerMin: number;
  bubbleMailerMax: number;
}

async function saveSetting(key: string, value: string) {
  await fetch("/api/admin/content", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

export function SettingsClient({ withPhotos, withoutPhotos, exchangeStandard, exchangePremier, exchangePremierThreshold, ebay, shipping,
  trackFreeLimit, trackMonthly, trackYearly, offerFee,
  tradeCostPerSide, tradeServiceFee, tradeShippingFee,
  ebayDefaultListingType, ebayDefaultAuctionDuration, ebayDefaultStartPrice, ebayDefaultScheduledTime,
  tradeShipName, tradeShipStreet1, tradeShipStreet2, tradeShipCity, tradeShipState, tradeShipPostalCode,
  supplyCostEnvelope, supplyCostLabel, supplyCostPackingSlip, supplyCostTapePerInch, supplyTapeInchesPerOrder,
  defaultShippingType,
}: {
  withPhotos: string; withoutPhotos: string;
  exchangeStandard: string; exchangePremier: string; exchangePremierThreshold: string;
  ebay: EbayStatus; shipping: ShippingRates;
  trackFreeLimit: string; trackMonthly: string; trackYearly: string;
  offerFee: string;
  tradeCostPerSide: string; tradeServiceFee: string; tradeShippingFee: string;
  ebayDefaultListingType: string; ebayDefaultAuctionDuration: string;
  ebayDefaultStartPrice: string; ebayDefaultScheduledTime: string;
  tradeShipName: string; tradeShipStreet1: string; tradeShipStreet2: string;
  tradeShipCity: string; tradeShipState: string; tradeShipPostalCode: string;
  supplyCostEnvelope: string; supplyCostLabel: string; supplyCostPackingSlip: string;
  supplyCostTapePerInch: string; supplyTapeInchesPerOrder: string;
  defaultShippingType: string;
}) {
  const params     = useSearchParams();
  const [wp,   setWp]   = useState(withPhotos);
  const [wop,  setWop]  = useState(withoutPhotos);
  const [saved,    setSaved]    = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [ebayMsg,  setEbayMsg]  = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Exchange commission rates
  const [exStd,       setExStd]       = useState(exchangeStandard);
  const [exPrem,      setExPrem]      = useState(exchangePremier);
  const [exThreshold, setExThreshold] = useState(exchangePremierThreshold);
  const [exSaved,     setExSaved]     = useState(false);
  const [exSaving,    setExSaving]    = useState(false);

  // Track plan pricing
  const [trkFree,    setTrkFree]    = useState(trackFreeLimit);
  const [trkMonthly, setTrkMonthly] = useState(trackMonthly);
  const [trkYearly,  setTrkYearly]  = useState(trackYearly);
  const [trkSaved,   setTrkSaved]   = useState(false);
  const [trkSaving,  setTrkSaving]  = useState(false);

  // Get an Offer fee
  const [offFee,    setOffFee]    = useState(offerFee);
  const [offSaved,  setOffSaved]  = useState(false);
  const [offSaving, setOffSaving] = useState(false);

  // Trade pricing
  const [trSide,    setTrSide]    = useState(tradeCostPerSide);
  const [trSvc,     setTrSvc]     = useState(tradeServiceFee);
  const [trShip,    setTrShip]    = useState(tradeShippingFee);
  const [trSaved,   setTrSaved]   = useState(false);
  const [trSaving,  setTrSaving]  = useState(false);

  // Trade escrow shipping address — where users send cards for peer-to-peer trades
  const [tsName,    setTsName]    = useState(tradeShipName);
  const [tsStreet1, setTsStreet1] = useState(tradeShipStreet1);
  const [tsStreet2, setTsStreet2] = useState(tradeShipStreet2);
  const [tsCity,    setTsCity]    = useState(tradeShipCity);
  const [tsState,   setTsState]   = useState(tradeShipState);
  const [tsPostal,  setTsPostal]  = useState(tradeShipPostalCode);
  const [tsSaved,   setTsSaved]   = useState(false);
  const [tsSaving,  setTsSaving]  = useState(false);

  // eBay listing defaults
  const [ebLT,    setEbLT]    = useState(ebayDefaultListingType);
  const [ebDur,   setEbDur]   = useState(ebayDefaultAuctionDuration);
  const [ebSP,    setEbSP]    = useState(ebayDefaultStartPrice);
  const [ebSched, setEbSched] = useState(ebayDefaultScheduledTime);
  const [ebSaved,  setEbSaved]  = useState(false);
  const [ebSaving, setEbSaving] = useState(false);

  // Shipping rates
  const [envCost,     setEnvCost]     = useState(String(shipping.envelopeCost));
  const [envMax,      setEnvMax]      = useState(String(shipping.envelopeMaxValue));
  const [bubbleMin,   setBubbleMin]   = useState(String(shipping.bubbleMailerMin));
  const [bubbleMax,   setBubbleMax]   = useState(String(shipping.bubbleMailerMax));
  const [defShipType, setDefShipType] = useState(defaultShippingType ?? "flat");
  const [shipSaved,   setShipSaved]   = useState(false);
  const [shipSaving,  setShipSaving]  = useState(false);

  // Shipping supply costs (used by the Payout tab to compute net profit
  // per shipment). Captured on every label purchase as a frozen snapshot.
  const [supEnv,      setSupEnv]      = useState(supplyCostEnvelope);
  const [supLabel,    setSupLabel]    = useState(supplyCostLabel);
  const [supPack,     setSupPack]     = useState(supplyCostPackingSlip);
  const [supTapeIn,   setSupTapeIn]   = useState(supplyCostTapePerInch);
  const [supTapeCnt,  setSupTapeCnt]  = useState(supplyTapeInchesPerOrder);
  const [supSaved,    setSupSaved]    = useState(false);
  const [supSaving,   setSupSaving]   = useState(false);

  useEffect(() => {
    if (params.get("ebay_connected")) setEbayMsg({ type: "success", text: "eBay account connected successfully!" });
    if (params.get("ebay_error")) {
      const err = params.get("ebay_error")!;
      const friendly: Record<string, string> = {
        missing_credentials: "Enter your eBay App ID, Cert ID, and RuName in API Keys first.",
        invalid_state:       "Authorization request expired — please try again.",
        access_denied:       "You declined the eBay authorization.",
      };
      setEbayMsg({ type: "error", text: friendly[err] ?? `eBay error: ${err}` });
    }
  }, [params]);

  async function save() {
    setSaving(true);
    await Promise.all([
      saveSetting("commission_with_photos",    wp),
      saveSetting("commission_without_photos", wop),
    ]);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  async function saveExchange() {
    setExSaving(true);
    await Promise.all([
      saveSetting("exchange_commission_standard", exStd),
      saveSetting("exchange_commission_premier",  exPrem),
      saveSetting("exchange_premier_threshold",   exThreshold),
    ]);
    setExSaving(false); setExSaved(true); setTimeout(() => setExSaved(false), 2500);
  }

  async function saveTrack() {
    setTrkSaving(true);
    await Promise.all([
      saveSetting("track_free_limit",    trkFree),
      saveSetting("track_monthly_price", trkMonthly),
      saveSetting("track_yearly_price",  trkYearly),
    ]);
    setTrkSaving(false); setTrkSaved(true); setTimeout(() => setTrkSaved(false), 2500);
  }

  async function saveOffer() {
    setOffSaving(true);
    await saveSetting("offer_fee", offFee);
    setOffSaving(false); setOffSaved(true); setTimeout(() => setOffSaved(false), 2500);
  }

  async function saveTrade() {
    setTrSaving(true);
    await Promise.all([
      saveSetting("trade_cost_per_side", trSide),
      saveSetting("trade_service_fee",   trSvc),
      saveSetting("trade_shipping_fee",  trShip),
    ]);
    setTrSaving(false); setTrSaved(true); setTimeout(() => setTrSaved(false), 2500);
  }

  async function saveTradeShipAddress() {
    setTsSaving(true);
    await Promise.all([
      saveSetting("trade_ship_name",    tsName),
      saveSetting("trade_ship_street1", tsStreet1),
      saveSetting("trade_ship_street2", tsStreet2),
      saveSetting("trade_ship_city",    tsCity),
      saveSetting("trade_ship_state",   tsState),
      saveSetting("trade_ship_postal",  tsPostal),
    ]);
    setTsSaving(false); setTsSaved(true); setTimeout(() => setTsSaved(false), 2500);
  }

  async function saveEbayDefaults() {
    setEbSaving(true);
    await Promise.all([
      saveSetting("ebay_ld_listing_type",            ebLT),
      saveSetting("ebay_ld_auction_duration",        ebDur),
      saveSetting("ebay_ld_default_start_price",     ebSP),
      saveSetting("ebay_ld_default_scheduled_time",  ebSched),
    ]);
    setEbSaving(false); setEbSaved(true); setTimeout(() => setEbSaved(false), 2500);
  }

  async function saveShipping() {
    setShipSaving(true);
    await Promise.all([
      saveSetting("shipping_envelope_cost",       envCost),
      saveSetting("shipping_envelope_max_value",  envMax),
      saveSetting("shipping_bubble_mailer_min",   bubbleMin),
      saveSetting("shipping_bubble_mailer_max",   bubbleMax),
      saveSetting("default_shipping_type",        defShipType),
    ]);
    setShipSaving(false); setShipSaved(true); setTimeout(() => setShipSaved(false), 2500);
  }

  async function saveSupplyCosts() {
    setSupSaving(true);
    await Promise.all([
      saveSetting("supply_cost_envelope",          supEnv),
      saveSetting("supply_cost_label",             supLabel),
      saveSetting("supply_cost_packing_slip",      supPack),
      saveSetting("supply_cost_tape_per_inch",     supTapeIn),
      saveSetting("supply_tape_inches_per_order",  supTapeCnt),
    ]);
    setSupSaving(false); setSupSaved(true); setTimeout(() => setSupSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Commission rates ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-navy font-semibold mb-1">Consignment commission rates</h2>
        <p className="text-slate-400 text-sm mb-5">
          These rates appear on the consignment form and all user-facing pages. Change here and every mention updates automatically.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              With photos (seller provides)
            </label>
            <div className="relative">
              <input type="number" min="0" max="100" step="1" value={wp} onChange={e => setWp(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy pr-8 focus:outline-none focus:ring-2 focus:ring-brand/30" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            <p className="text-slate-400 text-xs mt-1">Seller uploads front + back photos</p>
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Without photos (we photograph)
            </label>
            <div className="relative">
              <input type="number" min="0" max="100" step="1" value={wop} onChange={e => setWop(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy pr-8 focus:outline-none focus:ring-2 focus:ring-brand/30" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            <p className="text-slate-400 text-xs mt-1">We photograph the card ourselves</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm text-slate-600">
          <p className="font-medium text-navy mb-1">Preview:</p>
          <p>&ldquo;{wp}% commission when you provide photos · {wop}% when we photograph · All eBay fees included&rdquo;</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving}
            className="bg-brand text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
            {saving ? "Saving…" : "Save commission rates"}
          </button>
          {saved && <span className="text-green-600 text-sm">✓ Saved — all pages updated</span>}
        </div>
      </div>

      {/* ── Exchange commission rates ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-navy font-semibold mb-1">The Exchange — commission rates</h2>
        <p className="text-slate-400 text-sm mb-5">
          Rates charged on sales through The Exchange. Changes apply instantly across the site.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Standard rate
            </label>
            <div className="relative">
              <input type="number" min="0" max="100" step="0.1" value={exStd} onChange={e => setExStd(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy pr-8 focus:outline-none focus:ring-2 focus:ring-brand/30" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            <p className="text-slate-400 text-xs mt-1">Applied to all standard sellers</p>
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Premier Seller rate
            </label>
            <div className="relative">
              <input type="number" min="0" max="100" step="0.1" value={exPrem} onChange={e => setExPrem(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy pr-8 focus:outline-none focus:ring-2 focus:ring-brand/30" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            <p className="text-slate-400 text-xs mt-1">Discounted rate for Premier Sellers</p>
          </div>
        </div>

        <div className="mb-5">
          <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
            Premier Seller threshold
          </label>
          <input type="number" min="0" step="1" value={exThreshold} onChange={e => setExThreshold(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
          <p className="text-slate-400 text-xs mt-1">
            Sellers with this many successful sales or more earn Premier Seller status
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm text-slate-600">
          <p className="font-medium text-navy mb-1">Preview:</p>
          <p>Standard sellers pay {exStd}% · Premier Sellers ({exThreshold}+ sales) pay {exPrem}%</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveExchange} disabled={exSaving}
            className="bg-brand text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
            {exSaving ? "Saving…" : "Save Exchange rates"}
          </button>
          {exSaved && <span className="text-green-600 text-sm">✓ Saved — Exchange rates updated</span>}
        </div>
      </div>

      {/* ── Track plan pricing ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-navy font-semibold mb-1">Track — plan pricing</h2>
        <p className="text-slate-400 text-sm mb-5">
          Controls the free card limit and plan prices shown on the landing page and anywhere else pricing is referenced.
        </p>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Free card limit</label>
            <input type="number" min="0" step="1" value={trkFree} onChange={e => setTrkFree(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <p className="text-slate-400 text-xs mt-1">Cards free before requiring a paid plan</p>
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Monthly price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={trkMonthly} onChange={e => setTrkMonthly(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Yearly price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" min="0" step="1" value={trkYearly} onChange={e => setTrkYearly(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm text-slate-600">
          <p className="font-medium text-navy mb-1">Preview:</p>
          <p>&ldquo;Free up to {trkFree} cards · ${trkMonthly}/mo · ${trkYearly}/yr unlimited&rdquo;</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveTrack} disabled={trkSaving}
            className="bg-brand text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
            {trkSaving ? "Saving…" : "Save Track pricing"}
          </button>
          {trkSaved && <span className="text-green-600 text-sm">✓ Saved — landing page updated</span>}
        </div>
      </div>

      {/* ── Get an Offer fee ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-navy font-semibold mb-1">Get an Offer — fee</h2>
        <p className="text-slate-400 text-sm mb-5">
          The percentage fee charged when a seller accepts a cash offer. Set to 0 for no fee.
        </p>
        <div className="max-w-xs mb-5">
          <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Fee percentage</label>
          <div className="relative">
            <input type="number" min="0" max="100" step="0.1" value={offFee} onChange={e => setOffFee(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy pr-8 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">Set to 0 to show &ldquo;No fee to you&rdquo;</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm text-slate-600">
          <p className="font-medium text-navy mb-1">Preview:</p>
          <p>{parseFloat(offFee) > 0 ? `"${offFee}% fee · ${offFee}% of accepted offer"` : '"No fee to you · We research comps and make you an offer"'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveOffer} disabled={offSaving}
            className="bg-brand text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
            {offSaving ? "Saving…" : "Save Offer fee"}
          </button>
          {offSaved && <span className="text-green-600 text-sm">✓ Saved — landing page updated</span>}
        </div>
      </div>

      {/* ── Trade pricing ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-navy font-semibold mb-1">Trade — pricing</h2>
        <p className="text-slate-400 text-sm mb-5">
          The total cost per side is displayed on the landing page. Break it down into service fee + shipping for transparency.
        </p>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Cost per side</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={trSide} onChange={e => setTrSide(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <p className="text-slate-400 text-xs mt-1">Shown as the headline price</p>
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Service fee</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={trSvc} onChange={e => setTrSvc(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Shipping fee</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={trShip} onChange={e => setTrShip(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm text-slate-600">
          <p className="font-medium text-navy mb-1">Preview:</p>
          <p>&ldquo;${trSide} per side · ${trSvc} service + ${trShip} shipping&rdquo;</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveTrade} disabled={trSaving}
            className="bg-brand text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
            {trSaving ? "Saving…" : "Save Trade pricing"}
          </button>
          {trSaved && <span className="text-green-600 text-sm">✓ Saved — landing page updated</span>}
        </div>
      </div>

      {/* ── Shipping ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-navy font-semibold mb-1">Shipping</h2>
        <p className="text-slate-400 text-sm mb-5">
          Shipping cost rules for the consignment form (envelope + bubble
          mailer ranges) plus the default cost type that pre-fills on every
          new eBay listing. Updating here instantly updates all mentions
          site-wide.
        </p>

        <div className="bg-slate-50 rounded-xl p-4 mb-5">
          <p className="text-navy font-semibold text-sm mb-1">Default shipping type for new listings</p>
          <p className="text-slate-400 text-xs mb-3">
            Pre-selected when you create a new eBay listing. Per-listing override is always available.
          </p>
          <select
            value={defShipType}
            onChange={e => setDefShipType(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="flat">Flat rate — same cost for all buyers (auto-fills with Bubble mailer Min cost below)</option>
            <option value="calculated">Calculated — eBay quotes based on buyer&apos;s ZIP and package size</option>
            <option value="free">Free shipping — seller absorbs the postage</option>
          </select>
        </div>
        <div className="flex flex-col gap-5 mb-5">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-navy font-semibold text-sm mb-1">eBay Standard Envelope</p>
            <p className="text-slate-400 text-xs mb-3">Used for cards priced at or below the threshold value. eBay requires cards to be ungraded and under 3 oz.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Shipping cost</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" step="0.01" min="0" value={envCost} onChange={e => setEnvCost(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
              </div>
              <div>
                <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Max card value</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" step="1" min="0" value={envMax} onChange={e => setEnvMax(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
                <p className="text-slate-400 text-xs mt-1">Cards at or under this price use the envelope</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-navy font-semibold text-sm mb-1">Bubble mailer (USPS First Class)</p>
            <p className="text-slate-400 text-xs mb-3">Required by eBay for cards priced above the threshold. Show a min–max range since exact cost varies by weight.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Min cost</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" step="0.01" min="0" value={bubbleMin} onChange={e => setBubbleMin(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
              </div>
              <div>
                <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Max cost</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" step="0.01" min="0" value={bubbleMax} onChange={e => setBubbleMax(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm text-slate-600">
          <p className="font-medium text-navy mb-1">Preview (consignment form disclaimer):</p>
          <p className="text-xs">
            &ldquo;Cards priced ${envMax} or under ship via eBay Standard Envelope (${envCost}).
            Cards over ${envMax} ship in a bubble mailer (${bubbleMin}–${bubbleMax}).&rdquo;
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveShipping} disabled={shipSaving}
            className="bg-brand text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
            {shipSaving ? "Saving…" : "Save shipping rates"}
          </button>
          {shipSaved && <span className="text-green-600 text-sm">✓ Saved — consignment form updated</span>}
        </div>
      </div>

      {/* ── Shipping supply costs ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-navy font-semibold mb-1">Shipping supply costs</h2>
        <p className="text-slate-400 text-sm mb-5">
          Per-unit costs of packing supplies used on each shipment. Captured
          as a snapshot every time a label is bought, then used by the Payout
          tab to compute net profit per item. Most card shipments don&apos;t
          need tape — leave the tape fields at 0 if that applies.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Envelope ($)</label>
            <input type="number" min="0" step="0.01" value={supEnv} onChange={e => setSupEnv(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <p className="text-slate-400 text-xs mt-1">Self-sealing bubble mailer or cardboard envelope</p>
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Sticker label sheet ($)</label>
            <input type="number" min="0" step="0.01" value={supLabel} onChange={e => setSupLabel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <p className="text-slate-400 text-xs mt-1">The peel-and-stick label paper itself (not postage)</p>
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Packing slip sheet ($)</label>
            <input type="number" min="0" step="0.01" value={supPack} onChange={e => setSupPack(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <p className="text-slate-400 text-xs mt-1">Standard printer paper for the packing slip</p>
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Tape ($ per inch)</label>
            <input type="number" min="0" step="0.001" value={supTapeIn} onChange={e => setSupTapeIn(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <p className="text-slate-400 text-xs mt-1">Leave at 0 if you don&apos;t use tape</p>
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Tape used per order (inches)</label>
            <input type="number" min="0" step="0.5" value={supTapeCnt} onChange={e => setSupTapeCnt(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <p className="text-slate-400 text-xs mt-1">Default inches used on a typical order</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm">
          <p className="text-slate-500 text-xs mb-1">Per-shipment supply cost (preview):</p>
          <p className="text-navy font-semibold">
            ${(
              parseFloat(supEnv || "0") +
              parseFloat(supLabel || "0") +
              parseFloat(supPack || "0") +
              parseFloat(supTapeIn || "0") * parseFloat(supTapeCnt || "0")
            ).toFixed(2)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveSupplyCosts} disabled={supSaving}
            className="bg-brand text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
            {supSaving ? "Saving…" : "Save supply costs"}
          </button>
          {supSaved && <span className="text-green-600 text-sm">✓ Saved</span>}
        </div>
      </div>

      {/* ── Trade escrow shipping address ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-navy font-semibold mb-1">Trade escrow shipping address</h2>
        <p className="text-slate-400 text-sm mb-5">
          Where traders ship their cards when a peer-to-peer trade is accepted. Appears on the printable packing slip.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Recipient name</label>
            <input value={tsName} onChange={e => setTsName(e.target.value)}
              placeholder="The Card Cloud — Trade Desk"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
          <div className="col-span-2">
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Street address</label>
            <input value={tsStreet1} onChange={e => setTsStreet1(e.target.value)}
              placeholder="123 Main St"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
          <div className="col-span-2">
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Apt / Suite (optional)</label>
            <input value={tsStreet2} onChange={e => setTsStreet2(e.target.value)}
              placeholder="Suite 200"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">City</label>
            <input value={tsCity} onChange={e => setTsCity(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">State</label>
              <input value={tsState} onChange={e => setTsState(e.target.value.toUpperCase())} maxLength={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">ZIP</label>
              <input value={tsPostal} onChange={e => setTsPostal(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveTradeShipAddress} disabled={tsSaving}
            className="bg-brand text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
            {tsSaving ? "Saving…" : "Save trade shipping address"}
          </button>
          {tsSaved && <span className="text-green-600 text-sm">✓ Saved — used on all new packing slips</span>}
        </div>
      </div>

      {/* ── eBay listing defaults ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-navy font-semibold mb-1">eBay listing defaults</h2>
        <p className="text-slate-400 text-sm mb-5">
          Defaults applied when creating a new eBay listing. Every value can still be overridden per-listing.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Listing type
            </label>
            <select value={ebLT} onChange={e => setEbLT(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand/30">
              <option value="auction">Auction</option>
              <option value="buyitnow">Buy It Now (fixed price)</option>
            </select>
            <p className="text-slate-400 text-xs mt-1">Pre-selects the listing type on new listings.</p>
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Auction duration
            </label>
            <select value={ebDur} onChange={e => setEbDur(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-brand/30">
              {[1, 3, 5, 7, 10].map(d => (
                <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>
              ))}
            </select>
            <p className="text-slate-400 text-xs mt-1">Only applies to auction listings.</p>
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Default auction start price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" step="0.01" min="0" value={ebSP} onChange={e => setEbSP(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pl-7 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <p className="text-slate-400 text-xs mt-1">Pre-fills the Start Price field on new auctions.</p>
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Default scheduled start time
            </label>
            <input type="time" value={ebSched} onChange={e => setEbSched(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <p className="text-slate-400 text-xs mt-1">Used when scheduling is toggled on for a new listing (your local timezone).</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveEbayDefaults} disabled={ebSaving}
            className="bg-brand text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
            {ebSaving ? "Saving…" : "Save eBay defaults"}
          </button>
          {ebSaved && <span className="text-green-600 text-sm">✓ Saved — applies to new listings</span>}
        </div>
      </div>
    </div>
  );
}

function EbayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.5 13.5C3.5 14.88 4.62 16 6 16s2.5-1.12 2.5-2.5V10H7v3.5c0 .55-.45 1-1 1s-1-.45-1-1V10H3.5v3.5zM9.5 10v6H11v-2h1.5c1.38 0 2.5-1.12 2.5-2.5S13.88 9 12.5 9H10c-.28 0-.5.22-.5.5V10zm1.5 2.5V11h1.5c.55 0 1 .45 1 1s-.45 1-1 1H11v-.5zM16.5 10c-.28 0-.5.22-.5.5V16H17.5v-2H19c1.38 0 2.5-1.12 2.5-2.5S20.38 9 19 9h-2c-.28 0-.5.22-.5.5V10zm1.5 2.5V11H19.5c.55 0 1 .45 1 1s-.45 1-1 1H18v-.5z"/>
    </svg>
  );
}
