import Link from "next/link";
import { db } from "@/lib/db";
import { SiteFooter } from "@/components/landing/SiteFooter";

type CmsMap = Record<string, string>;
function c(cms: CmsMap, key: string, fallback: string) { return cms[key] || fallback; }

const SECTIONS = [
  {
    id: "track",   icon: "📈", titleKey: "howto_track_title",   bodyKey: "howto_track_body",
    defaultTitle: "How tracking works",
    defaultBody:  "Step-by-step guide coming soon.",
    color: "bg-brand/10 text-brand",
  },
  {
    id: "sell",    icon: "💰", titleKey: "howto_sell_title",    bodyKey: "howto_sell_body",
    defaultTitle: "How selling on The Exchange works",
    defaultBody:  "Step-by-step guide coming soon.",
    color: "bg-green-100 text-green-700",
  },
  {
    id: "offer",   icon: "🤝", titleKey: "howto_offer_title",   bodyKey: "howto_offer_body",
    defaultTitle: "How getting a cash offer works",
    defaultBody:  "Step-by-step guide coming soon.",
    color: "bg-sky-100 text-sky-700",
  },
  {
    id: "consign", icon: "🏷️", titleKey: "howto_consign_title", bodyKey: "howto_consign_body",
    defaultTitle: "How consigning works",
    defaultBody:  "Step-by-step guide coming soon.",
    color: "bg-amber-100 text-amber-700",
  },
  {
    id: "trade",   icon: "🔄", titleKey: "howto_trade_title",   bodyKey: "howto_trade_body",
    defaultTitle: "How trading works",
    defaultBody:  "Step-by-step guide coming soon.",
    color: "bg-purple-100 text-purple-700",
  },
];

export default async function HowItWorksPage() {
  const rows = await db.siteSetting.findMany();
  const cms: CmsMap = {};
  for (const r of rows) cms[r.key] = r.value;

  const videoUrl   = c(cms, "howto_video_url",    "");
  const pageTitle  = c(cms, "howto_page_title",   "How The Card Cloud Works");
  const pageSubtitle = c(cms, "howto_page_subtitle", "Everything you need to know — from tracking your first card to getting paid.");

  type Block = { id?: string; type: "text" | "image" | "video"; content: string; caption: string };
  let pageBlocks: Block[] = [];
  try { pageBlocks = JSON.parse(cms["howto_page_blocks"] || "[]"); } catch { pageBlocks = []; }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Nav */}
      <div className="bg-navy border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-white/60 text-sm hover:text-white transition-colors">
            ← Back to home
          </Link>
          <Link href="/signup"
            className="bg-amber text-amber-dark text-sm font-semibold px-4 py-2 rounded-xl hover:brightness-105 transition-all">
            Sign up free
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-navy mb-3">{pageTitle}</h1>
          <p className="text-slate-500 text-lg">{pageSubtitle}</p>
        </div>

        {/* Video */}
        {videoUrl ? (
          <div className="rounded-2xl overflow-hidden bg-slate-100 shadow-sm mb-16" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={videoUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={pageTitle}
            />
          </div>
        ) : (
          <div className="rounded-2xl bg-navy/5 border-2 border-dashed border-navy/20 mb-16"
            style={{ aspectRatio: "16/9" }}>
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400">
              <span className="text-5xl">🎬</span>
              <p className="font-medium">Overview video coming soon</p>
              <p className="text-sm text-slate-400 text-center max-w-xs">
                Add a YouTube or Vimeo embed URL under Settings → Content → How It Works — Modal
              </p>
            </div>
          </div>
        )}

        {/* Main page blocks — rendered between video and service cards */}
        {pageBlocks.length > 0 && (
          <div className="flex flex-col gap-6 mb-16">
            {pageBlocks.map((block, i) => (
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
                        allowFullScreen title={block.caption || pageTitle} />
                    </div>
                    {block.caption && <p className="text-slate-400 text-xs text-center mt-2 italic">{block.caption}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Service sections */}
        <div className="flex flex-col gap-8">
          {SECTIONS.map(s => {
            const title = c(cms, s.titleKey, s.defaultTitle);
            const body  = c(cms, s.bodyKey,  s.defaultBody);
            const isEmpty = !cms[s.bodyKey];

            return (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-100 p-8">
                <div className="flex items-start gap-4">
                  <span className={`text-2xl p-3 rounded-xl ${s.color} shrink-0`}>{s.icon}</span>
                  <div className="flex-1">
                    <h2 className="text-navy font-bold text-xl mb-2">{title}</h2>
                    <p className={`text-sm leading-relaxed mb-4 ${isEmpty ? "text-slate-400 italic" : "text-slate-600"}`}>
                      {body}
                    </p>
                    <Link
                      href={`/how-it-works/${s.id}`}
                      className="inline-flex items-center gap-1.5 text-brand font-semibold text-sm hover:underline"
                    >
                      Read the full guide →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-slate-500 text-sm mb-4">Ready to get started?</p>
          <Link href="/signup"
            className="bg-amber text-amber-dark font-semibold px-8 py-3.5 rounded-xl text-base hover:brightness-105 transition-all inline-block">
            Create your free account
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
