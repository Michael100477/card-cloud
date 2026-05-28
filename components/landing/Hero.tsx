import Link from "next/link";
import { CardGraphic } from "@/components/landing/CardGraphic";
import type { LinksMap } from "@/lib/links";
import { getLink } from "@/lib/links";
import { HowItWorksModal } from "@/components/landing/HowItWorksModal";

const SERVICE_DEFAULTS = [
  { id: "track",   cmsPrefix: "service_track",   name: "Track",        tagline: "Catalog & monitor values",  linkKey: "service_track_cta",   defaultCta: "Start tracking", defaultHref: "/signup",        description: "Free collection tracking with live eBay values, trend charts, and smart organization tools.",                                                              pricing: "Free up to 100 cards",  pricingDetail: "$2.99/mo · $25/yr unlimited",             accent: "#2563EB", Icon: ChartIcon  },
  { id: "sell",    cmsPrefix: "service_sell",    name: "Sell",         tagline: "List on The Exchange",      linkKey: "service_sell_cta",    defaultCta: "Start selling",  defaultHref: "/exchange/sell", description: "Set your price and list your card directly on The Exchange. We hold payment in escrow and release it once your buyer confirms receipt.",                  pricing: "7% commission",         pricingDetail: "5% for Premier Sellers (100+ sales)",     accent: "#16A34A", Icon: DollarIcon },
  { id: "offer",   cmsPrefix: "service_offer",   name: "Get an Offer", tagline: "Fast cash offer",           linkKey: "service_offer_cta",   defaultCta: "Get an offer",   defaultHref: "/signup",        description: "Submit a card and get a personal cash offer within 24–48 hours. Accept and we handle shipping and payout.",                                               pricing: "No fee to you",         pricingDetail: "We research comps and make you an offer", accent: "#0284C7", Icon: OfferIcon  },
  { id: "consign", cmsPrefix: "service_consign", name: "Consign",      tagline: "Maximize sale price",       linkKey: "service_consign_cta", defaultCta: "Consign now",    defaultHref: "/signup",        description: "We list on eBay and pay you when it sells. All listing and eBay fees are included in our commission.",                                                   pricing: "15% commission",        pricingDetail: "20% if we photograph · All fees included",accent: "#D97706", Icon: TagIcon    },
  { id: "trade",   cmsPrefix: "service_trade",   name: "Trade",        tagline: "Swap cards safely",         linkKey: "service_trade_cta",   defaultCta: "Browse trades",  defaultHref: "/signup",        description: "We act as escrow. Both collectors ship to us; we verify condition and re-ship to the new owner.",                                                         pricing: "$17 per side",          pricingDetail: "$10 service + $7 shipping",               accent: "#DC2626", Icon: TradeIcon  },
];

type CmsMap = Record<string, string>;
function c(cms: CmsMap, key: string, fallback: string) { return cms[key] || fallback; }
function shown(cms: CmsMap, key: string) { return cms[`${key}_show`] !== "no"; }

