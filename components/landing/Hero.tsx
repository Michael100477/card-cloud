import Link from "next/link";
import { CardGraphic } from "@/components/landing/CardGraphic";

const services = [
  {
    id: "track",
    name: "Track",
    tagline: "Catalog & monitor values",
    description:
      "Free collection tracking with live eBay values, trend charts, and smart organization tools.",
    pricing: "Free up to 100 cards",
    pricingDetail: "$2.99/mo · $25/yr unlimited",
    cta: "Start tracking",
    href: "/signup",
    iconBg: "bg-brand-muted",
    iconColor: "text-brand",
    Icon: ChartIcon,
  },
  {
    id: "sell",
    name: "Sell",
    tagline: "Fast cash offer",
    description:
      "Submit a card, get a personal offer within 24–48 hours. Accept and we handle shipping and payout.",
    pricing: "No fee to you",
    pricingDetail: "We research comps and make you an offer",
    cta: "Get an offer",
    href: "/signup",
    iconBg: "bg-success-muted",
    iconColor: "text-success",
    Icon: DollarIcon,
  },
  {
    id: "consign",
    name: "Consign",
    tagline: "Maximize sale price",
    description:
      "We list on eBay and pay you when it sells. All listing and eBay fees are included in our commission.",
    pricing: "15% commission",
    pricingDetail: "20% if we photograph · All fees included",
    cta: "Consign now",
    href: "/signup",
    iconBg: "bg-amber-muted",
    iconColor: "text-amber",
    Icon: TagIcon,
  },
  {
    id: "trade",
    name: "Trade",
    tagline: "Swap cards safely",
    description:
      "We act as escrow. Both collectors ship to us; we verify condition and re-ship to the new owner.",
    pricing: "$17 per side",
    pricingDetail: "$10 service + $7 shipping",
    cta: "Browse trades",
    href: "/signup",
    iconBg: "bg-alert-muted",
    iconColor: "text-alert",
    Icon: TradeIcon,
  },
] as const;

export function Hero() {
  return (
    <section className="bg-navy pt-14 pb-20 sm:pt-18 sm:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Two-column: text left, card graphic right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center pb-16 lg:pb-20">
          {/* Left: headline + CTAs */}
          <div>
            <p className="text-sky-highlight text-sm font-semibold uppercase tracking-widest mb-4">
              Sports · Pokémon · Magic · All cards
            </p>
            <h1 className="text-white text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-5">
              The smartest home for your card collection.
            </h1>
            <p className="text-sky-highlight text-lg leading-relaxed mb-8">
              Track your collection with live eBay values, sell or consign with
              ease, trade safely — and share every pickup with a community of
              collectors who actually get it.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/signup"
                className="bg-amber text-amber-dark font-semibold px-7 py-3.5 rounded-xl text-base hover:brightness-105 transition-all text-center"
              >
                Sign up free
              </Link>
              <Link
                href="#services"
                className="text-white/80 hover:text-white font-medium px-7 py-3.5 rounded-xl text-base border border-white/20 hover:border-white/40 transition-all text-center"
              >
                See how it works
              </Link>
            </div>
          </div>

          {/* Right: card fan graphic */}
          <div className="flex justify-center lg:justify-end">
            <CardGraphic />
          </div>
        </div>

        {/* Service cards */}
        <div id="services" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Icon + label */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${service.iconBg}`}>
                  <service.Icon className={`w-5 h-5 ${service.iconColor}`} />
                </div>
                <div>
                  <h2 className="text-navy font-bold text-lg leading-none">{service.name}</h2>
                  <p className="text-slate-500 text-xs mt-0.5">{service.tagline}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-slate-600 text-sm leading-relaxed flex-1 mb-5">
                {service.description}
              </p>

              {/* Pricing */}
              <div className="border-t border-slate-100 pt-4 mb-4">
                <p className="text-navy font-semibold text-sm">{service.pricing}</p>
                <p className="text-slate-500 text-xs mt-0.5">{service.pricingDetail}</p>
              </div>

              {/* CTA */}
              <Link
                href={service.href}
                className="text-brand font-semibold text-sm hover:text-light-navy transition-colors"
              >
                {service.cta} →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Service icons ─────────────────────────────────────────────────────────────

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function TradeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}
