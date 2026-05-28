import Link from "next/link";
import { db } from "@/lib/db";
import { SiteFooter } from "@/components/landing/SiteFooter";

type CmsMap = Record<string, string>;
function c(cms: CmsMap, key: string, fb: string) { return cms[key] || fb; }

export default async function PricingPage() {
  const rows = await db.siteSetting.findMany();
  const cms: CmsMap = {};
  for (const r of rows) cms[r.key] = r.value;

  const freeCards      = cms["track_free_limit"]              || "100";
  const monthlyPrice   = cms["track_monthly_price"]           || "2.99";
  const yearlyPrice    = cms["track_yearly_price"]            || "25";
  const exchangeStd    = cms["exchange_commission_standard"]  || "7";
  const exchangePrem   = cms["exchange_commission_premier"]   || "5";
  const exchThreshold  = cms["exchange_premier_threshold"]    || "100";
  const consignPhotos  = cms["commission_with_photos"]        || "15";
  const consignNoPhoto = cms["commission_without_photos"]     || "20";
  const tradeSide      = cms["trade_cost_per_side"]           || "17";
  const tradeSvc       = cms["trade_service_fee"]             || "10";
  const tradeShip      = cms["trade_shipping_fee"]            || "7";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-navy border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-white/60 text-sm hover:text-white transition-colors">← Home</Link>
          <Link href="/signup" className="bg-amber text-amber-dark text-sm font-semibold px-4 py-2 rounded-xl hover:brightness-105">Sign up free</Link>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto px-6 py-16 w-full">

        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-navy mb-3">
            {c(cms, "pricing_page_headline", "Simple, transparent pricing")}
          </h1>
          <p className="text-slate-500 text-lg">
            {c(cms, "pricing_page_subtitle", "No hidden fees. Pay only when we help you sell or trade.")}
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          {/* Track */}
          <div className="bg-white rounded-2xl border border-slate-100 p-7">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Track</p>
                <p className="text-3xl font-bold text-navy">Free</p>
                <p className="text-slate-400 text-sm mt-1">Up to {freeCards} cards</p>
              </div>
              <span className="text-4xl">📋</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-5">
              Catalog your collection with live eBay value estimates, trend charts, and smart organization tools.
            </p>
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-slate-500">Free tier</span>
                <span className="font-semibold text-navy">Up to {freeCards} cards</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monthly plan</span>
                <span className="font-semibold text-navy">${monthlyPrice}/mo — unlimited cards</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Annual plan</span>
                <span className="font-semibold text-navy">${yearlyPrice}/yr — unlimited cards</span>
              </div>
            </div>
            <Link href="/signup" className="block text-center bg-brand text-white font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-blue-600 transition-colors">
              Start free →
            </Link>
          </div>

          {/* The Exchange */}
          <div className="bg-white rounded-2xl border border-slate-100 p-7">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">The Exchange</p>
                <p className="text-3xl font-bold text-navy">{exchangeStd}%</p>
                <p className="text-slate-400 text-sm mt-1">of final sale price</p>
              </div>
              <span className="text-4xl">🏪</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-5">
              List your card directly to other collectors. Payment held in escrow until delivery confirmed.
            </p>
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-slate-500">Standard rate</span>
                <span className="font-semibold text-navy">{exchangeStd}% of sale</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Premier rate (cards over ${exchThreshold})</span>
                <span className="font-semibold text-navy">{exchangePrem}% of sale</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Buyer fee</span>
                <span className="font-semibold text-navy">None</span>
              </div>
            </div>
            <Link href="/exchange/sell" className="block text-center bg-brand text-white font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-blue-600 transition-colors">
              List a card →
            </Link>
          </div>

          {/* Consign */}
          <div className="bg-navy rounded-2xl border border-navy p-7">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-1">Consign</p>
                <p className="text-3xl font-bold text-white">{consignPhotos}%</p>
                <p className="text-white/50 text-sm mt-1">commission on sale</p>
              </div>
              <span className="text-4xl">📦</span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed mb-5">
              We photograph, list on eBay, and ship for you. All listing and eBay fees are included — nothing comes out of pocket.
            </p>
            <div className="border-t border-white/10 pt-4 flex flex-col gap-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-white/60">With our photos</span>
                <span className="font-semibold text-white">{consignPhotos}% commission</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">With your photos</span>
                <span className="font-semibold text-white">{consignNoPhoto}% commission</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Shipping (inbound)</span>
                <span className="font-semibold text-white">Paid by you</span>
              </div>
            </div>
            <Link href="/dashboard/consign" className="block text-center bg-amber text-amber-dark font-semibold px-4 py-2.5 rounded-xl text-sm hover:brightness-105 transition-all">
              Consign now →
            </Link>
          </div>

          {/* Trade */}
          <div className="bg-white rounded-2xl border border-slate-100 p-7">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Trade</p>
                <p className="text-3xl font-bold text-navy">${tradeSide}<span className="text-lg font-normal text-slate-400">/side</span></p>
                <p className="text-slate-400 text-sm mt-1">+ shipping both ways</p>
              </div>
              <span className="text-4xl">🔄</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-5">
              We act as escrow. Both collectors ship to us; we verify condition and re-ship to the new owner.
            </p>
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-slate-500">Facilitation fee</span>
                <span className="font-semibold text-navy">${tradeSvc} per trade</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Per-side shipping</span>
                <span className="font-semibold text-navy">${tradeShip}/side</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Condition verification</span>
                <span className="font-semibold text-green-600">Included</span>
              </div>
            </div>
            <Link href="/how-it-works/trade" className="block text-center border border-navy/20 text-navy font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-navy/5 transition-colors">
              Learn more →
            </Link>
          </div>

        </div>

        {/* Bottom callout */}
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <p className="text-navy font-semibold mb-1">
            {c(cms, "pricing_page_callout_headline", "Have questions about pricing?")}
          </p>
          <p className="text-slate-400 text-sm mb-4">
            {c(cms, "pricing_page_callout_body", "We're happy to walk you through how any service works before you commit.")}
          </p>
          <Link href="/contact" className="text-brand text-sm font-semibold hover:underline">Contact us →</Link>
        </div>

      </div>

      <SiteFooter />
    </div>
  );
}