export function Hero({ cms = {}, links = {} }: { cms?: CmsMap; links?: LinksMap }) {
  const trackFree      = cms["track_free_limit"]              || "100";
  const trackMonthly   = cms["track_monthly_price"]           || "2.99";
  const trackYearly    = cms["track_yearly_price"]            || "25";
  const offerFee       = parseFloat(cms["offer_fee"]          || "0");
  const tradeSide      = cms["trade_cost_per_side"]           || "17";
  const tradeSvc       = cms["trade_service_fee"]             || "10";
  const tradeShip      = cms["trade_shipping_fee"]            || "7";
  const consignWith    = cms["commission_with_photos"]        || "15";
  const consignWithout = cms["commission_without_photos"]     || "20";
  const exStd          = cms["exchange_commission_standard"]  || "7";
  const exPrem         = cms["exchange_commission_premier"]   || "5";
  const exThreshold    = cms["exchange_premier_threshold"]    || "100";

  function applyVars(text: string) {
    return text
      .replace(/%FreeCards%/gi,    trackFree)
      .replace(/%CostPerSide%/gi,  `$${tradeSide}`)
      .replace(/%ServiceFee%/gi,   `$${tradeSvc}`)
      .replace(/%ShippingFee%/gi,  `$${tradeShip}`);
  }

  const settingsPricing: Record<string, { pricing: string; pricingDetail: string }> = {
    track:   { pricing: `Free up to ${trackFree} cards`,                                       pricingDetail: `$${trackMonthly}/mo · $${trackYearly}/yr unlimited` },
    sell:    { pricing: `${exStd}% commission`,                                                pricingDetail: `${exPrem}% for Premier Sellers (${exThreshold}+ sales)` },
    offer:   { pricing: offerFee > 0 ? `${offerFee}% fee` : "No fee to you",                  pricingDetail: offerFee > 0 ? `${offerFee}% of accepted offer` : "We research comps and make you an offer" },
    consign: { pricing: `${consignWith}% commission`,                                          pricingDetail: `${consignWithout}% if we photograph · All fees included` },
    trade:   { pricing: `$${tradeSide} per side`,                                              pricingDetail: `$${tradeSvc} service + $${tradeShip} shipping` },
  };

  return (
    <section className="relative overflow-hidden" style={{ background: "linear-gradient(160deg, #010D1C 0%, #042C53 50%, #032244 100%)" }}>

      {/* ── Background decoration ──────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Stadium spotlight from top */}
        <div style={{ position:"absolute", top:"-5%", left:"50%", transform:"translateX(-50%)", width:"90%", height:"65%", background:"radial-gradient(ellipse at top, rgba(59,130,246,0.13) 0%, transparent 65%)" }} />
        {/* Amber warmth bottom-right */}
        <div style={{ position:"absolute", bottom:0, right:0, width:"45%", height:"50%", background:"radial-gradient(ellipse at bottom right, rgba(239,159,39,0.09) 0%, transparent 60%)" }} />
        {/* Green accent bottom-left */}
        <div style={{ position:"absolute", bottom:0, left:0, width:"30%", height:"35%", background:"radial-gradient(ellipse at bottom left, rgba(22,163,74,0.06) 0%, transparent 60%)" }} />
      </div>

      {/* Diagonal field-line pattern */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" style={{ opacity: 0.04 }} preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="hero-lines" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
            <line x1="0" y1="0" x2="0" y2="60" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-lines)" />
      </svg>

      {/* Ghost card outlines — floating background decoration */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <rect x="-4%" y="8%" width="9%" height="13%" rx="8" fill="none" stroke="rgba(239,159,39,0.15)" strokeWidth="1.5" transform="rotate(-14)" />
        <rect x="86%" y="4%" width="10%" height="14%" rx="8" fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="1.5" transform="rotate(10 91% 11%)" />
        <rect x="3%" y="72%" width="7%" height="10%" rx="6" fill="none" stroke="rgba(239,159,39,0.09)" strokeWidth="1" transform="rotate(-6 6% 77%)" />
        <rect x="91%" y="78%" width="7%" height="10%" rx="6" fill="none" stroke="rgba(59,130,246,0.08)" strokeWidth="1" transform="rotate(8 94% 83%)" />
      </svg>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-20 sm:pb-24">

        {/* Two-column: text left, card graphic right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center pb-16 lg:pb-20">

          {/* Left: headline + CTAs */}
          <div>
            {/* Sports-energy live badge */}
            <div className="inline-flex items-center gap-2 bg-white/8 border border-white/15 rounded-full px-4 py-1.5 mb-5">
              <span className="w-2 h-2 rounded-full bg-amber shrink-0" style={{ boxShadow: "0 0 6px rgba(239,159,39,0.8)" }} />
              <span className="text-white/75 text-xs font-bold uppercase tracking-widest">
                Built for Serious Collectors
              </span>
            </div>

            {shown(cms, "hero_kicker") && (
              <p className="text-amber text-xs font-bold uppercase tracking-[0.2em] mb-4">
                {c(cms, "hero_kicker", "Sports · Pokémon · Magic · All cards")}
              </p>
            )}

            {shown(cms, "hero_headline") && (
              <h1 className="text-white font-black leading-[1.05] tracking-tight mb-5"
                style={{ fontSize: "clamp(2.1rem, 4vw, 3.25rem)" }}>
                {c(cms, "hero_headline", "The smartest home for your card collection.")}
              </h1>
            )}

            {shown(cms, "hero_body") && (
              <p className="text-white/60 text-lg leading-relaxed mb-8 max-w-lg">
                {c(cms, "hero_body", "Track your collection with live eBay values, sell directly to collectors on The Exchange, consign with ease, trade safely — and share every pickup with a community who actually gets it.")}
              </p>
            )}

            {/* Trust signals */}
            <div className="flex items-center gap-5 mb-8">
              {[
                { label: "Free to start" },
                { label: "No credit card" },
                { label: "Live eBay values" },
              ].map(t => (
                <div key={t.label} className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white/60 text-xs font-medium">{t.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {shown(cms, "hero_cta_primary") && (
                <Link
                  href={c(cms, "hero_cta_primary_url", "/signup")}
                  className="bg-amber text-amber-dark font-bold px-8 py-4 rounded-xl text-base hover:brightness-110 transition-all text-center"
                  style={{ boxShadow: "0 8px 24px rgba(239,159,39,0.25)" }}
                >
                  {c(cms, "hero_cta_primary", "Sign up free")}
                </Link>
              )}
              <HowItWorksModal
                buttonLabel={c(cms, "hero_cta_secondary", "See how it works")}
                buttonClassName="text-white/80 hover:text-white font-semibold px-7 py-4 rounded-xl text-base border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all text-center"
                title={c(cms, "howto_modal_title",  "See how The Card Cloud works")}
                body={c(cms,  "howto_modal_body",   "Watch a quick overview, then read the full guide.")}
                videoUrl={c(cms, "howto_video_url", "")}
                ctaLabel={c(cms, "howto_modal_cta", "Read the full how-to guide")}
              />
            </div>
          </div>

          {/* Right: card fan graphic + glow */}
          <div className="flex justify-center lg:justify-end relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div style={{ width:"60%", height:"70%", background:"radial-gradient(ellipse, rgba(239,159,39,0.14) 0%, transparent 70%)", borderRadius:"50%" }} />
            </div>
            <CardGraphic />
          </div>
        </div>

        {/* ── Service cards ─────────────────────────────────────────────────── */}
        <div id="services" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {SERVICE_DEFAULTS.map((service) => {
            const cta = getLink(links, service.linkKey);
            if (cta === null && Object.keys(links).length > 0) return null;
            const resolvedCta = cta ?? { label: service.defaultCta, href: service.defaultHref };
            return (
              <div key={service.id}
                className="bg-white rounded-2xl flex flex-col overflow-hidden hover:-translate-y-1 transition-all duration-200"
                style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.2)" }}
              >
                {/* Sport-color parallel accent stripe — like card variation colors */}
                <div style={{ height: 5, background: `linear-gradient(90deg, ${service.accent}, ${service.accent}cc)` }} />

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-xl" style={{ background: `${service.accent}15` }}>
                      <service.Icon className="w-5 h-5" style={{ color: service.accent }} />
                    </div>
                    <div>
                      <h2 className="text-navy font-bold text-lg leading-none">
                        {c(cms, `${service.cmsPrefix}_name`, service.name)}
                      </h2>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {c(cms, `${service.cmsPrefix}_tagline`, service.tagline)}
                      </p>
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm leading-relaxed flex-1 mb-5">
                    {c(cms, `${service.cmsPrefix}_description`, service.description)}
                  </p>

                  {(() => {
                    const sp = settingsPricing[service.id];
                    const pricing       = applyVars(c(cms, `${service.cmsPrefix}_pricing`,        sp?.pricing        ?? service.pricing));
                    const pricingDetail = applyVars(c(cms, `${service.cmsPrefix}_pricing_detail`, sp?.pricingDetail  ?? service.pricingDetail));
                    return (
                      <div className="border-t border-slate-100 pt-4 mb-4">
                        <p className="text-navy font-bold text-sm">{pricing}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{pricingDetail}</p>
                      </div>
                    );
                  })()}

                  <Link href={resolvedCta.href}
                    className="text-sm font-bold transition-colors hover:opacity-80"
                    style={{ color: service.accent }}>
                    {resolvedCta.label} →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Service icons ─────────────────────────────────────────────────────────────

function ChartIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function DollarIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function TagIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function OfferIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v2m0 8v2M9.5 9.5A2.5 2.5 0 0 1 12 7a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 2.5-2.5" />
    </svg>
  );
}
function TradeIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}
