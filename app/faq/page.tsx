import Link from "next/link";
import { db } from "@/lib/db";
import { SiteFooter } from "@/components/landing/SiteFooter";

type CmsMap = Record<string, string>;
function c(cms: CmsMap, key: string, fb: string) { return cms[key] || fb; }

interface FaqItem { id: string; question: string; answer: string; show: boolean }

export default async function FaqPage() {
  const rows = await db.siteSetting.findMany();
  const cms: CmsMap = {};
  for (const r of rows) cms[r.key] = r.value;

  let faqItems: FaqItem[] = [];
  try { faqItems = JSON.parse(cms["faq_items"] || "[]").filter((i: FaqItem) => i.show !== false); } catch { /* empty */ }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-navy border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/support" className="text-white/60 text-sm hover:text-white transition-colors">← Support</Link>
          <Link href="/signup" className="bg-amber text-amber-dark text-sm font-semibold px-4 py-2 rounded-xl hover:brightness-105">Sign up free</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-navy mb-3">
            {c(cms, "faq_headline", "Frequently Asked Questions")}
          </h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            {c(cms, "faq_subtitle", "Quick answers to the most common questions about The Card Cloud.")}
          </p>
        </div>

        {/* FAQ items */}
        {faqItems.length > 0 ? (
          <div className="flex flex-col gap-3">
            {faqItems.map((item) => (
              <FaqAccordion key={item.id} question={item.question} answer={item.answer} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <p className="text-slate-400 text-sm">FAQ coming soon — check back shortly.</p>
          </div>
        )}

        {/* Extra body */}
        {cms["faq_extra_body"] && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 mt-6">
            {cms["faq_extra_body"].split(/\n\n+/).filter(Boolean).map((p, i) => (
              <p key={i} className="text-slate-600 leading-relaxed mb-4 last:mb-0">{p}</p>
            ))}
          </div>
        )}

        {/* Still need help? */}
        <div className="mt-10 bg-navy rounded-2xl p-8 text-center">
          <p className="text-white font-semibold mb-1">
            {c(cms, "faq_still_need_help_headline", "Still have a question?")}
          </p>
          <p className="text-white/60 text-sm mb-5">
            {c(cms, "faq_still_need_help_body", "Our support team typically responds within 1–2 business days.")}
          </p>
          <Link href="/contact"
            className="inline-flex items-center gap-1.5 bg-amber text-amber-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:brightness-105 transition-all">
            {c(cms, "faq_still_need_help_cta", "Contact support")}
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function FaqAccordion({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
        <span className="text-navy font-semibold text-sm pr-4">{question}</span>
        <span className="text-slate-400 text-lg shrink-0 transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="px-6 pb-5 pt-0">
        <p className="text-slate-600 text-sm leading-relaxed">{answer}</p>
      </div>
    </details>
  );
}
