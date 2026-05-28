import Link from "next/link";
import { db } from "@/lib/db";
import { SiteFooter } from "@/components/landing/SiteFooter";

type CmsMap = Record<string, string>;
function c(cms: CmsMap, key: string, fb: string) { return cms[key] || fb; }

export default async function SupportPage() {
  const rows = await db.siteSetting.findMany();
  const cms: CmsMap = {};
  for (const r of rows) cms[r.key] = r.value;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-navy border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-white/60 text-sm hover:text-white transition-colors">← Back</Link>
          <Link href="/signup" className="bg-amber text-amber-dark text-sm font-semibold px-4 py-2 rounded-xl hover:brightness-105">Sign up free</Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-navy mb-3">
            {c(cms, "support_headline", "We're here to help")}
          </h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            {c(cms, "support_subtitle", "Find answers in our guides, or reach out to the team directly.")}
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {/* Contact */}
          <div className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col">
            <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center mb-5">
              <span className="text-2xl">✉️</span>
            </div>
            <h2 className="text-navy font-bold text-lg mb-2">
              {c(cms, "support_contact_title", "Contact support")}
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-5">
              {c(cms, "support_contact_body", "Have a question, bug report, or need help with your account? Send us a message and we'll get back to you within 1–2 business days.")}
            </p>
            <Link href="/contact"
              className="inline-flex items-center gap-1.5 bg-brand text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-blue-600 transition-colors text-center justify-center">
              {c(cms, "support_contact_cta", "Send a message")}
            </Link>
          </div>

          {/* How-To Guides */}
          <div className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col">
            <div className="w-12 h-12 bg-amber/10 rounded-2xl flex items-center justify-center mb-5">
              <span className="text-2xl">📖</span>
            </div>
            <h2 className="text-navy font-bold text-lg mb-2">
              {c(cms, "support_howto_title", "How-To guides")}
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-5">
              {c(cms, "support_howto_body", "Step-by-step walkthroughs for every feature — from adding your first card to listing on The Exchange.")}
            </p>
            <Link href="/how-it-works"
              className="inline-flex items-center gap-1.5 bg-amber text-amber-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:brightness-105 transition-all text-center justify-center">
              {c(cms, "support_howto_cta", "Browse guides")}
            </Link>
          </div>

          {/* FAQ */}
          <div className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col">
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mb-5">
              <span className="text-2xl">❓</span>
            </div>
            <h2 className="text-navy font-bold text-lg mb-2">
              {c(cms, "support_faq_title", "FAQ")}
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-5">
              {c(cms, "support_faq_body", "Quick answers to the most common questions about The Card Cloud.")}
            </p>
            <Link href="/faq"
              className="inline-flex items-center gap-1.5 border border-navy/20 text-navy font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-navy/5 transition-colors text-center justify-center">
              {c(cms, "support_faq_cta", "View FAQ")}
            </Link>
          </div>
        </div>

        {/* Additional content blocks if set */}
        {cms["support_extra_body"] && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8">
            {cms["support_extra_body"].split(/\n\n+/).filter(Boolean).map((p, i) => (
              <p key={i} className="text-slate-600 leading-relaxed mb-4 last:mb-0">{p}</p>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
