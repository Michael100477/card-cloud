import Link from "next/link";
import { db } from "@/lib/db";
import { PRIVACY_DEFAULTS } from "@/lib/privacy-defaults";
import { SiteFooter } from "@/components/landing/SiteFooter";

type CmsMap = Record<string, string>;
function c(cms: CmsMap, key: string, fb: string) { return cms[key] || fb; }

interface PrivacySection { id: string; title: string; body: string; show: boolean }

export default async function PrivacyPage() {
  const rows = await db.siteSetting.findMany();
  const cms: CmsMap = {};
  for (const r of rows) cms[r.key] = r.value;

  let customSections: PrivacySection[] = [];
  try { customSections = JSON.parse(cms["privacy_sections"] || "[]").filter((s: PrivacySection) => s.show !== false); } catch { /* empty */ }

  const sections: PrivacySection[] = customSections.length > 0
    ? customSections
    : PRIVACY_DEFAULTS.map((s, i) => ({ ...s, id: String(i), show: true }));

  const effectiveDate = c(cms, "privacy_effective_date", "May 19, 2026");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-navy border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-white/60 text-sm hover:text-white transition-colors">← Home</Link>
          <Link href="/signup" className="bg-amber text-amber-dark text-sm font-semibold px-4 py-2 rounded-xl hover:brightness-105">Sign up free</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-navy mb-3">
            {c(cms, "privacy_headline", "Privacy Policy")}
          </h1>
          <p className="text-slate-400 text-sm">Effective date: {effectiveDate}</p>
          {cms["privacy_intro"] && (
            <p className="text-slate-600 mt-4 leading-relaxed">{cms["privacy_intro"]}</p>
          )}
        </div>

        {/* Table of contents */}
        <nav className="bg-white rounded-2xl border border-slate-100 p-6 mb-10">
          <p className="text-navy font-semibold text-sm mb-3">Contents</p>
          <ol className="flex flex-col gap-1.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#section-${s.id}`} className="text-brand text-sm hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="flex flex-col gap-8">
          {sections.map((s) => {
            const isContactSection = /contact/i.test(s.title);
            return (
              <section key={s.id} id={`section-${s.id}`} className="scroll-mt-8">
                <h2 className="text-navy font-bold text-lg mb-3">{s.title}</h2>
                <div className="flex flex-col gap-3">
                  {s.body.split(/\n\n+/).filter(Boolean).map((para, i) => (
                    <p key={i} className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{para}</p>
                  ))}
                </div>
                {isContactSection && (
                  <Link href="/contact"
                    className="inline-flex items-center gap-1.5 mt-4 bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 transition-colors">
                    Go to our contact form →
                  </Link>
                )}
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-14 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-slate-400 text-xs">
            {c(cms, "privacy_footer_note", "Last updated: " + effectiveDate + " · The Card Cloud · thecardcloud.com")}
          </p>
          <Link href="/contact" className="text-brand text-sm hover:underline shrink-0">Questions? Contact us →</Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
