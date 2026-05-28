import Link from "next/link";
import { db } from "@/lib/db";
import { getLinksMap } from "@/lib/links";

type CmsMap = Record<string, string>;
function c(cms: CmsMap, key: string, fb: string) { return cms[key] || fb; }

export async function PricingStrip() {
  const [rows, links] = await Promise.all([
    db.siteSetting.findMany(),
    getLinksMap(),
  ]);

  const cms: CmsMap = {};
  for (const r of rows) cms[r.key] = r.value;

  const freeCards    = cms["track_free_limit"]             || "100";
  const exchangeRate = cms["exchange_commission_standard"]  || "7";
  const consignRate  = cms["commission_with_photos"]        || "15";
  const tradeSide    = cms["trade_cost_per_side"]           || "17";
  const tradeShip    = cms["trade_shipping_fee"]            || "7";

  const kicker   = c(cms, "pricing_kicker",   "Pricing");
  const headline = c(cms, "pricing_headline",  "Simple, transparent pricing");
  const subtitle = c(cms, "pricing_subtitle",  "Free to start. Pay only when we help you sell or trade.");
  const ctaLabel = c(cms, "pricing_cta",       "See full pricing details");
  const ctaUrl   = c(cms, "pricing_cta_url",   "/pricing");

  function enabled(key: string) {
    const link = links[key];
    return !link || link.enabled !== false;
  }

  const allTiers = [
    {
      linkKey: "service_track_cta",
      icon: "📋",
      name:   c(cms, "pricing_tier_track_name",     "Track"),
      price:  c(cms, "pricing_tier_track_price",    "Free"),
      detail: c(cms, "pricing_tier_track_detail",   `Up to ${freeCards} cards`),
      body:   c(cms, "pricing_tier_track_body",     "Catalog your collection with live eBay value estimates and smart organization tools."),
      highlight: false,
    },
    {
      linkKey: "service_sell_cta",
      icon: "🏪",
      name:   c(cms, "pricing_tier_exchange_name",   "The Exchange"),
      price:  c(cms, "pricing_tier_exchange_price",  `${exchangeRate}%`),
      detail: c(cms, "pricing_tier_exchange_detail", "of sale price"),
      body:   c(cms, "pricing_tier_exchange_body",   "List your card to other collectors. Payment held in escrow until delivery is confirmed."),
      highlight: false,
    },
    {
      linkKey: "service_consign_cta",
      icon: "📦",
      name:   c(cms, "pricing_tier_consign_name",   "Consign"),
      price:  c(cms, "pricing_tier_consign_price",  `${consignRate}%`),
      detail: c(cms, "pricing_tier_consign_detail", "commission on sale"),
      body:   c(cms, "pricing_tier_consign_body",   "We photograph, list on eBay, and ship for you. All fees included in our commission."),
      highlight: true,
    },
    {
      linkKey: "service_trade_cta",
      icon: "🔄",
      name:   c(cms, "pricing_tier_trade_name",   "Trade"),
      price:  c(cms, "pricing_tier_trade_price",  `$${tradeSide}/side`),
      detail: c(cms, "pricing_tier_trade_detail", `+ $${tradeShip} shipping`),
      body:   c(cms, "pricing_tier_trade_body",   "We act as escrow — verify condition and re-ship to both collectors."),
      highlight: false,
    },
  ];

  const tiers = allTiers.filter(t => enabled(t.linkKey));

  if (tiers.length === 0) return null;

  return (
    <section className="bg-white border-t border-slate-100 py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-3">{kicker}</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-navy mb-4">{headline}</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">{subtitle}</p>
        </div>

        {/* Pricing grid — columns adjust to however many tiers are visible */}
        <div className={`grid gap-5 mb-10 grid-cols-1 sm:grid-cols-2 ${tiers.length === 4 ? "lg:grid-cols-4" : tiers.length === 3 ? "lg:grid-cols-3" : tiers.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1 max-w-sm mx-auto"}`}>
          {tiers.map((tier) => (
            <div key={tier.linkKey}
              className={`rounded-2xl border p-6 flex flex-col ${tier.highlight ? "bg-navy border-navy" : "bg-slate-50 border-slate-200"}`}>
              <span className="text-3xl mb-4">{tier.icon}</span>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${tier.highlight ? "text-white/50" : "text-slate-400"}`}>
                {tier.name}
              </p>
              <p className={`text-3xl font-bold leading-none mb-1 ${tier.highlight ? "text-white" : "text-navy"}`}>
                {tier.price}
              </p>
              <p className={`text-xs mb-4 ${tier.highlight ? "text-white/50" : "text-slate-400"}`}>{tier.detail}</p>
              <p className={`text-sm leading-relaxed flex-1 ${tier.highlight ? "text-white/70" : "text-slate-500"}`}>{tier.body}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href={ctaUrl}
            className="inline-flex items-center gap-2 bg-navy text-white font-semibold px-8 py-3.5 rounded-xl text-sm hover:bg-navy/90 transition-colors">
            {ctaLabel} →
          </Link>
        </div>

      </div>
    </section>
  );
}
