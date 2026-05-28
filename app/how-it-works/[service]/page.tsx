import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { SiteFooter } from "@/components/landing/SiteFooter";

type CmsMap = Record<string, string>;
function c(cms: CmsMap, key: string, fallback: string) { return cms[key] || fallback; }

const SERVICE_CONFIG: Record<string, {
  label: string;
  icon: string;
  color: string;
  prefix: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultBody: string;
  defaultCta: string;
  defaultCtaUrl: string;
}> = {
  track: {
    label: "Track",
    icon: "📈",
    color: "text-brand",
    prefix: "howto_track",
    defaultTitle:    "How tracking works",
    defaultSubtitle: "Everything you need to know about tracking your card collection.",
    defaultBody:     "",
    defaultCta:      "Start tracking free",
    defaultCtaUrl:   "/signup",
  },
  sell: {
    label: "Sell on The Exchange",
    icon: "💰",
    color: "text-green-600",
    prefix: "howto_sell",
    defaultTitle:    "How selling on The Exchange works",
    defaultSubtitle: "List your cards, get paid — we handle the escrow.",
    defaultBody:     "",
    defaultCta:      "List a card",
    defaultCtaUrl:   "/exchange/sell",
  },
  offer: {
    label: "Get an Offer",
    icon: "🤝",
    color: "text-sky-600",
    prefix: "howto_offer",
    defaultTitle:    "How getting a cash offer works",
    defaultSubtitle: "Submit a card and get a personal offer within 24–48 hours.",
    defaultBody:     "",
    defaultCta:      "Get an offer",
    defaultCtaUrl:   "/signup",
  },
  consign: {
    label: "Consign",
    icon: "🏷️",
    color: "text-amber-600",
    prefix: "howto_consign",
    defaultTitle:    "How consigning works",
    defaultSubtitle: "We list on eBay and pay you when it sells.",
    defaultBody:     "",
    defaultCta:      "Consign a card",
    defaultCtaUrl:   "/dashboard/consign",
  },
  trade: {
    label: "Trade",
    icon: "🔄",
    color: "text-purple-600",
    prefix: "howto_trade",
    defaultTitle:    "How trading works",
    defaultSubtitle: "Safe, escrow-based card trading between collectors.",
    defaultBody:     "",
    defaultCta:      "Browse trades",
    defaultCtaUrl:   "/signup",
  },
};

interface Props { params: Promise<{ service: string }> }

export default async function HowToServicePage({ params }: Props) {
  const { service } = await params;
  const config = SERVICE_CONFIG[service];
  if (!config) notFound();

  const rows = await db.siteSetting.findMany();
  const cms: CmsMap = {};
  for (const r of rows) cms[r.key] = r.value;

  const p = config.prefix;
  const title    = c(cms, `${p}_title`,    config.defaultTitle);
  const subtitle = c(cms, `${p}_subtitle`, config.defaultSubtitle);
  const body     = c(cms, `${p}_body`,     config.defaultBody);
  const ctaLabel = c(cms, `${p}_cta`,     config.defaultCta);
  const ctaUrl   = c(cms, `${p}_cta_url`, config.defaultCtaUrl);

  type Block = { id?: string; type: "text" | "image" | "video"; content: string; caption: string };

  // New blocks format — falls back to legacy _body text as a single text block
  let blocks: Block[] = [];
  const rawBlocks = cms[`${p}_blocks`];
  if (rawBlocks && rawBlocks !== "[]") {
    try { blocks = JSON.parse(rawBlocks); } catch { blocks = []; }
  } else {
    const legacyBody = cms[`${p}_body`] || config.defaultBody;
    if (legacyBody) blocks = [{ type: "text", content: legacyBody, caption: "" }];
  }
  const hasContent = blocks.length > 0;


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Nav */}
      <div className="bg-navy border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/how-it-works" className="text-white/60 text-sm hover:text-white transition-colors">
            ← All how-tos
          </Link>
          <Link href="/signup"
            className="bg-amber text-amber-dark text-sm font-semibold px-4 py-2 rounded-xl hover:brightness-105 transition-all">
            Sign up free
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">{config.icon}</span>
            <span className={`text-sm font-semibold uppercase tracking-widest ${config.color}`}>
              {config.label}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-navy mb-3 leading-tight">{title}</h1>
          {subtitle && <p className="text-slate-500 text-lg leading-relaxed">{subtitle}</p>}
        </div>

        {/* Content blocks — text, images, and videos in any order */}
        {hasContent ? (
          <div className="flex flex-col gap-6 mb-10">
            {blocks.map((block, i) => (
              <div key={block.id ?? i}>
                {block.type === "text" && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-8">
                    {block.content.split(/\n\n+/).filter(Boolean).map((para, j) => (
                      <p key={j} className="text-slate-600 leading-relaxed mb-4 last:mb-0">{para}</p>
                    ))}
                  </div>
                )}
                {block.type === "image" && (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={block.content} alt={block.caption || ""}
                      className="w-full rounded-2xl shadow-sm border border-slate-100 object-cover" />
                    {block.caption && <p className="text-slate-400 text-xs text-center mt-2 italic">{block.caption}</p>}
                  </div>
                )}
                {block.type === "video" && (
                  <div>
                    <div className="rounded-2xl overflow-hidden bg-slate-100 shadow-sm" style={{ aspectRatio: "16/9" }}>
                      <iframe src={block.content} className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen title={block.caption || title} />
                    </div>
                    {block.caption && <p className="text-slate-400 text-xs text-center mt-2 italic">{block.caption}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 border-dashed p-10 mb-10 text-center">
            <p className="text-slate-400 text-sm italic">
              Content coming soon — add text, images, and videos in Settings → Content → How To → {config.label}
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href={ctaUrl}
            className="bg-amber text-amber-dark font-semibold px-8 py-3.5 rounded-xl text-base hover:brightness-105 transition-all text-center w-full sm:w-auto">
            {ctaLabel}
          </Link>
          <Link href="/how-it-works" className="text-slate-400 text-sm hover:text-navy transition-colors">
            ← See all how-tos
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

export async function generateStaticParams() {
  return Object.keys(SERVICE_CONFIG).map(service => ({ service }));
}
